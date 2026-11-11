import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const project = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const collectionNames = ['activities', 'posts', 'agenda', 'materials', 'assessments', 'questions', 'grading'];

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function stop(server) {
  if (!server?.listening) return;
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function startApp(directory, providerUrl, apiKey = 'migration-test-key') {
  const reservation = createServer();
  const port = await listen(reservation);
  await stop(reservation);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: directory,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      AI_BASE_URL: providerUrl,
      AI_API_KEY: apiKey,
      AI_MODEL: 'migration-test-model',
      AI_FALLBACK_MODELS: '',
      AI_TIMEOUT_MS: '10000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  let spawnError;
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  child.on('error', (error) => { spawnError = error; });
  const close = async () => {
    if (child.exitCode !== null || child.signalCode) return;
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  };
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (spawnError || child.exitCode !== null) {
      await close();
      throw new Error(`Next.js failed to start: ${spawnError || logs}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return { baseUrl, close, logs: () => logs };
    } catch { /* Wait for the production server to bind its port. */ }
    await delay(100);
  }
  await close();
  throw new Error(`Next.js did not become ready: ${logs}`);
}

test('Next.js preserves the existing pages, API contracts, storage, and AI workflows', { timeout: 180_000 }, async (t) => {
  const databaseBefore = await readFile(path.join(project, 'data/db.json'));
  const fixture = await mkdtemp(path.join(tmpdir(), 'sdn-bangah-migration-'));
  const providerCalls = [];
  let providerResponse = { content: '{}' };
  let app;
  const provider = createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      assert.equal(request.headers.authorization, 'Bearer migration-test-key');
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      providerCalls.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      response.writeHead(providerResponse.status || 200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(providerResponse.status
        ? { error: { message: 'Provider test failure' } }
        : { choices: [{ message: { content: providerResponse.content } }] }));
    } catch (error) {
      response.writeHead(500);
      response.end(JSON.stringify({ error: { message: error.message } }));
    }
  });

  try {
    // Run the actual production build in isolation, without copying .env or real data.
    for (const name of ['.next', 'public', 'package.json', 'next.config.js']) {
      await cp(path.join(project, name), path.join(fixture, name), {
        recursive: true,
        filter: (source) => source !== path.join(project, '.next/cache'),
      });
    }
    // Bundled server code resolves Next.js from this fixture's module directory.
    await symlink(path.join(project, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
    const providerUrl = `http://127.0.0.1:${await listen(provider)}/v1`;
    app = await startApp(fixture, providerUrl);

    async function request(url, method = 'GET', body) {
      const response = await fetch(`${app.baseUrl}${url}`, {
        method,
        ...(body === undefined ? {} : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      });
      const text = await response.text();
      return { response, status: response.status, text, data: text ? JSON.parse(text) : null };
    }

    await t.test('static assets and the AI generator retain their URLs and file contents', async () => {
      for (const name of ['style.css', 'styles.css', 'script.js', 'ai-learning-generator.html', 'ai-learning-generator.css', 'ai-learning-generator.js']) {
        const original = await readFile(path.join(project, 'public', name));
        const urls = [`/${name}`];
        for (const url of urls) {
          const response = await fetch(`${app.baseUrl}${url}`, { redirect: 'manual' });
          assert.equal(response.status, 200, url);
          assert.equal(response.headers.get('location'), null, url);
          assert.deepEqual(Buffer.from(await response.arrayBuffer()), original, url);
          const type = name.endsWith('.html') ? /text\/html/ : name.endsWith('.css') ? /text\/css/ : /javascript/;
          assert.match(response.headers.get('content-type'), type, url);
        }
      }
    });

    await t.test('merged public, admin, and teacher React pages render with their Next.js assets', async () => {
      for (const [url, marker] of [['/', 'Laman Kegiatan'], ['/index.html', 'Laman Kegiatan'], ['/admin', 'Admin editor'], ['/guru', 'Workspace Guru']]) {
        const response = await fetch(`${app.baseUrl}${url}`);
        const html = await response.text();
        assert.equal(response.status, 200, url);
        assert.ok(html.includes(marker), url);
        const assets = [...html.matchAll(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/g)];
        assert.ok(assets.length > 0, url);
        for (const [, asset] of assets) {
          assert.equal((await fetch(new URL(asset.replaceAll('&amp;', '&'), app.baseUrl))).status, 200, asset);
        }
      }
      for (const url of ['/.env', '/data/db.json', '/server.js', '/lib/ai-client.js']) {
        assert.equal((await fetch(`${app.baseUrl}${url}`)).status, 404, url);
      }
    });

    await t.test('homepage retains the incoming design and renders CMS edits at both public URLs', async () => {
      const site = (await request('/api/site')).data;
      const post = await request('/api/posts', 'POST', { title: 'Merged news item', excerpt: 'CMS news remains visible', date: '10 November 2026', category: 'Sekolah' });
      const activity = await request('/api/activities', 'POST', { title: 'Merged activity', description: 'CMS gallery remains visible', imageUrl: '/style.css' });
      const agenda = await request('/api/agenda', 'POST', { title: 'Merged school event', date: '10 November 2026', time: '09:00' });
      await request('/api/site', 'PUT', { meta: { schoolName: 'Merged School Name', address: 'Merged School Address', heroTitle: 'Merged welcome', aboutBody: 'Merged school profile' } });
      for (const url of ['/', '/index.html']) {
        const response = await fetch(`${app.baseUrl}${url}`, { redirect: 'manual' });
        assert.equal(response.status, 200);
        const html = await response.text();
        for (const text of ['static-public-profile', 'VISI', 'MISI', 'Laman Instagram', 'Kalender Akademik', 'Merged School Name', 'Merged School Address', 'Merged welcome', 'Merged school profile', 'Merged news item', 'Merged activity', 'Merged school event', 'November 2026', 'contact-form', `#artikel/${post.data.id}`]) {
          assert.ok(html.includes(text), `${url} must include ${text}`);
        }
        assert.ok(!html.includes('/img/logo-sekolah.png'));
        assert.ok(!html.includes('/img/whatsapp.svg'));
      }
      for (const [collection, item] of [['posts', post], ['activities', activity], ['agenda', agenda]]) await request(`/api/${collection}/${item.data.id}`, 'DELETE');
      await request('/api/site', 'PUT', { meta: site.meta });
    });

    await t.test('health and AI status keep their response shapes', async () => {
      const health = await request('/api/health');
      assert.equal(health.status, 200);
      assert.deepEqual(health.data, {
        ok: true, service: 'sdn-bangah-platform',
        ai: { configured: true, model: 'migration-test-model', baseUrl: providerUrl },
      });
      assert.deepEqual((await request('/api/ai/status')).data, health.data.ai);
    });

    await t.test('all seven collections support create, fresh reads, update, and deletion', async () => {
      for (const collection of collectionNames) {
        const url = `/api/${collection}`;
        const before = await request(url);
        assert.equal(before.status, 200, collection);
        assert.ok(Array.isArray(before.data), collection);
        const created = await request(url, 'POST', { title: `Test ${collection}`, score: 75 });
        assert.equal(created.status, 201, collection);
        assert.ok(created.data.id && created.data.createdAt && created.data.updatedAt, collection);
        const itemUrl = `${url}/${created.data.id}`;
        const listed = await request(url);
        assert.equal(listed.data.length, before.data.length + 1, collection);
        assert.deepEqual(listed.data[0], created.data, collection);
        const updated = await request(itemUrl, 'PUT', { title: 'Edited', id: 'cannot-replace-id' });
        assert.equal(updated.status, 200, collection);
        assert.equal(updated.data.id, created.data.id, collection);
        assert.equal((await request(url)).data[0].title, 'Edited', collection);
        const removed = await request(itemUrl, 'DELETE');
        assert.equal(removed.status, 204, collection);
        assert.equal(removed.text, '', collection);
        assert.deepEqual((await request(url)).data, before.data, collection);
        assert.equal((await request(itemUrl, 'PUT', {})).status, 404, collection);
        assert.equal((await request(itemUrl, 'DELETE')).status, 404, collection);
      }
    });

    await t.test('site editing and dashboard totals read the current stored data', async () => {
      const original = (await request('/api/site')).data;
      assert.ok(original.meta.schoolName);
      const saved = await request('/api/site', 'PUT', { meta: { schoolName: 'Migration Test School' }, values: [{ id: 'test', title: 'Test' }] });
      assert.equal(saved.status, 200);
      assert.equal(saved.data.meta.schoolName, 'Migration Test School');
      assert.equal(saved.data.meta.phone, original.meta.phone);
      assert.deepEqual((await request('/api/site')).data, saved.data);
      const material = await request('/api/materials', 'POST', { title: 'Persisted material', sections: [{ title: 'Intro', body: 'Content' }] });
      const dashboard = (await request('/api/dashboard')).data;
      assert.equal(dashboard.counts.materials, (await request('/api/materials')).data.length);
      assert.equal(dashboard.recentMaterials[0].id, material.data.id);
      assert.equal(dashboard.gradingSummary.average, 85);
    });

    await t.test('invalid JSON, invalid objects, missing fields, unknown collections, and methods are rejected', async () => {
      for (const body of [null, [], 'invalid', 2]) {
        assert.deepEqual((await request('/api/materials', 'POST', body)).data, { error: 'Payload tidak valid.' });
        assert.equal((await request('/api/materials', 'POST', body)).status, 400);
      }
      const malformed = await fetch(`${app.baseUrl}/api/site`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{' });
      assert.equal(malformed.status, 400);
      assert.deepEqual(await malformed.json(), { error: 'Data profil tidak valid.' });
      for (const [endpoint, body, error] of [
        ['search-reference', {}, 'Nama buku atau ISBN wajib diisi.'],
        ['generate-material', {}, 'Topik dan tujuan pembelajaran wajib diisi.'],
        ['generate-questions', { topic: 'Topic' }, 'Topik dan tujuan pembelajaran wajib diisi.'],
        ['analyze-assessment', {}, 'Data penilaian tidak valid.'],
      ]) {
        const invalid = await request(`/api/ai/${endpoint}`, 'POST', body);
        assert.equal(invalid.status, 400);
        assert.deepEqual(invalid.data, { error });
      }
      for (const url of ['/api/not-a-collection', '/api/meta', '/api/not-a-collection/missing']) {
        assert.equal((await request(url, url.endsWith('/missing') ? 'DELETE' : 'GET')).status, 404, url);
      }
      assert.equal((await request('/api/materials', 'PUT', {})).status, 405);
      assert.equal((await request('/api/ai/generate-material')).status, 405);
      const empty = await fetch(`${app.baseUrl}/api/materials`, { method: 'POST' });
      assert.equal(empty.status, 201);
      await request(`/api/materials/${(await empty.json()).id}`, 'DELETE');
    });

    await t.test('JSON payloads retain the 20 MiB limit, including streaming requests', async () => {
      // Larger than Next.js Pages API's default 1 MiB: this remains supported.
      const created = await request('/api/materials', 'POST', { content: 'x'.repeat(1024 * 1024 + 1) });
      assert.equal(created.status, 201);
      await request(`/api/materials/${created.data.id}`, 'DELETE');
      const tooLarge = JSON.stringify({ content: 'x'.repeat(20 * 1024 * 1024) });
      assert.equal((await fetch(`${app.baseUrl}/api/materials`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: tooLarge })).status, 413);
      const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(tooLarge)); controller.close(); } });
      const streamed = await fetch(`${app.baseUrl}/api/materials`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' });
      assert.equal(streamed.status, 413);
    });

    await t.test('AI endpoints preserve prompts, configuration, parsing, and response transformations', async () => {
      providerResponse = { content: JSON.stringify({ results: Array.from({ length: 6 }, (_, index) => ({ title: `Book ${index}` })) }) };
      const references = await request('/api/ai/search-reference', 'POST', { title: 'IPA', isbn: '123' });
      assert.equal(references.status, 200);
      assert.equal(references.data.results.length, 5);
      assert.equal(references.data.results[0].source, 'Saran AI · verifikasi manual');
      assert.match(references.data.results[0].id, /^book-ai-/);
      assert.deepEqual(JSON.parse(providerCalls.at(-1).messages[1].content), { namaBukuAtauMateri: 'IPA', isbn: '123' });

      const sections = [{ id: 'inti', title: 'Materi Inti', body: 'Isi materi.' }];
      providerResponse = { content: '```json\n' + JSON.stringify({ sections }) + '\n```' };
      const config = { subject: 'IPA', grade: 'Kelas 5 SD', topic: 'Pernapasan', objective: 'Memahami organ', reference: { title: 'Buku IPA' } };
      const material = await request('/api/ai/generate-material', 'POST', config);
      assert.equal(material.status, 200);
      assert.deepEqual(material.data, { title: 'IPA · Pernapasan', sections });
      assert.equal(providerCalls.at(-1).model, 'migration-test-model');
      assert.equal(providerCalls.at(-1).max_tokens, 6000);
      assert.deepEqual(JSON.parse(providerCalls.at(-1).messages[1].content).referensi, config.reference);

      providerResponse = { content: JSON.stringify({ questions: [{ type: 'Isian Singkat', text: 'Apa fungsi paru-paru?', correct: 'Bernapas' }] }) };
      const questions = await request('/api/ai/generate-questions', 'POST', { ...config, total: 1, short: 1 });
      assert.equal(questions.status, 200);
      assert.match(questions.data.questions[0].id, /^q-ai-/);
      assert.deepEqual(questions.data.questions[0].options, []);
      assert.equal(questions.data.questions[0].quality, 'ok');
      assert.equal(providerCalls.at(-1).max_tokens, 8000);

      providerResponse = { content: 'Ringkasan hasil penilaian.' };
      const analysis = await request('/api/ai/analyze-assessment', 'POST', { results: [{ score: 80 }] });
      assert.deepEqual(analysis.data, { analysis: 'Ringkasan hasil penilaian.' });
      assert.equal(providerCalls.at(-1).temperature, 0.3);
      assert.ok(providerCalls.every((call) => call.messages[0].role === 'system' && call.stream === false));
    });

    await t.test('provider errors and malformed AI output keep their error responses', async () => {
      const config = { topic: 'Pernapasan', objective: 'Memahami organ' };
      providerResponse = { status: 503 };
      const unavailable = await request('/api/ai/generate-material', 'POST', config);
      assert.equal(unavailable.status, 502);
      assert.match(unavailable.data.error, /Provider AI gagal \(503\)/);
      providerResponse = { content: 'not JSON' };
      assert.equal((await request('/api/ai/generate-questions', 'POST', config)).status, 502);
      providerResponse = { content: '{}' };
      const missing = await request('/api/ai/generate-material', 'POST', config);
      assert.equal(missing.status, 502);
      assert.deepEqual(missing.data, { error: 'sections tidak ditemukan' });
    });

    await t.test('saved edits survive a server restart and missing AI credentials still return 503', async () => {
      await app.close();
      app = await startApp(fixture, providerUrl, 'PASTE_YOUR_API_KEY_HERE');
      assert.equal((await request('/api/site')).data.meta.schoolName, 'Migration Test School');
      assert.ok((await request('/api/materials')).data.some((material) => material.title === 'Persisted material'));
      assert.equal((await request('/api/ai/status')).data.configured, false);
      const callsBefore = providerCalls.length;
      assert.equal((await request('/api/ai/generate-material', 'POST', { topic: 'Test', objective: 'Test' })).status, 503);
      assert.equal(providerCalls.length, callsBefore);
    });
  } finally {
    await app?.close();
    await stop(provider);
    // This test owns only this uniquely named temporary directory.
    assert.equal(path.dirname(fixture), path.resolve(tmpdir()));
    assert.ok(path.basename(fixture).startsWith('sdn-bangah-migration-'));
    await rm(fixture, { recursive: true, force: true });
    assert.deepEqual(await readFile(path.join(project, 'data/db.json')), databaseBefore, 'Project database must remain untouched');
  }
});
