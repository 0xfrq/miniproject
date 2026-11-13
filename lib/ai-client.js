const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile() {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  const contents = fs.readFileSync(file, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith('#')) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

loadEnvFile();

const baseUrl = () => (process.env.AI_BASE_URL || '').replace(/\/+$/, '');
const model = () => process.env.AI_MODEL || 'gemini-3.1-flash-lite';
const timeoutMs = () => Math.max(10_000, Number(process.env.AI_TIMEOUT_MS) || 120_000);
const fallbackModels = () => (process.env.AI_FALLBACK_MODELS || '').split(',').map((value) => value.trim()).filter(Boolean);

class AIError extends Error {
  constructor(message, status = 502, code = 'AI_REQUEST_FAILED') {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.code = code;
  }
}

function status() {
  const key = process.env.AI_API_KEY;
  return { configured: Boolean(key && key !== 'PASTE_YOUR_API_KEY_HERE' && baseUrl()), model: model(), baseUrl: baseUrl() };
}

function getText(responseBody) {
  const content = responseBody?.choices?.[0]?.message?.content ?? responseBody?.choices?.[0]?.text ?? responseBody?.output_text ?? '';
  if (Array.isArray(content)) return content.map((part) => part?.text || part?.content || '').join('');
  return String(content || '');
}

async function askModel(messages, options = {}) {
  requireEndpoint();
  if (!process.env.AI_API_KEY || process.env.AI_API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
    throw new AIError('AI belum dikonfigurasi. Isi AI_API_KEY di file .env terlebih dahulu.', 503, 'AI_NOT_CONFIGURED');
  }
  const models = [options.model || model(), ...fallbackModels()].filter((value, index, list) => list.indexOf(value) === index);
  let lastError = null;
  for (const selectedModel of models) {
    try {
      return await askModelOnce(messages, { ...options, model: selectedModel });
    } catch (error) {
      lastError = error;
      if (!['AI_TIMEOUT', 'AI_PROVIDER_ERROR', 'AI_NETWORK_ERROR'].includes(error.code)) throw error;
    }
  }
  throw lastError || new AIError('Permintaan AI gagal.', 502);
}

async function askModelOnce(messages, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || timeoutMs());
  const cancel = () => controller.abort();
  if (options.signal) { if (options.signal.aborted) cancel(); else options.signal.addEventListener('abort', cancel, { once: true }); }
  try {
    const response = await fetch(`${baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.35,
        max_tokens: options.maxTokens ?? 6000,
        stream: options.stream ?? false,
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch {
      // Some OpenAI-compatible gateways stream SSE even when stream=false.
      const chunks = raw.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).filter((line) => line && line !== '[DONE]').map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
      if (chunks.length) body = { choices: [{ message: { content: chunks.map((chunk) => chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || '').join('') } }] };
      else body = { error: { message: raw.slice(0, 500) } };
    }
    if (!response.ok) {
      const detail = body?.error?.message || body?.message || `Provider mengembalikan HTTP ${response.status}.`;
      throw new AIError(`Provider AI gagal (${response.status}): ${detail}`, response.status >= 500 ? 502 : response.status, 'AI_PROVIDER_ERROR');
    }
    const text = getText(body).trim();
    if (!text) throw new AIError('Provider AI tidak mengembalikan isi jawaban.', 502, 'AI_EMPTY_RESPONSE');
    return text;
  } catch (error) {
    if (error instanceof AIError) throw error;
    if (error?.name === 'AbortError') {
      if (options.signal?.aborted) throw new AIError('Permintaan AI dibatalkan.', 499, 'AI_CANCELLED');
      throw new AIError('Permintaan AI melewati batas waktu. Coba lagi.', 504, 'AI_TIMEOUT');
    }
    throw new AIError(`Tidak dapat menghubungi provider AI: ${error.message}`, 502, 'AI_NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

function parseJson(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const starts = [cleaned.indexOf('{'), cleaned.indexOf('[')].filter((index) => index >= 0).sort((a, b) => a - b);
  for (const start of starts) {
    const open = cleaned[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < cleaned.length; index += 1) {
      const character = cleaned[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') quoted = true;
      else if (character === open) depth += 1;
      else if (character === close) {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(start, index + 1)); } catch { break; }
        }
      }
    }
  }
  throw new AIError('Jawaban AI tidak mengikuti format data yang diminta. Coba ulangi.', 502, 'AI_INVALID_JSON');
}

const embeddingModel = () => process.env.AI_EMBEDDING_MODEL || 'gemini-embedding-001';
const embeddingDimensions = () => Math.min(3072, Math.max(128, Number(process.env.AI_EMBEDDING_DIMENSIONS) || 768));
const visionModel = () => process.env.AI_VISION_MODEL || model();
// Cadangan untuk OCR saat model utama sibuk (503/429). Default hanya untuk endpoint Gemini resmi.
const visionFallbackModels = () => {
  const configured = process.env.AI_VISION_FALLBACK_MODELS;
  const list = configured !== undefined ? configured : (/generativelanguage\.googleapis\.com/.test(baseUrl()) ? 'gemini-3.5-flash-lite' : '');
  return list.split(',').map((value) => value.trim()).filter((value) => value && value !== visionModel());
};

function normalizeVector(values) {
  const norm = Math.hypot(...values) || 1;
  return values.map((value) => value / norm);
}

// Free tier Gemini membatasi token embedding per menit (30.000). Batas lokal dibuat sedikit
// di bawahnya dan dibagi oleh semua proses indexing di server ini.
const embeddingTokensPerMinute = () => Math.max(1000, Number(process.env.AI_EMBEDDING_TPM) || 25_000);
const estimateTokens = (text) => Math.ceil(String(text).length / 3);
const tokenWindow = [];

async function reserveEmbeddingTokens(tokens) {
  const limit = embeddingTokensPerMinute();
  const needed = Math.min(tokens, limit);
  while (true) {
    const now = Date.now();
    while (tokenWindow.length && now - tokenWindow[0].time >= 60_000) tokenWindow.shift();
    const used = tokenWindow.reduce((sum, item) => sum + item.tokens, 0);
    if (used + needed <= limit) { tokenWindow.push({ time: now, tokens: needed }); return; }
    await new Promise((resolve) => setTimeout(resolve, Math.max(250, 60_000 - (now - tokenWindow[0].time) + 50)));
  }
}

function retryAfterMs(message) {
  const match = /retry in ([\d.]+)\s*s/i.exec(String(message || ''));
  return match ? Math.ceil(Number(match[1]) * 1000) + 500 : 60_000;
}

// Embedding melalui endpoint OpenAI-compatible provider yang sama (/embeddings).
async function embed(texts, options = {}) {
  requireEndpoint();
  if (!process.env.AI_API_KEY || process.env.AI_API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
    throw new AIError('AI belum dikonfigurasi. Isi AI_API_KEY di file .env terlebih dahulu.', 503, 'AI_NOT_CONFIGURED');
  }
  if (!texts.length) return [];
  await reserveEmbeddingTokens(texts.reduce((sum, text) => sum + estimateTokens(text), 0));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 60_000);
  try {
    const response = await fetch(`${baseUrl()}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({ model: embeddingModel(), input: texts, dimensions: embeddingDimensions() }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = body?.error?.message || body?.message || `HTTP ${response.status}`;
      const failure = new AIError(`Provider embedding gagal (${response.status}): ${String(detail).split('\n')[0].slice(0, 300)}`, response.status === 429 ? 429 : 502, response.status === 429 ? 'AI_RATE_LIMIT' : 'AI_PROVIDER_ERROR');
      if (response.status === 429) failure.retryAfterMs = retryAfterMs(detail);
      throw failure;
    }
    const rows = Array.isArray(body?.data) ? [...body.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) : [];
    if (rows.length !== texts.length || rows.some((row) => !Array.isArray(row.embedding) || !row.embedding.length)) {
      throw new AIError('Provider tidak mengembalikan embedding yang lengkap.', 502, 'AI_EMPTY_RESPONSE');
    }
    return rows.map((row) => normalizeVector(row.embedding.map(Number)));
  } catch (error) {
    if (error instanceof AIError) throw error;
    if (error?.name === 'AbortError') throw new AIError('Permintaan embedding melewati batas waktu.', 504, 'AI_TIMEOUT');
    throw new AIError(`Tidak dapat menghubungi provider embedding: ${error.message}`, 502, 'AI_NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

function requireKey() {
  requireEndpoint();
  if (!process.env.AI_API_KEY || process.env.AI_API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
    throw new AIError('AI belum dikonfigurasi. Isi AI_API_KEY di file .env terlebih dahulu.', 503, 'AI_NOT_CONFIGURED');
  }
}

function requireEndpoint() {
  let url;
  try { url = new URL(baseUrl()); } catch { /* Handled below. */ }
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || (process.env.VERCEL === '1' && url.protocol !== 'https:')) {
    throw new AIError('AI belum dikonfigurasi. Isi AI_BASE_URL dengan endpoint provider yang tepercaya.', 503, 'AI_NOT_CONFIGURED');
  }
}

// Satu panggilan ke model tertentu tanpa daftar fallback global (dipakai OCR yang punya strategi sendiri).
async function askModelDirect(messages, options) {
  requireKey();
  return askModelOnce(messages, options);
}

module.exports = { AIError, askModel, askModelDirect, parseJson, status, embed, visionModel, visionFallbackModels, embeddingDimensions, estimateTokens, embeddingTokensPerMinute };
