import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { testDatabase } from './postgres-helper.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const { migrate, legacySnapshot, importLegacy } = require('../lib/migrations');
const { hashPassword } = require('../lib/passwords');
const nextCli = require.resolve('next/dist/bin/next');
const buildDirectory = process.env.NEXT_DIST_DIR || '.next';
const adminPassword = 'Admin-test-password-2026';
const teacherPassword = 'Teacher-test-password-2026';
const lesson = { subject: 'IPA', grade: 'Kelas 5 SD', summary: 'Ringkasan materi', content: 'Teks pelajaran', status: 'Draft' };
const exam = { subject: 'Matematika', grade: 'Kelas 5 SD', duration: '35 menit', status: 'Draft' };

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

async function startApp(directory, connectionString, schema, providerUrl, key = 'migration-test-key') {
  const reservation = createServer();
  const port = await listen(reservation);
  await stop(reservation);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: connectionString,
      DATABASE_SCHEMA: schema, AI_BASE_URL: providerUrl, AI_API_KEY: key, AI_MODEL: 'migration-test-model',
      AI_FALLBACK_MODELS: '', AUTH_COOKIE_SECURE: 'false', APP_ORIGIN: baseUrl },
  });
  let logs = '';
  let spawnError;
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  child.on('error', (error) => { spawnError = error; });
  const close = async () => {
    if (child.exitCode !== null || child.signalCode) return;
    const exited = once(child, 'exit'); child.kill(); await exited;
  };
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (spawnError || child.exitCode !== null) throw new Error(`Next.js startup failed: ${spawnError || logs}`);
    try { if ((await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) return { baseUrl, close }; }
    catch { /* Wait for the production listener. */ }
    await delay(100);
  }
  await close(); throw new Error(`Next.js did not become ready: ${logs}`);
}

