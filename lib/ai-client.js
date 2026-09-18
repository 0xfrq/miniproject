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

const baseUrl = () => (process.env.AI_BASE_URL || 'https://rb6kdai.abc-tunnel.us/v1').replace(/\/+$/, '');
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
  return { configured: Boolean(key && key !== 'PASTE_YOUR_API_KEY_HERE'), model: model(), baseUrl: baseUrl() };
}

function getText(responseBody) {
  const content = responseBody?.choices?.[0]?.message?.content ?? responseBody?.choices?.[0]?.text ?? responseBody?.output_text ?? '';
  if (Array.isArray(content)) return content.map((part) => part?.text || part?.content || '').join('');
  return String(content || '');
}

async function askModel(messages, options = {}) {
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
    if (error?.name === 'AbortError') throw new AIError('Permintaan AI melewati batas waktu. Coba lagi.', 504, 'AI_TIMEOUT');
    throw new AIError(`Tidak dapat menghubungi provider AI: ${error.message}`, 502, 'AI_NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
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

module.exports = { AIError, askModel, parseJson, status };