test('PostgreSQL migration, accounts, sessions, authorization, and existing workflows', { timeout: 240_000 }, async (t) => {
  const originalJson = await readFile(path.join(project, 'data/db.json'));
  const fixture = await mkdtemp(path.join(tmpdir(), 'sdn-sql-auth-'));
  const schema = `sdn_test_${randomUUID().replaceAll('-', '')}`;
  let database;
  let pool;
  let app;
  let adminCookie;
  let teacherA;
  let teacherB;
  let cookieA;
  let cookieB;
  let teacherMaterial;
  let teacherAssessment;
  let manualAssessment;
  let manualGrade;
  const calls = [];
  let providerResponse = { content: '{}' };
  const provider = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    calls.push({ body: JSON.parse(Buffer.concat(chunks).toString('utf8')), authorization: request.headers.authorization });
    response.writeHead(providerResponse.status || 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(providerResponse.status ? { error: { message: 'Provider test failure' } } : { choices: [{ message: { content: providerResponse.content } }] }));
  });

  try {
    database = await testDatabase();
    process.env.DATABASE_URL = database.url;
    process.env.DATABASE_SCHEMA = schema;
    pool = new Pool({ connectionString: database.url, options: `-c search_path=${schema}` });
    await migrate(pool);
    const adminId = randomUUID();
    await pool.query("INSERT INTO users(id,email,name,role,password_hash) VALUES($1,'admin@example.test','Test Admin','admin',$2)", [adminId, await hashPassword(adminPassword)]);
    const snapshot = await legacySnapshot();
    const imported = await importLegacy(pool, adminId, snapshot);

    await t.test('migration preserves every unique JSON record, IDs, relationships, metadata, and order', async () => {
      assert.equal(imported.skipped, false);
      assert.deepEqual((await pool.query('SELECT meta FROM site_settings WHERE id = 1')).rows[0].meta, snapshot.data.meta);
      for (const name of ['values', 'activities', 'posts', 'agenda']) {
        assert.deepEqual((await pool.query('SELECT payload FROM public_records WHERE collection = $1 ORDER BY position DESC,id', [name])).rows.map((row) => row.payload), snapshot.data[name]);
      }
      for (const name of ['materials', 'assessments', 'questions', 'grading']) {
        assert.deepEqual((await pool.query(`SELECT payload FROM ${name} ORDER BY position DESC,id`)).rows.map((row) => row.payload), snapshot.data[name]);
        assert.ok((await pool.query(`SELECT owner_id FROM ${name}`)).rows.every((row) => row.owner_id === adminId));
      }
      assert.equal((await importLegacy(pool, adminId, snapshot)).skipped, true);
      await migrate(pool);
      assert.equal(Number((await pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count), 1);
    });

    for (const name of [buildDirectory, 'public', 'templates', 'package.json', 'next.config.js']) {
      await cp(path.join(project, name), path.join(fixture, name), { recursive: true, filter: (source) => source !== path.join(project, buildDirectory, 'cache') });
    }
    await symlink(path.join(project, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
    const providerUrl = `http://127.0.0.1:${await listen(provider)}/v1`;
    app = await startApp(fixture, database.url, schema, providerUrl);

    async function request(url, { method = 'GET', body, cookie, headers = {}, redirect = 'manual' } = {}) {
      const response = await fetch(`${app.baseUrl}${url}`, { method, redirect,
        headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let data = null;
      if (text && response.headers.get('content-type')?.includes('application/json')) data = JSON.parse(text);
      return { response, status: response.status, text, data };
    }

    async function login(email, password, role) {
      const result = await request('/api/auth/login', { method: 'POST', body: { email, password, role } });
      assert.equal(result.status, 200, result.text);
      return { cookie: result.response.headers.get('set-cookie').split(';')[0], ...result };
    }

    await t.test('public pages remain accessible and private pages/API require a verified session', async () => {
      for (const url of ['/', '/index.html', '/login']) assert.equal((await request(url)).status, 200, url);
      for (const url of ['/admin', '/guru', '/ai-learning-generator.html']) {
        const response = await request(url);
        assert.equal(response.status, 307, url);
        assert.ok(response.response.headers.get('location').includes('/login'), url);
      }
      for (const url of ['/api/me', '/api/dashboard', '/api/materials', '/api/assessments', '/api/questions', '/api/grading', '/api/admin/users']) assert.equal((await request(url)).status, 401, url);
      for (const url of ['/api/ai/generate-material', '/api/ai/generate-questions', '/api/ai/analyze-assessment', '/api/ai/search-reference']) assert.equal((await request(url, { method: 'POST', body: {} })).status, 401, url);
      assert.equal(calls.length, 0);
      assert.equal((await request('/api/site', { method: 'PUT', body: {} })).status, 401);
      const health = (await request('/api/health')).data;
      assert.equal(health.ok, true); assert.equal(health.database, 'postgresql');
      assert.ok(!(await request('/login')).text.includes('Masuk mode demo'));
    });

    await t.test('login checks credentials and selected role, issues an HttpOnly cookie, and stores only its hash', async () => {
      for (const body of [
        { email: 'unknown@example.test', password: teacherPassword, role: 'guru' },
        { email: 'admin@example.test', password: 'wrong-password', role: 'admin' },
        { email: 'admin@example.test', password: adminPassword, role: 'guru' },
      ]) assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 401);
      const logged = await login('ADMIN@example.test', adminPassword, 'admin');
      adminCookie = logged.cookie;
      const cookie = logged.response.headers.get('set-cookie');
      for (const flag of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=604800']) assert.ok(cookie.includes(flag));
      assert.ok(logged.response.headers.get('cache-control').includes('no-store'));
      assert.equal(logged.data.redirectTo, '/admin');
      assert.equal(logged.data.user.role, 'admin');
      assert.ok(!('password_hash' in logged.data.user));
      const raw = adminCookie.split('=')[1];
      const stored = (await pool.query('SELECT token_hash FROM sessions WHERE user_id = $1', [adminId])).rows[0].token_hash;
      assert.equal(stored, createHash('sha256').update(raw).digest('hex')); assert.notEqual(stored, raw);
      assert.equal((await request('/api/me', { cookie: adminCookie })).data.user.name, 'Test Admin');
      assert.equal((await request('/api/me', { cookie: `sdn_session=${'a'.repeat(43)}` })).status, 401);
    });

    await t.test('admin can create teacher accounts; teachers cannot create accounts or change school content', async () => {
      const a = await request('/api/admin/users', { method: 'POST', cookie: adminCookie, body: { name: 'Teacher A', email: 'TeacherA@example.test', password: teacherPassword, className: 'Kelas 5A', academicYear: '2026/2027' } });
      assert.equal(a.status, 201); teacherA = a.data; assert.equal(teacherA.email, 'teachera@example.test');
      const b = await request('/api/admin/users', { method: 'POST', cookie: adminCookie, body: { name: 'Teacher B', email: 'teacherb@example.test', password: teacherPassword } });
      assert.equal(b.status, 201); teacherB = b.data;
      assert.equal((await request('/api/admin/users', { method: 'POST', cookie: adminCookie, body: { name: 'Duplicate', email: teacherA.email, password: teacherPassword } })).status, 409);
      assert.equal((await request('/api/admin/users', { method: 'POST', cookie: adminCookie, body: { name: 'Weak', email: 'weak@example.test', password: 'short' } })).status, 400);
      assert.equal((await request('/api/admin/users', { method: 'POST', cookie: adminCookie, body: { name: 'Extra admin', email: 'extra@example.test', password: teacherPassword, role: 'admin' } })).status, 400);
      cookieA = (await login(teacherA.email, teacherPassword, 'guru')).cookie;
      cookieB = (await login(teacherB.email, teacherPassword, 'guru')).cookie;
      assert.equal((await request('/api/me', { cookie: cookieA })).data.user.className, 'Kelas 5A');
      assert.equal((await request('/api/admin/users', { cookie: cookieA })).status, 403);
      assert.equal((await request('/api/admin/users', { method: 'POST', cookie: cookieA, body: {} })).status, 403);
      assert.equal((await request('/api/site', { method: 'PUT', cookie: cookieA, body: {} })).status, 403);
      for (const name of ['activities', 'posts', 'agenda']) assert.equal((await request(`/api/${name}`, { method: 'POST', cookie: cookieA, body: {} })).status, 403);
      const hashes = (await pool.query("SELECT password_hash FROM users WHERE role = 'guru'")).rows;
      assert.ok(hashes.every((row) => row.password_hash.startsWith('scrypt$') && !row.password_hash.includes(teacherPassword)));
      assert.ok(hashes[0].password_hash !== hashes[1].password_hash, 'Passwords must have unique salts');
    });

    await t.test('private records, dashboard totals, and relationships are isolated by teacher', async () => {
      for (const name of ['materials', 'assessments', 'questions', 'grading']) assert.deepEqual((await request(`/api/${name}`, { cookie: cookieA })).data, []);
      const created = await request('/api/materials', { method: 'POST', cookie: cookieA, body: { ...lesson, title: 'Teacher A material', content: 'Lesson text', ownerId: teacherB.id, owner_id: teacherB.id } });
      assert.equal(created.status, 201); teacherMaterial = created.data;
      assert.equal((await pool.query('SELECT owner_id FROM materials WHERE id=$1', [teacherMaterial.id])).rows[0].owner_id, teacherA.id);
      assert.deepEqual((await request('/api/materials', { cookie: cookieB })).data, []);
      const bundle = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'Teacher A assessment', questions: [{ text: 'Question one', type: 'Pilihan Ganda', options: ['A', 'B'], correct: 'A' }, { text: 'Question two', answer: 'Two' }] } });
      assert.equal(bundle.status, 201); teacherAssessment = bundle.data;
      assert.equal(bundle.data.questions.length, 2); assert.equal(bundle.data.questionCount, 2);
      assert.ok(bundle.data.questions.every((question) => question.assessmentId === bundle.data.id));
      assert.equal((await request('/api/materials', { cookie: cookieA })).data.length, 1);
      assert.equal((await request('/api/dashboard', { cookie: cookieA })).data.counts.materials, 1);
      assert.equal((await request('/api/dashboard', { cookie: cookieB })).data.counts.materials, 0);
      assert.equal((await request(`/api/materials/${teacherMaterial.id}`, { method: 'PUT', cookie: cookieB, body: { title: 'Intrusion' } })).status, 404);
      assert.equal((await request(`/api/materials/${teacherMaterial.id}`, { method: 'DELETE', cookie: cookieB })).status, 404);
      assert.equal((await request('/api/questions', { method: 'POST', cookie: cookieB, body: { assessmentId: teacherAssessment.id } })).status, 404);
      assert.equal((await request('/api/grading', { method: 'POST', cookie: cookieB, body: { assessmentId: teacherAssessment.id, score: 100 } })).status, 404);
      const updated = await request(`/api/materials/${teacherMaterial.id}`, { method: 'PUT', cookie: cookieA, body: { title: 'Edited lesson', id: 'forged-id', ownerId: teacherB.id } });
      assert.equal(updated.status, 200); assert.equal(updated.data.id, teacherMaterial.id);
      assert.equal((await request('/api/materials', { cookie: cookieA })).data[0].title, 'Edited lesson');
      assert.ok((await request('/api/materials', { cookie: adminCookie })).data.some((item) => item.id === teacherMaterial.id));
    });

    await t.test('manual materials validate every field, persist statuses, and restrict direct views to the owner', async () => {
      const before = (await request('/api/materials', { cookie: cookieA })).data;
      for (const body of [
        {}, { ...lesson, title: '  ' }, { ...lesson, title: 'Invalid', subject: '' },
        { ...lesson, title: 'Invalid', grade: 5 }, { ...lesson, title: 'Invalid', content: '\n  ' },
        { ...lesson, title: 'Invalid', summary: {} }, { ...lesson, title: 'Invalid', status: 'Published' },
        { ...lesson, title: 'x'.repeat(201) }, { ...lesson, title: 'Invalid', summary: 'x'.repeat(2001) },
        { ...lesson, title: 'Invalid', content: 'x'.repeat(2000001) },
      ]) {
        const invalid = await request('/api/materials', { method: 'POST', cookie: cookieA, body });
        assert.equal(invalid.status, 400, invalid.text); assert.ok(invalid.data.error);
      }
      assert.deepEqual((await request('/api/materials', { cookie: cookieA })).data, before);
      const created = await request('/api/materials', { method: 'POST', cookie: cookieA, body: { ...lesson, title: '  Manual lesson  ', content: 'Paragraph one.\n\n<script>window.lessonInjected = true</script>', ownerId: teacherB.id, createdAt: 'spoof', updatedAt: 'spoof', sections: [{ title: 'Existing metadata' }] } });
      assert.equal(created.status, 201); const item = created.data;
      assert.equal(item.title, 'Manual lesson'); assert.equal(item.status, 'Draft'); assert.ok(Number.isFinite(Date.parse(item.createdAt))); assert.equal(item.updatedAt, item.createdAt);
      assert.equal((await request(`/api/materials/${item.id}`)).status, 401);
      assert.equal((await request(`/api/materials/${item.id}`, { cookie: cookieB })).status, 404);
      assert.equal((await request(`/api/materials/${item.id}`, { cookie: adminCookie })).status, 200);
      assert.deepEqual((await request(`/api/materials/${item.id}`, { cookie: cookieA })).data, item);
      assert.equal((await request(`/api/materials/${item.id}`, { method: 'PUT', cookie: cookieA, body: { content: '' } })).status, 400);
      assert.deepEqual((await request(`/api/materials/${item.id}`, { cookie: cookieA })).data, item);
      const ready = await request(`/api/materials/${item.id}`, { method: 'PUT', cookie: cookieA, body: { title: 'Updated manual lesson', subject: 'Matematika', grade: 'Kelas 6 SD', summary: '', content: 'Updated lesson text.', status: 'Siap digunakan', ownerId: teacherB.id, createdAt: 'spoof' } });
      assert.equal(ready.status, 200); assert.equal(ready.data.status, 'Siap digunakan'); assert.equal(ready.data.createdAt, item.createdAt); assert.deepEqual(ready.data.sections, item.sections);
      assert.equal((await pool.query('SELECT owner_id FROM materials WHERE id=$1', [item.id])).rows[0].owner_id, teacherA.id);
      assert.deepEqual((await request(`/api/materials/${item.id}`, { cookie: cookieA })).data, ready.data);
      assert.equal((await request(`/api/materials/${item.id}`, { method: 'DELETE', cookie: cookieB })).status, 404);
      assert.equal((await request(`/api/materials/${item.id}`, { method: 'DELETE', cookie: cookieA })).status, 204);
      assert.equal((await request(`/api/materials/${item.id}`, { cookie: cookieA })).status, 404);
      assert.deepEqual((await request('/api/materials', { cookie: cookieA })).data, before);
    });

    await t.test('material printing reads saved text, escapes markup, and enforces teacher ownership', async () => {
      const created = await request('/api/materials', { method: 'POST', cookie: cookieA, body: { ...lesson, title: 'Printable lesson', summary: 'Printable summary', content: 'First lesson paragraph.\n\n<script>window.materialPrintInjected = true</script>\nFINAL_LESSON_TOKEN' } });
      assert.equal(created.status, 201); const id = created.data.id;
      const url = `/guru/materi/${id}/cetak`;
      assert.equal((await request(url)).status, 307); assert.equal((await request(url, { cookie: cookieB })).status, 404); assert.equal((await request(url, { cookie: adminCookie })).status, 200);
      const draft = await request(url, { cookie: cookieA }); assert.equal(draft.status, 200);
      for (const text of ['Printable lesson', 'Printable summary', 'FINAL_LESSON_TOKEN', 'DRAFT', '&lt;script&gt;']) assert.ok(draft.text.includes(text), text);
      assert.equal(draft.text.includes('<script>window.materialPrintInjected'), false);
      const updated = await request(`/api/materials/${id}`, { method: 'PUT', cookie: cookieA, body: { status: 'Siap digunakan', title: 'Updated printable lesson', content: 'Updated saved lesson' } });
      assert.equal(updated.status, 200);
      const ready = await request(url, { cookie: cookieA }); assert.ok(ready.text.includes('Updated saved lesson')); assert.equal(ready.text.includes('DRAFT — UNTUK DITINJAU'), false);
      await request(`/api/materials/${id}`, { method: 'DELETE', cookie: cookieA }); assert.equal((await request(url, { cookie: cookieA })).status, 404);
      assert.equal((await request('/guru/materi/missing/cetak', { cookie: cookieA })).status, 404);
    });

    await t.test('database failures roll back the entire assessment bundle and concurrent saves are retained', async () => {
      const before = Number((await pool.query('SELECT count(*) FROM assessments')).rows[0].count);
      await pool.query("ALTER TABLE questions ADD CONSTRAINT test_reject_question CHECK(payload->>'text' IS DISTINCT FROM 'reject-me')");
      try {
        const failed = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'Must roll back', questions: [{ text: 'Accept this' }, { text: 'reject-me' }] } });
        assert.equal(failed.status, 400);
        assert.equal(Number((await pool.query('SELECT count(*) FROM assessments')).rows[0].count), before);
        assert.equal(Number((await pool.query("SELECT count(*) FROM questions WHERE payload->>'text' = 'Accept this'")).rows[0].count), 0);
      } finally { await pool.query('ALTER TABLE questions DROP CONSTRAINT test_reject_question'); }
      const results = await Promise.all(Array.from({ length: 8 }, (_, index) => request('/api/materials', { method: 'POST', cookie: cookieB, body: { ...lesson, title: `Parallel ${index}` } })));
      assert.ok(results.every((result) => result.status === 201));
      assert.equal((await request('/api/materials', { cookie: cookieB })).data.length, 8);
    });

    await t.test('manual assessment bundles preserve question IDs, order, keys, and ownership across edits', async () => {
      const draft = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: '  Manual assessment  ', questionCount: 99, ownerId: teacherB.id, createdAt: 'spoof', questions: [
        { id: 'client-q1', type: 'Pilihan Ganda', text: 'Pick two', options: ['A. One', 'B. Two'], correct: 'Two', explanation: 'The key explanation', objective: 'Preserve this metadata' },
        { type: 'Isian Singkat', text: 'Complete this', answer: 'Answer two' },
        { type: 'Essay', text: 'Explain this', correct: 'Essay answer', explanation: 'Essay explanation' },
      ] } });
      assert.equal(draft.status, 201, draft.text); manualAssessment = draft.data;
      assert.equal(draft.data.title, 'Manual assessment'); assert.equal(draft.data.questionCount, 3);
      assert.equal(draft.data.questions[0].correct, 'B'); assert.deepEqual(draft.data.questions[0].options, ['One', 'Two']);
      assert.notEqual(draft.data.questions[0].id, 'client-q1'); assert.ok(Number.isFinite(Date.parse(draft.data.createdAt)));
      assert.deepEqual(draft.data.questions.map((item) => item.number), [1, 2, 3]);
      assert.equal((await request(`/api/assessments/${draft.data.id}`)).status, 401);
      assert.deepEqual((await request(`/api/assessments/${draft.data.id}`, { cookie: cookieA })).data, draft.data);
      for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await request(`/api/assessments/${draft.data.id}`, { method, cookie: cookieB, ...(method === 'PUT' ? { body: { title: 'Intrusion', questions: [] } } : {}) })).status, 404);
      assert.equal((await request(`/api/questions/${draft.data.questions[0].id}`, { cookie: cookieB })).status, 404);
      const updated = await request(`/api/assessments/${draft.data.id}`, { method: 'PUT', cookie: cookieA, body: { title: 'Manual ready assessment', status: 'Siap digunakan', expectedUpdatedAt: draft.data.updatedAt, questions: [
        { ...draft.data.questions[2], text: 'Edited essay' }, draft.data.questions[0],
        { type: 'Isian Singkat', text: 'New question', correct: 'New answer' },
      ] } });
      assert.equal(updated.status, 200, updated.text); manualAssessment = updated.data;
      assert.equal(updated.data.questions[0].id, draft.data.questions[2].id); assert.equal(updated.data.questions[1].id, draft.data.questions[0].id);
      assert.equal(updated.data.questions[1].objective, 'Preserve this metadata'); assert.equal(updated.data.createdAt, draft.data.createdAt);
      assert.deepEqual(updated.data.questions.map((item) => item.number), [1, 2, 3]); assert.equal(updated.data.questionCount, 3);
      assert.equal((await request(`/api/questions/${draft.data.questions[1].id}`, { cookie: cookieA })).status, 404);
      assert.equal((await request(`/api/assessments/${draft.data.id}`, { method: 'PUT', cookie: cookieA, body: { title: 'Stale edit', expectedUpdatedAt: draft.data.updatedAt } })).status, 409);
      assert.deepEqual((await request(`/api/assessments/${draft.data.id}`, { cookie: cookieA })).data, updated.data);
      const foreignQuestion = teacherAssessment.questions[0];
      assert.equal((await request(`/api/assessments/${draft.data.id}`, { method: 'PUT', cookie: cookieA, body: { questions: [foreignQuestion] } })).status, 400);
      assert.equal((await request(`/api/assessments/${draft.data.id}`, { method: 'PUT', cookie: cookieA, body: { questions: [updated.data.questions[0], updated.data.questions[0]] } })).status, 400);
      assert.deepEqual((await request(`/api/assessments/${draft.data.id}`, { cookie: cookieA })).data, updated.data);
    });

    await t.test('assessment validation rejects invalid metadata, options and incomplete ready assessments atomically', async () => {
      const question = { type: 'Pilihan Ganda', text: 'Choose', options: ['One', 'Two'], correct: 'B' };
      const valid = { ...exam, title: 'Validation assessment', questions: [question] };
      const before = Number((await pool.query('SELECT count(*) FROM assessments')).rows[0].count);
      for (const body of [
        {}, { ...valid, title: ' ' }, { ...valid, subject: 5 }, { ...valid, grade: '' }, { ...valid, duration: '0 menit' }, { ...valid, duration: 601 }, { ...valid, status: 'Published' },
        { ...valid, questions: {} }, { ...valid, questions: Array(201).fill(question) }, { ...valid, questions: [null] },
        { ...valid, status: 'Siap digunakan', questions: [] }, { ...valid, status: 'Siap digunakan', questions: [{ text: 'Missing key' }] },
        { ...valid, questions: [{ ...question, options: ['One', 'one'] }] }, { ...valid, questions: [{ ...question, options: ['One', ''] }] },
        { ...valid, questions: [{ ...question, correct: 'F' }] }, { ...valid, questions: [{ ...question, correct: 1 }] }, { ...valid, questions: [{ ...question, type: 'Unknown' }] },
      ]) assert.equal((await request('/api/assessments', { method: 'POST', cookie: cookieA, body })).status, 400, JSON.stringify(body).slice(0, 250));
      assert.equal(Number((await pool.query('SELECT count(*) FROM assessments')).rows[0].count), before);
      const empty = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'Empty draft' } });
      assert.equal(empty.status, 201); assert.equal(empty.data.questionCount, 0); assert.deepEqual(empty.data.questions, []);
      const beforeReady = await request(`/api/assessments/${empty.data.id}`, { method: 'PUT', cookie: cookieA, body: { status: 'Siap digunakan' } });
      assert.equal(beforeReady.status, 400);
      assert.equal((await request(`/api/assessments/${empty.data.id}`, { cookie: cookieA })).data.status, 'Draft');
      await request(`/api/assessments/${empty.data.id}`, { method: 'DELETE', cookie: cookieA });
      await pool.query("ALTER TABLE questions ADD CONSTRAINT test_reject_update CHECK(payload->>'text' IS DISTINCT FROM 'reject-update')");
      try {
        const failed = await request(`/api/assessments/${manualAssessment.id}`, { method: 'PUT', cookie: cookieA, body: { title: 'Must not persist', questions: [manualAssessment.questions[1], { ...manualAssessment.questions[0], text: 'reject-update' }] } });
        assert.equal(failed.status, 400);
        assert.deepEqual((await request(`/api/assessments/${manualAssessment.id}`, { cookie: cookieA })).data, manualAssessment);
      } finally { await pool.query('ALTER TABLE questions DROP CONSTRAINT test_reject_update'); }
    });

    await t.test('direct question writes maintain counts and readiness; deleting a graded exam preserves results', async () => {
      const created = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'Direct edits' } });
      const id = created.data.id;
      const question = await request('/api/questions', { method: 'POST', cookie: cookieA, body: { assessmentId: id, type: 'Isian Singkat', text: 'Direct question', answer: 'Direct answer', ownerId: teacherB.id } });
      assert.equal(question.status, 201, question.text);
      const loaded = (await request(`/api/assessments/${id}`, { cookie: cookieA })).data;
      assert.equal(loaded.questionCount, 1); assert.equal(loaded.questions[0].number, 1);
      const aliasEdit = await request(`/api/questions/${question.data.id}`, { method: 'PUT', cookie: cookieA, body: { answer: 'Edited direct answer' } });
      assert.equal(aliasEdit.status, 200); assert.equal(aliasEdit.data.correct, 'Edited direct answer'); assert.equal(aliasEdit.data.answer, 'Edited direct answer');
      assert.ok((await request(`/api/assessments/${id}`, { cookie: cookieA })).data.updatedAt > loaded.updatedAt);
      assert.equal((await request(`/api/assessments/${id}`, { method: 'PUT', cookie: cookieA, body: { status: 'Siap digunakan' } })).status, 200);
      assert.equal((await request(`/api/questions/${question.data.id}`, { method: 'PUT', cookie: cookieA, body: { correct: '' } })).status, 400);
      assert.equal((await request(`/api/questions/${question.data.id}`, { method: 'DELETE', cookie: cookieA })).status, 400);
      assert.equal((await request(`/api/questions/${question.data.id}`, { method: 'PUT', cookie: cookieB, body: { text: 'Intrusion' } })).status, 404);
      await request(`/api/assessments/${id}`, { method: 'PUT', cookie: cookieA, body: { status: 'Draft' } });
      assert.equal((await request(`/api/questions/${question.data.id}`, { method: 'DELETE', cookie: cookieA })).status, 204);
      assert.equal((await request(`/api/assessments/${id}`, { cookie: cookieA })).data.questionCount, 0);
      const gradeQuestion = await request('/api/questions', { method: 'POST', cookie: cookieA, body: { assessmentId: id, type: 'Isian Singkat', text: 'Graded question', correct: 'Answer' } });
      await request(`/api/assessments/${id}`, { method: 'PUT', cookie: cookieA, body: { status: 'Siap digunakan' } });
      const gradeExam = (await request(`/api/assessments/${id}`, { cookie: cookieA })).data;
      const grade = await request('/api/grading', { method: 'POST', cookie: cookieA, body: { assessmentId: id, assessmentVersion: gradeExam.updatedAt, studentName: 'Existing result', answers: [{ questionId: gradeQuestion.data.id, response: 'Answer', points: 7 }] } });
      assert.equal(grade.status, 201);
      const blocked = await request(`/api/assessments/${id}`, { method: 'DELETE', cookie: cookieA });
      assert.equal(blocked.status, 409); assert.match(blocked.data.error, /hasil penilaian/);
      assert.equal((await request(`/api/grading/${grade.data.id}`, { cookie: cookieA })).status, 200);
      await request(`/api/grading/${grade.data.id}`, { method: 'DELETE', cookie: cookieA });
      await request(`/api/assessments/${id}`, { method: 'DELETE', cookie: cookieA });
      const disposable = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'Disposable exam', questions: [{ text: 'Disposable question' }] } });
      assert.equal((await request(`/api/assessments/${disposable.data.id}`, { method: 'DELETE', cookie: cookieA })).status, 204);
      assert.equal((await request(`/api/questions/${disposable.data.questions[0].id}`, { cookie: cookieA })).status, 404);
      assert.equal((await request(`/api/assessments/${disposable.data.id}`, { cookie: cookieA })).status, 404);
    });

    await t.test('print sheets require ownership and never serialize answer keys into the student document', async () => {
      const created = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'Printable assessment', questions: [
        { type: 'Pilihan Ganda', text: 'Print MC prompt', options: ['Print choice one', 'Print choice two'], correct: 'B', explanation: 'SECRET_MC_EXPLANATION' },
        { type: 'Isian Singkat', text: 'Print short prompt', correct: 'SECRET_SHORT_KEY', explanation: 'SECRET_SHORT_EXPLANATION' },
        { type: 'Essay', text: 'Print essay prompt', correct: 'SECRET_ESSAY_KEY', explanation: 'SECRET_ESSAY_EXPLANATION' },
      ] } });
      assert.equal(created.status, 201); const item = created.data;
      const base = `/guru/ulangan/${item.id}/cetak`;
      for (const kind of ['soal', 'kunci']) {
        const anonymous = await request(`${base}/${kind}`);
        assert.equal(anonymous.status, 307); assert.ok(anonymous.response.headers.get('location').startsWith('/login?next='));
        assert.equal((await request(`${base}/${kind}`, { cookie: cookieB })).status, 404);
        assert.equal((await request(`${base}/${kind}`, { cookie: adminCookie })).status, 200);
      }
      const sheet = await request(`${base}/soal`, { cookie: cookieA });
      const key = await request(`${base}/kunci`, { cookie: cookieA });
      assert.equal(sheet.status, 200); assert.equal(key.status, 200);
      for (const text of ['Printable assessment', 'Print MC prompt', 'Print short prompt', 'Print essay prompt', 'Print choice one', 'Print choice two', 'DRAFT', 'Ruang jawaban soal 2', 'Ruang jawaban soal 3']) assert.ok(sheet.text.includes(text), text);
      for (const secret of ['SECRET_MC_EXPLANATION', 'SECRET_SHORT_KEY', 'SECRET_SHORT_EXPLANATION', 'SECRET_ESSAY_KEY', 'SECRET_ESSAY_EXPLANATION']) {
        assert.equal(sheet.text.includes(secret), false, `${secret} must not appear anywhere in the question HTML/React payload`);
        assert.ok(key.text.includes(secret), secret);
      }
      assert.ok(key.text.includes('B. Print choice two')); assert.equal(key.text.includes('assessment-print-answer-lines'), false);
      assert.ok(sheet.text.indexOf('Print MC prompt') < sheet.text.indexOf('Print short prompt')); assert.ok(sheet.text.indexOf('Print short prompt') < sheet.text.indexOf('Print essay prompt'));
      assert.equal((await request(`${base}/unknown`, { cookie: cookieA })).status, 404);
      assert.equal((await request('/guru/ulangan/missing/cetak/soal', { cookie: cookieA })).status, 404);
      const edited = await request(`/api/assessments/${item.id}`, { method: 'PUT', cookie: cookieA, body: { title: 'Updated printable assessment', status: 'Siap digunakan', questions: [...item.questions].reverse() } });
      assert.equal(edited.status, 200);
      const updatedSheet = await request(`${base}/soal`, { cookie: cookieA });
      assert.ok(updatedSheet.text.includes('Updated printable assessment')); assert.equal(updatedSheet.text.includes('DRAFT — UNTUK DITINJAU'), false);
      assert.ok(updatedSheet.text.indexOf('Print essay prompt') < updatedSheet.text.indexOf('Print MC prompt'));
      for (const secret of ['SECRET_SHORT_KEY', 'SECRET_ESSAY_KEY', 'SECRET_MC_EXPLANATION']) assert.equal(updatedSheet.text.includes(secret), false);
      await request(`/api/assessments/${item.id}`, { method: 'DELETE', cookie: cookieA });
      for (const kind of ['soal', 'kunci']) assert.equal((await request(`${base}/${kind}`, { cookie: cookieA })).status, 404);
    });

    await t.test('empty and incomplete draft print previews remain truthful without inventing questions or keys', async () => {
      const empty = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'Empty printable draft' } });
      const base = `/guru/ulangan/${empty.data.id}/cetak`;
      for (const kind of ['soal', 'kunci']) {
        const preview = await request(`${base}/${kind}`, { cookie: cookieA });
        assert.equal(preview.status, 200); assert.ok(preview.text.includes('Belum ada soal untuk dicetak')); assert.match(preview.text, /<button[^>]*disabled/);
      }
      const added = await request(`/api/assessments/${empty.data.id}`, { method: 'PUT', cookie: cookieA, body: { questions: [{ type: 'Isian Singkat', text: 'Question without a saved key' }] } });
      assert.equal(added.status, 200);
      const key = await request(`${base}/kunci`, { cookie: cookieA }); assert.ok(key.text.includes('Belum diisi')); assert.ok(key.text.includes('Pembahasan belum ditambahkan.'));
      await request(`/api/assessments/${empty.data.id}`, { method: 'DELETE', cookie: cookieA });
    });

    await t.test('real grading derives scores, preserves exam snapshots, and isolates teacher results', async () => {
      const answers = [
        { questionId: manualAssessment.questions[0].id, response: 'An essay response', points: 7.5, feedback: 'Good reasoning' },
        { questionId: manualAssessment.questions[1].id, response: 'B', points: 999 },
        { questionId: manualAssessment.questions[2].id, response: '', points: 0 },
      ];
      const created = await request('/api/grading', { method: 'POST', cookie: cookieA, body: { assessmentId: manualAssessment.id, assessmentVersion: manualAssessment.updatedAt, studentName: '  Actual student  ', notes: 'Teacher notes', answers, score: 100, correct: 999, maxPoints: 1, ownerId: teacherB.id, status: 'Forged', assessmentSnapshot: { title: 'Forged exam' } } });
      assert.equal(created.status, 201, created.text); manualGrade = created.data;
      assert.equal(manualGrade.studentName, 'Actual student'); assert.equal(manualGrade.score, 58.33); assert.equal(manualGrade.earnedPoints, 17.5); assert.equal(manualGrade.maxPoints, 30);
      assert.equal(manualGrade.correct, 1); assert.equal(manualGrade.partial, 1); assert.equal(manualGrade.wrong, 1); assert.equal(manualGrade.unanswered, 1); assert.equal(manualGrade.status, 'Selesai');
      assert.equal(manualGrade.assessmentSnapshot.title, manualAssessment.title); assert.equal(manualGrade.assessmentSnapshot.questions[1].correct, 'B');
      assert.equal(manualGrade.answers[1].points, 10); assert.equal(manualGrade.answers[0].feedback, 'Good reasoning');
      assert.equal((await pool.query('SELECT owner_id FROM grading WHERE id=$1', [manualGrade.id])).rows[0].owner_id, teacherA.id);
      assert.equal((await request(`/api/grading/${manualGrade.id}`)).status, 401);
      for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await request(`/api/grading/${manualGrade.id}`, { method, cookie: cookieB, ...(method === 'PUT' ? { body: { studentName: 'Intrusion' } } : {}) })).status, 404);
      assert.deepEqual((await request('/api/grading', { cookie: cookieB })).data, []);
      assert.deepEqual((await request(`/api/grading/${manualGrade.id}`, { cookie: cookieA })).data, manualGrade);
      assert.equal((await request(`/api/grading/${manualGrade.id}`, { cookie: adminCookie })).status, 200);
      const updated = await request(`/api/grading/${manualGrade.id}`, { method: 'PUT', cookie: cookieA, body: { expectedUpdatedAt: manualGrade.updatedAt, studentName: 'Edited actual student', notes: 'Updated notes', createdAt: 'spoof', score: 100, answers: [
        { ...answers[0], points: 10 }, { ...answers[1], response: 'A' }, { ...answers[2], response: 'Reviewed short answer', points: 5 },
      ] } });
      assert.equal(updated.status, 200, updated.text); assert.equal(updated.data.score, 50); assert.equal(updated.data.createdAt, manualGrade.createdAt);
      assert.equal((await request(`/api/grading/${manualGrade.id}`, { method: 'PUT', cookie: cookieA, body: { expectedUpdatedAt: manualGrade.updatedAt, notes: 'Stale' } })).status, 409);
      manualGrade = updated.data;
      const changedExam = await request(`/api/assessments/${manualAssessment.id}`, { method: 'PUT', cookie: cookieA, body: { title: 'Exam changed after grading', questions: manualAssessment.questions.map((question, index) => index === 1 ? { ...question, correct: 'A' } : question) } });
      assert.equal(changedExam.status, 200); manualAssessment = changedExam.data;
      assert.equal((await request(`/api/grading/${manualGrade.id}`, { cookie: cookieA })).data.assessmentSnapshot.questions[1].correct, 'B');
      const rescored = await request(`/api/grading/${manualGrade.id}`, { method: 'PUT', cookie: cookieA, body: { answers: manualGrade.answers.map((answer, index) => index === 1 ? { ...answer, response: 'B' } : answer), assessmentSnapshot: manualAssessment } });
      assert.equal(rescored.status, 200); assert.equal(rescored.data.score, 83.33); assert.equal(rescored.data.assessmentSnapshot.questions[1].correct, 'B'); manualGrade = rescored.data;
      const dash = (await request('/api/dashboard', { cookie: cookieA })).data;
      assert.equal(dash.counts.graded, 1); assert.equal(dash.gradingSummary.average, 83.33); assert.equal(dash.recentResults[0].id, manualGrade.id);
    });

    await t.test('grading validation rejects invalid answers and stale exams without altering saved results', async () => {
      const valid = { studentName: 'Validation student', assessmentId: manualAssessment.id, assessmentVersion: manualAssessment.updatedAt, answers: manualAssessment.questions.map((question) => ({ questionId: question.id, response: question.correct, points: 10 })) };
      const first = valid.answers[0];
      const before = (await request('/api/grading', { cookie: cookieA })).data;
      for (const body of [
        { ...valid, studentName: ' ' }, { ...valid, studentName: 'x'.repeat(151) }, { ...valid, notes: {} },
        { ...valid, answers: [] }, { ...valid, answers: {} }, { ...valid, answers: [first, first, first] },
        { ...valid, answers: valid.answers.map((answer, index) => index === 0 ? { ...answer, questionId: 'foreign-question' } : answer) },
        ...[null, -1, 11, '10', 1.001].map((points) => ({ ...valid, answers: valid.answers.map((answer, index) => index === 0 ? { ...answer, points } : answer) })),
        { ...valid, answers: valid.answers.map((answer, index) => index === 0 ? { ...answer, response: '', points: 5 } : answer) },
        { ...valid, answers: valid.answers.map((answer, index) => index === 1 ? { ...answer, response: 'Z' } : answer) },
      ]) assert.equal((await request('/api/grading', { method: 'POST', cookie: cookieA, body })).status, 400, JSON.stringify(body).slice(0, 160));
      assert.equal((await request('/api/grading', { method: 'POST', cookie: cookieA, body: { ...valid, assessmentVersion: 'stale' } })).status, 409);
      assert.equal((await request('/api/grading', { method: 'POST', cookie: cookieB, body: valid })).status, 404);
      const draft = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'Not ready for grading' } });
      assert.equal((await request('/api/grading', { method: 'POST', cookie: cookieA, body: { ...valid, assessmentId: draft.data.id, assessmentVersion: draft.data.updatedAt, answers: [] } })).status, 400);
      await request(`/api/assessments/${draft.data.id}`, { method: 'DELETE', cookie: cookieA });
      assert.deepEqual((await request('/api/grading', { cookie: cookieA })).data, before);
      const invalidUpdate = await request(`/api/grading/${manualGrade.id}`, { method: 'PUT', cookie: cookieA, body: { answers: [] } });
      assert.equal(invalidUpdate.status, 400);
      assert.equal((await request(`/api/grading/${manualGrade.id}`, { method: 'PUT', cookie: cookieA, body: { assessmentId: teacherAssessment.id } })).status, 400);
      assert.deepEqual((await request(`/api/grading/${manualGrade.id}`, { cookie: cookieA })).data, manualGrade);
    });

    await t.test('MC blank answers score zero, summary averages update on deletion, and legacy summaries remain editable', async () => {
      const mc = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'MC score test', status: 'Siap digunakan', questions: [{ type: 'Pilihan Ganda', text: 'Choose', options: ['One', 'Two'], correct: 'A' }] } });
      const result = await request('/api/grading', { method: 'POST', cookie: cookieA, body: { studentName: 'Unanswered student', assessmentId: mc.data.id, assessmentVersion: mc.data.updatedAt, answers: [{ questionId: mc.data.questions[0].id, response: '', points: 10 }], score: 100 } });
      assert.equal(result.status, 201, result.text); assert.equal(result.data.score, 0); assert.equal(result.data.unanswered, 1); assert.equal(result.data.wrong, 1);
      assert.equal((await request('/api/dashboard', { cookie: cookieA })).data.gradingSummary.average, 41.67);
      assert.equal((await request(`/api/grading/${result.data.id}`, { method: 'DELETE', cookie: cookieA })).status, 204);
      assert.equal((await request(`/api/grading/${result.data.id}`, { cookie: cookieA })).status, 404);
      const dash = (await request('/api/dashboard', { cookie: cookieA })).data;
      assert.equal(dash.counts.graded, 1); assert.equal(dash.gradingSummary.average, 83.33);
      assert.equal((await request(`/api/assessments/${mc.data.id}`, { cookie: cookieA })).data.questions.length, 1);
      await request(`/api/assessments/${mc.data.id}`, { method: 'DELETE', cookie: cookieA });
      const legacy = snapshot.data.grading[0];
      const edited = await request(`/api/grading/${legacy.id}`, { method: 'PUT', cookie: adminCookie, body: { studentName: 'Edited legacy name', score: 88.25, notes: 'Summary only' } });
      assert.equal(edited.status, 200); assert.equal(edited.data.score, 88.25); assert.equal(edited.data.correct, legacy.correct); assert.equal(edited.data.wrong, legacy.wrong); assert.equal(edited.data.summaryOnly, true);
      assert.deepEqual(edited.data.originalSummary, { score: legacy.score, correct: legacy.correct, wrong: legacy.wrong });
      assert.equal((await request(`/api/grading/${legacy.id}`, { method: 'PUT', cookie: adminCookie, body: { score: 101 } })).status, 400);
      assert.equal((await request(`/api/grading/${legacy.id}`, { method: 'PUT', cookie: adminCookie, body: { answers: [] } })).status, 400);
      assert.equal((await request(`/api/grading/${legacy.id}`, { method: 'PUT', cookie: cookieA, body: { score: 0 } })).status, 404);
      await pool.query('UPDATE grading SET payload=$2 WHERE id=$1', [legacy.id, legacy]);
    });

    await t.test('individual printed reports preserve saved grading snapshots and restrict private data', async () => {
      const url = `/guru/penilaian/${manualGrade.id}/cetak`;
      assert.equal((await request(url)).status, 307); assert.equal((await request(url, { cookie: cookieB })).status, 404); assert.equal((await request(url, { cookie: adminCookie })).status, 200);
      const report = await request(url, { cookie: cookieA }); assert.equal(report.status, 200);
      for (const text of [manualGrade.studentName, manualGrade.assessmentSnapshot.title, '83,33', manualGrade.answers[0].response, manualGrade.answers[0].feedback, 'B. Two', 'Updated notes']) assert.ok(report.text.includes(text), text);
      assert.equal(report.text.includes(manualAssessment.title), false, 'Report uses the saved exam identity, not the revised live exam');
      const copied = await request('/api/grading', { method: 'POST', cookie: cookieA, body: { studentName: 'Disposable report student', assessmentId: manualAssessment.id, assessmentVersion: manualAssessment.updatedAt, answers: manualAssessment.questions.map((question) => ({ questionId: question.id, response: question.correct, points: 10 })) } });
      assert.equal(copied.status, 201);
      const path = `/guru/penilaian/${copied.data.id}/cetak`;
      assert.ok((await request(path, { cookie: cookieA })).text.includes('Disposable report student'));
      await request(`/api/grading/${copied.data.id}`, { method: 'PUT', cookie: cookieA, body: { studentName: 'Updated report student', notes: '<script>window.reportInjected = true</script>' } });
      const updated = await request(path, { cookie: cookieA }); assert.ok(updated.text.includes('Updated report student')); assert.ok(updated.text.includes('&lt;script&gt;')); assert.equal(updated.text.includes('<script>window.reportInjected'), false);
      await request(`/api/grading/${copied.data.id}`, { method: 'DELETE', cookie: cookieA }); assert.equal((await request(path, { cookie: cookieA })).status, 404);
      const legacy = await request(`/guru/penilaian/${snapshot.data.grading[0].id}/cetak`, { cookie: adminCookie }); assert.equal(legacy.status, 200); assert.ok(legacy.text.includes('Ringkasan lama')); assert.ok(legacy.text.includes('Rincian jawaban per soal tidak tersimpan')); assert.equal(legacy.text.includes('grading-print-question'), false);
      assert.equal((await request('/guru/penilaian/missing/cetak', { cookie: cookieA })).status, 404);
    });

    await t.test('assessment CSV exports only owned selected results with safe cells, UTF-8 and current saved scores', async () => {
      const path = `/api/assessments/${manualAssessment.id}/grades.csv`;
      assert.equal((await request(path)).status, 401); assert.equal((await request(path, { cookie: cookieB })).status, 404); assert.equal((await request(path, { cookie: adminCookie })).status, 200);
      assert.equal((await request('/api/assessments/missing/grades.csv', { cookie: cookieA })).status, 404);
      const answers = manualAssessment.questions.map((question) => ({ questionId: question.id, response: question.correct, points: 10 }));
      const ids = [];
      for (const notes of ['Catatan; "kutip"\nBaris kedua 你好', '=SUM(A1:A2)']) {
        const item = await request('/api/grading', { method: 'POST', cookie: cookieA, body: { studentName: '=SUM(1,1)', assessmentId: manualAssessment.id, assessmentVersion: manualAssessment.updatedAt, answers, notes } });
        assert.equal(item.status, 201); ids.push(item.data.id);
      }
      const downloaded = await fetch(`${app.baseUrl}${path}`, { headers: { Cookie: cookieA } });
      assert.equal(downloaded.status, 200); assert.match(downloaded.headers.get('content-type'), /text\/csv.*utf-8/); assert.match(downloaded.headers.get('content-disposition'), /^attachment; filename="nilai-[a-z0-9-]+\.csv"$/);
      assert.equal(downloaded.headers.get('x-export-row-count'), '3'); assert.match(downloaded.headers.get('cache-control'), /private.*no-store/);
      const bytes = Buffer.from(await downloaded.arrayBuffer()); assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
      const csv = bytes.toString('utf8'); assert.ok(csv.includes('"\'=SUM(1,1)"')); assert.ok(csv.includes('"\'=SUM(A1:A2)"'));
      assert.ok(csv.includes('"Catatan; ""kutip""\nBaris kedua 你好"')); assert.ok(csv.includes('"83,33"')); assert.ok(csv.includes(manualGrade.assessmentSnapshot.title));
      assert.equal(csv.includes(manualGrade.answers[0].response), false); assert.equal(csv.includes(manualGrade.assessmentSnapshot.questions[1].explanation), false);
      for (const id of ids) await request(`/api/grading/${id}`, { method: 'DELETE', cookie: cookieA });
      const refreshed = await request(path, { cookie: cookieA }); assert.equal(refreshed.response.headers.get('x-export-row-count'), '1'); assert.ok(refreshed.text.includes('"83,33"'));
      const empty = await request('/api/assessments', { method: 'POST', cookie: cookieA, body: { ...exam, title: 'CSV empty assessment' } });
      const emptyCsv = await request(`/api/assessments/${empty.data.id}/grades.csv`, { cookie: cookieA }); assert.equal(emptyCsv.status, 200); assert.equal(emptyCsv.response.headers.get('x-export-row-count'), '0'); assert.equal(emptyCsv.text.split('\r\n').length, 2);
      await request(`/api/assessments/${empty.data.id}`, { method: 'DELETE', cookie: cookieA });
      const legacy = await request('/api/assessments/assessment-1/grades.csv', { cookie: adminCookie }); assert.equal(legacy.status, 200); assert.ok(legacy.text.includes('Ringkasan lama')); assert.equal(Number(legacy.response.headers.get('x-export-row-count')), snapshot.data.grading.length);
    });

    await t.test('admin content CRUD, public reads, and fresh profile edits preserve API behavior', async () => {
      for (const name of ['activities', 'posts', 'agenda']) {
        const before = (await request(`/api/${name}`)).data;
        const created = await request(`/api/${name}`, { method: 'POST', cookie: adminCookie, body: { title: `New ${name}` } });
        assert.equal(created.status, 201);
        assert.equal((await request(`/api/${name}`)).data[0].id, created.data.id);
        assert.equal((await request(`/api/${name}/${created.data.id}`, { method: 'PUT', cookie: adminCookie, body: { title: 'Updated' } })).status, 200);
        const removed = await request(`/api/${name}/${created.data.id}`, { method: 'DELETE', cookie: adminCookie });
        assert.equal(removed.status, 204); assert.equal(removed.text, '');
        assert.deepEqual((await request(`/api/${name}`)).data, before);
      }
      const saved = await request('/api/site', { method: 'PUT', cookie: adminCookie, body: { meta: { schoolName: 'SQL Test School', address: 'SQL Test Address' } } });
      assert.equal(saved.status, 200);
      assert.equal((await request('/api/site')).data.meta.schoolName, 'SQL Test School');
      for (const url of ['/', '/index.html']) assert.ok((await request(url)).text.includes('SQL Test School'), url);
      assert.equal((await importLegacy(pool, adminId, snapshot)).skipped, true);
      assert.equal((await request('/api/site')).data.meta.schoolName, 'SQL Test School', 'Rerunning setup must not overwrite SQL edits');
    });

    await t.test('public homepage and article pages reflect saved profile, photos, news, agenda, edits, and deletions', async () => {
      const before = (await request('/api/site')).data;
      const image = `data:image/png;base64,${(await readFile(path.join(project, 'public/assets/logo-sekolah.png'))).toString('base64')}`;
      const meta = { schoolName: 'CMS Connected School', shortName: 'CMS School', heroTitle: 'CMS welcome heading', eyebrow: 'CMS welcome label',
        heroDescription: 'CMS welcome description', aboutTitle: 'CMS profile heading', aboutDescription: 'CMS profile intro', aboutBody: 'CMS school profile body',
        vision: 'CMS school vision', mission: 'CMS mission one\nCMS mission two', npsn: '12345678', schoolType: 'CMS school type', schoolStatus: 'CMS school status',
        year: '2031/2032', address: 'CMS school address', phone: '+62315550125', contactEmail: 'cms@example.test',
        instagramUrl: 'https://www.instagram.com/cms-school/', logoUrl: image, heroImageUrl: image };
      assert.equal((await request('/api/site', { method: 'PUT', cookie: adminCookie, body: { meta } })).status, 200);
      const gallery = await request('/api/activities', { method: 'POST', cookie: adminCookie, body: { title: 'CMS gallery entry', description: 'CMS gallery description', imageUrl: image, imageLabel: 'CMS gallery photo' } });
      const news = await request('/api/posts', { method: 'POST', cookie: adminCookie, body: { title: 'CMS full article', excerpt: 'CMS article summary', content: 'CMS full body\nSecond paragraph\n<script>window.cmsInjected = true</script>', category: 'CMS category', date: '2031-07-03', imageUrl: image, imageLabel: 'CMS news photo' } });
      const event = await request('/api/agenda', { method: 'POST', cookie: adminCookie, body: { title: 'CMS calendar event', description: 'CMS agenda description', date: '2031-07-03', time: '09.30–11.00' } });
      const legacyEvent = await request('/api/agenda', { method: 'POST', cookie: adminCookie, body: { title: 'CMS legacy date event', date: '12 Juli 2031', time: '12.00' } });
      for (const result of [gallery, news, event, legacyEvent]) assert.equal(result.status, 201, result.text);
      for (const url of ['/', '/index.html']) {
        const page = await request(url);
        assert.equal(page.status, 200, url);
        for (const text of ['CMS Connected School', 'CMS welcome heading', 'CMS welcome label', 'CMS welcome description', 'CMS profile heading', 'CMS school profile body',
          'CMS school vision', 'CMS mission one', 'CMS mission two', '12345678', 'CMS school type', 'CMS school status', '2031/2032', 'CMS school address',
          'cms@example.test', 'CMS gallery entry', 'CMS gallery description', 'CMS gallery photo', 'CMS full article', 'CMS article summary', 'CMS calendar event',
          'CMS agenda description', '3 Juli 2031', '12 Juli 2031', '/berita/' + news.data.id, 'https://www.instagram.com/cms-school/']) assert.ok(page.text.includes(text), `${url}: ${text}`);
        assert.ok(!page.text.includes('/assets/kegiatan-1.jpg'));
        assert.ok(!page.text.includes('bukan jadwal aktif'));
      }
      const articlePath = `/berita/${news.data.id}`;
      const article = await request(articlePath);
      assert.equal(article.status, 200);
      assert.ok(article.text.includes('CMS full body'));
      assert.ok(article.text.includes('Second paragraph'));
      assert.ok(article.text.includes('&lt;script&gt;'));
      assert.ok(!article.text.includes('<script>window.cmsInjected'));
      assert.equal((await request(`/api/posts/${news.data.id}`, { method: 'PUT', cookie: adminCookie, body: { title: 'CMS edited article', content: 'CMS edited full body' } })).status, 200);
      assert.ok((await request(articlePath)).text.includes('CMS edited full body'));
      await request(`/api/activities/${gallery.data.id}`, { method: 'PUT', cookie: adminCookie, body: { title: 'CMS edited gallery', imageLabel: 'CMS updated photo', imageUrl: '' } });
      assert.ok((await request('/')).text.includes('CMS edited gallery'));
      await request(`/api/agenda/${event.data.id}`, { method: 'PUT', cookie: adminCookie, body: { date: '2031-08-15', title: 'CMS rescheduled event' } });
      const updated = await request('/');
      assert.ok(updated.text.includes('15 Agustus 2031'));
      assert.ok(updated.text.includes('CMS rescheduled event'));
      for (const [collection, item] of [['activities', gallery], ['posts', news], ['agenda', event], ['agenda', legacyEvent]]) {
        assert.equal((await request(`/api/${collection}/${item.data.id}`, { method: 'DELETE', cookie: adminCookie })).status, 204);
      }
      assert.equal((await request(articlePath)).status, 404);
      const removed = await request('/');
      for (const text of ['CMS edited article', 'CMS edited gallery', 'CMS rescheduled event', 'CMS legacy date event']) assert.ok(!removed.text.includes(text));
      await request('/api/site', { method: 'PUT', cookie: adminCookie, body: { meta: before.meta } });
    });

    await t.test('empty CMS collections show empty states and bad image URLs or dates cannot corrupt saved content', async () => {
      const saved = await pool.query("SELECT * FROM public_records WHERE collection IN ('activities', 'posts', 'agenda')");
      await pool.query("DELETE FROM public_records WHERE collection IN ('activities', 'posts', 'agenda')");
      try {
        const page = await request('/');
        for (const text of ['Belum ada kegiatan yang dibagikan.', 'Belum ada berita yang dibagikan.', 'Belum ada agenda yang dijadwalkan.']) assert.ok(page.text.includes(text));
        const before = (await request('/api/site')).data;
        for (const [url, body] of [
          ['/api/posts', { title: 'Bad photo', imageUrl: 'javascript:alert(1)' }],
          ['/api/agenda', { title: 'Invalid calendar date', date: '2031-02-31' }],
          ['/api/agenda', { title: 'Wrong date type', date: 123 }],
        ]) assert.equal((await request(url, { method: 'POST', cookie: adminCookie, body })).status, 400);
        assert.equal((await request('/api/site', { method: 'PUT', cookie: adminCookie, body: { meta: { heroImageUrl: 'data:text/html,<script>alert(1)</script>' } } })).status, 400);
        assert.equal((await request('/api/site', { method: 'PUT', cookie: adminCookie, body: { meta: { contactEmail: 'invalid-email' } } })).status, 400);
        assert.deepEqual((await request('/api/site')).data, before);
      } finally {
        for (const row of saved.rows) await pool.query('INSERT INTO public_records(collection,id,payload,position) VALUES($1,$2,$3,$4)', [row.collection, row.id, row.payload, row.position]);
      }
    });

    await t.test('authenticated pages and static assets render without exposing configuration files', async () => {
      for (const [url, cookie, marker] of [['/admin', adminCookie, 'WORKSPACE ADMIN'], ['/guru', cookieA, 'WORKSPACE GURU']]) {
        const result = await request(url, { cookie }); assert.equal(result.status, 200, url); assert.ok(result.text.includes(marker), url);
      }
      assert.equal((await request('/admin', { cookie: cookieA })).status, 307);
      const generator = await request('/ai-learning-generator.html', { cookie: cookieA });
      assert.equal(generator.status, 200);
      assert.equal(generator.text, await readFile(path.join(project, 'templates/ai-learning-generator.html'), 'utf8'));
      for (const name of ['ai-learning-generator.css', 'ai-learning-generator.js', 'styles.css', 'style.css', 'script.js']) {
        const response = await fetch(`${app.baseUrl}/${name}`); assert.equal(response.status, 200, name);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(path.join(project, 'public', name)), name);
      }
      for (const url of ['/.env', '/.env.local', '/data/db.json', '/lib/database.js', '/templates/ai-learning-generator.html']) assert.equal((await request(url)).status, 404, url);
    });

    await t.test('CSRF, invalid payloads, unknown collections, and the 20 MiB size limit are enforced', async () => {
      assert.equal((await request('/api/materials', { method: 'POST', cookie: cookieA, headers: { Origin: 'https://other.example' }, body: {} })).status, 403);
      assert.equal((await request('/api/auth/logout', { method: 'POST', cookie: cookieA, headers: { Origin: 'https://other.example' } })).status, 403);
      assert.equal((await request('/api/me', { cookie: cookieA })).status, 200);
      for (const body of [null, [], 'invalid', 5]) assert.equal((await request('/api/materials', { method: 'POST', cookie: cookieA, body })).status, 400);
      assert.equal((await request('/api/no-such-collection', { cookie: adminCookie })).status, 404);
      const malformed = await fetch(`${app.baseUrl}/api/site`, { method: 'PUT', headers: { Cookie: adminCookie, 'Content-Type': 'application/json' }, body: '{' });
      assert.equal(malformed.status, 400);
      const large = await request('/api/materials', { method: 'POST', cookie: cookieA, body: { ...lesson, title: 'Long lesson', content: 'x'.repeat(1024 * 1024 + 1) } });
      assert.equal(large.status, 201);
      await request(`/api/materials/${large.data.id}`, { method: 'DELETE', cookie: cookieA });
      assert.equal((await request('/api/materials', { method: 'POST', cookie: cookieA, body: { content: 'x'.repeat(20 * 1024 * 1024) } })).status, 413);
    });

    await t.test('authenticated AI calls retain generation, parsing, reference suggestions, and failure handling', async () => {
      const config = { subject: 'IPA', grade: 'Kelas 5 SD', topic: 'Pernapasan', objective: 'Memahami organ', reference: { title: 'Buku IPA' } };
      const sections = [{ id: 'inti', title: 'Materi Inti', body: 'Isi materi.' }];
      providerResponse = { content: '```json\n' + JSON.stringify({ sections }) + '\n```' };
      const material = await request('/api/ai/generate-material', { method: 'POST', cookie: cookieA, body: config });
      assert.equal(material.status, 200); assert.deepEqual(material.data.sections, sections);
      assert.deepEqual(JSON.parse(calls.at(-1).body.messages[1].content).referensi, config.reference);
      assert.equal(calls.at(-1).authorization, 'Bearer migration-test-key');
      assert.equal(calls.at(-1).body.max_tokens, 6000);
      providerResponse = { content: JSON.stringify({ questions: [{ type: 'Isian Singkat', text: 'Apa fungsi paru-paru?', correct: 'Bernapas' }] }) };
      const questions = await request('/api/ai/generate-questions', { method: 'POST', cookie: cookieA, body: { ...config, total: 1 } });
      assert.equal(questions.status, 200); assert.deepEqual(questions.data.questions[0].options, []); assert.equal(questions.data.questions[0].quality, 'ok');
      providerResponse = { content: JSON.stringify({ results: Array.from({ length: 6 }, (_, index) => ({ title: `Book ${index}` })) }) };
      assert.equal((await request('/api/ai/search-reference', { method: 'POST', cookie: cookieA, body: { title: 'IPA' } })).data.results.length, 5);
      providerResponse = { content: 'Ringkasan hasil.' };
      assert.deepEqual((await request('/api/ai/analyze-assessment', { method: 'POST', cookie: cookieA, body: { results: [{ score: 80 }] } })).data, { analysis: 'Ringkasan hasil.' });
      providerResponse = { status: 503 };
      assert.equal((await request('/api/ai/generate-material', { method: 'POST', cookie: cookieA, body: config })).status, 502);
      providerResponse = { content: 'not JSON' };
      assert.equal((await request('/api/ai/generate-questions', { method: 'POST', cookie: cookieA, body: config })).status, 502);
    });

    await t.test('password resets and account disabling immediately invalidate existing teacher sessions', async () => {
      const changed = 'Changed-teacher-password-2026';
      assert.equal((await request(`/api/admin/users/${teacherA.id}`, { method: 'PUT', cookie: adminCookie, body: { password: changed } })).status, 200);
      assert.equal((await request('/api/me', { cookie: cookieA })).status, 401);
      assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: teacherA.email, password: teacherPassword, role: 'guru' } })).status, 401);
      cookieA = (await login(teacherA.email, changed, 'guru')).cookie;
      assert.equal((await request(`/api/admin/users/${teacherA.id}`, { method: 'PUT', cookie: adminCookie, body: { active: false } })).status, 200);
      assert.equal((await request('/api/me', { cookie: cookieA })).status, 401);
      assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: teacherA.email, password: changed, role: 'guru' } })).status, 401);
      await request(`/api/admin/users/${teacherA.id}`, { method: 'PUT', cookie: adminCookie, body: { active: true } });
      cookieA = (await login(teacherA.email, changed, 'guru')).cookie;
    });

    await t.test('sessions and SQL edits persist after restart; logout and expiration revoke access', async () => {
      await app.close(); app = await startApp(fixture, database.url, schema, providerUrl);
      assert.equal((await request('/api/me', { cookie: cookieA })).data.user.id, teacherA.id);
      assert.equal((await request('/api/materials', { cookie: cookieA })).data[0].title, 'Edited lesson');
      assert.deepEqual((await request(`/api/assessments/${manualAssessment.id}`, { cookie: cookieA })).data, manualAssessment);
      assert.deepEqual((await request(`/api/grading/${manualGrade.id}`, { cookie: cookieA })).data, manualGrade);
      assert.equal((await request('/api/site')).data.meta.schoolName, 'SQL Test School');
      assert.equal((await request('/api/auth/logout', { method: 'POST', cookie: cookieB })).status, 200);
      assert.equal((await request('/api/me', { cookie: cookieB })).status, 401);
      await pool.query("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [teacherA.id]);
      assert.equal((await request('/api/me', { cookie: cookieA })).status, 401);
      const count = calls.length;
      assert.equal((await request('/api/ai/generate-material', { method: 'POST', cookie: cookieA, body: {} })).status, 401);
      assert.equal(calls.length, count);
    });

    await t.test('repeated invalid logins are rate limited', async () => {
      const body = { email: 'limited@example.test', password: teacherPassword, role: 'guru' };
      for (let index = 0; index < 10; index += 1) assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 401);
      assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 429);
    });
  } finally {
    await app?.close(); await stop(provider);
    if (pool) {
      assert.match(schema, /^sdn_test_[a-f0-9]{32}$/);
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await pool.end();
    }
    await database?.close();
    assert.equal(path.dirname(fixture), path.resolve(tmpdir()));
    assert.ok(path.basename(fixture).startsWith('sdn-sql-auth-'));
    await rm(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    assert.deepEqual(await readFile(path.join(project, 'data/db.json')), originalJson, 'Original JSON must remain unchanged');
  }
});

test('local setup provisions a non-superuser database, imports once, and preserves SQL edits on rerun', { timeout: 120_000 }, async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'sdn-setup-test-'));
  let database;
  let pool;
  try {
    database = await testDatabase();
    if (process.env.TEST_DATABASE_URL) return; // Provisioning is exercised only on a cluster owned by this test.
    const connection = new URL(database.url);
    for (const name of ['db', 'data']) await cp(path.join(project, name), path.join(fixture, name), { recursive: true });
    const runSetup = () => new Promise((resolve, reject) => {
      const environment = { ...process.env, POSTGRES_ADMIN_USER: connection.username,
        POSTGRES_ADMIN_PASSWORD: connection.password, POSTGRES_ADMIN_PORT: connection.port,
        ADMIN_EMAIL: 'bootstrap@example.test', ADMIN_PASSWORD: '' };
      delete environment.DATABASE_URL;
      delete environment.DATABASE_SCHEMA;
      delete environment.__NEXT_PROCESSED_ENV;
      const child = spawn(process.execPath, [path.join(project, 'scripts/setup-database.cjs')], {
        cwd: fixture, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: environment,
      });
      let logs = '';
      child.stdout.on('data', (chunk) => { logs += chunk; });
      child.stderr.on('data', (chunk) => { logs += chunk; });
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolve(logs) : reject(new Error(`Setup command failed (${code}): ${logs}`)));
    });
    await runSetup();
    const env = await readFile(path.join(fixture, '.env.local'), 'utf8');
    const value = env.match(/^DATABASE_URL=(.+)$/m)[1];
    const url = JSON.parse(value);
    assert.equal(new URL(url).username, 'sdn_bangah_app');
    assert.ok(!env.includes('POSTGRES_ADMIN_PASSWORD'));
    pool = new Pool({ connectionString: url });
    const role = (await pool.query('SELECT rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user')).rows[0];
    assert.deepEqual(role, { rolsuper: false, rolcreaterole: false, rolcreatedb: false });
    const user = (await pool.query("SELECT * FROM users WHERE role = 'admin'")).rows[0];
    assert.equal(user.email, 'bootstrap@example.test');
    const credentials = await readFile(path.join(fixture, '.local/setup/admin-credentials.txt'), 'utf8');
    const password = credentials.match(/^Password: (.+)$/m)[1];
    const { verifyPassword } = require('../lib/passwords');
    assert.equal(await verifyPassword(password, user.password_hash), true);
    assert.equal(Number((await pool.query('SELECT count(*) FROM legacy_imports')).rows[0].count), 1);
    await pool.query("UPDATE site_settings SET meta = meta || '{\"schoolName\":\"Retained SQL edit\"}'::jsonb WHERE id = 1");
    await runSetup();
    assert.equal((await pool.query('SELECT meta FROM site_settings WHERE id = 1')).rows[0].meta.schoolName, 'Retained SQL edit');
    assert.equal(Number((await pool.query('SELECT count(*) FROM users')).rows[0].count), 1);
  } finally {
    await pool?.end();
    await database?.close();
    assert.equal(path.dirname(fixture), path.resolve(tmpdir()));
    assert.ok(path.basename(fixture).startsWith('sdn-setup-test-'));
    await rm(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
