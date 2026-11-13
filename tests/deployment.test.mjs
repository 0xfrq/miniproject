import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { testDatabase } from './postgres-helper.mjs';

const require = createRequire(import.meta.url);
const db = require('../lib/database');
const { Pool } = require('pg');
const { bootstrap } = require('../lib/cloud-bootstrap');
const { provisionRuntimeRole } = require('../lib/runtime-role');
const { verifyPassword } = require('../lib/passwords');
const storage = require('../lib/storage');
const limits = require('../lib/request-limits');
const { readObject } = require('../lib/api');
const ai = require('../lib/ai-client');

async function withEnv(values, task) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    return await task();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('remote pooling verifies TLS and rejects unsafe schema/session options', async () => {
  await withEnv({ VERCEL: '1', DATABASE_SCHEMA: 'public', DATABASE_POOL_MODE: 'transaction', DATABASE_POOL_MAX: '2', DATABASE_SSL_CA: 'certificate\\ncontents' }, () => {
    const config = db.poolOptions('postgresql://app:secret@db.example:6543/postgres?sslmode=no-verify&options=-c%20search_path%3Dother');
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.ca, 'certificate\ncontents');
    assert.equal(config.max, 2);
    assert.equal(config.options, undefined);
    assert.equal(new URL(config.connectionString).search, '');
    process.env.DATABASE_SCHEMA = 'wrong_schema';
    assert.throws(() => db.poolOptions('postgresql://app:secret@db.example:6543/postgres'), /DATABASE_SCHEMA=public/);
  });
});

test('complete OCR body is capped in browser helper and streamed server input', async () => {
  assert.deepEqual(JSON.parse(limits.ocrRequestBody('exam', ['data:image/jpeg;base64,AA=='])).assessmentId, 'exam');
  assert.throws(() => limits.ocrRequestBody('exam', ['A'.repeat(limits.MAX_OCR_BODY_BYTES)]), /Total foto/);
  const request = new Request('https://school.example/api/ai/ocr-grading', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images: ['A'.repeat(limits.MAX_OCR_BODY_BYTES)] }),
  });
  await assert.rejects(readObject(request, 'Invalid', limits.MAX_OCR_BODY_BYTES), { status: 413 });
});

test('AI fails closed without an explicitly configured endpoint', async () => {
  await withEnv({ AI_BASE_URL: undefined, AI_API_KEY: 'test-key' }, async () => {
    assert.equal(ai.status().configured, false);
    await assert.rejects(ai.askModel([]), { code: 'AI_NOT_CONFIGURED', status: 503 });
    await assert.rejects(ai.embed(['test']), { code: 'AI_NOT_CONFIGURED', status: 503 });
  });
});

test('image signing authorizes admins and never exposes the service key', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  await withEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-secret', SUPABASE_STORAGE_BUCKET: 'school-images' }, async () => {
    try {
      globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return Response.json({ url: new URL(url).pathname.replace('/storage/v1', '') + '?token=signed-test-token' });
      };
      await assert.rejects(storage.signedImageUpload({ role: 'guru' }, { type: 'image/jpeg', size: 100 }), { status: 403 });
      await assert.rejects(storage.signedImageUpload({ role: 'admin' }, { type: 'image/svg+xml', size: 100 }), { status: 400 });
      await assert.rejects(storage.signedImageUpload({ role: 'admin' }, { type: 'image/jpeg', size: 5_000_000 }), { status: 400 });
      assert.equal(calls.length, 0);
      const result = await storage.signedImageUpload({ role: 'admin', id: randomUUID() }, { type: 'image/jpeg', size: 100 });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].options.headers.Authorization, 'Bearer test-service-secret');
      assert.match(result.uploadUrl, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/upload\/sign\/school-images\/cms\//);
      assert.match(result.publicUrl, /\/object\/public\/school-images\/cms\/.*\.jpg$/);
      assert.equal(JSON.stringify(result).includes('test-service-secret'), false);
      globalThis.fetch = async () => Response.json({ url: 'https://attacker.example/upload?token=x' });
      await assert.rejects(storage.signedImageUpload({ role: 'admin', id: randomUUID() }, { type: 'image/png', size: 100 }), { status: 502 });
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('bucket setup enforces image restrictions and leaves incompatible existing buckets unchanged', async () => {
  const originalFetch = globalThis.fetch;
  await withEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key', SUPABASE_STORAGE_BUCKET: 'school-images' }, async () => {
    try {
      const methods = [];
      globalThis.fetch = async (url, options) => {
        methods.push(options.method || 'GET');
        if (methods.length === 1) return Response.json({ statusCode: '404' }, { status: 400 });
        const config = JSON.parse(options.body);
        assert.equal(config.public, true);
        assert.equal(config.file_size_limit, 4 * 1024 * 1024);
        assert.equal(config.allowed_mime_types.includes('image/svg+xml'), false);
        return Response.json(config);
      };
      assert.deepEqual(await storage.setupBucket(), { created: true });
      assert.deepEqual(methods, ['GET', 'POST']);
      globalThis.fetch = async () => Response.json({ public: true, file_size_limit: null, allowed_mime_types: null });
      await assert.rejects(storage.setupBucket(), /No settings were changed/);
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('cloud bootstrap is repeatable and runtime role can CRUD without owning migration tables', { timeout: 120_000 }, async () => {
  const database = await testDatabase();
  const schema = `sdn_test_${randomUUID().replaceAll('-', '')}`;
  const role = `sdn_app_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const password = 'Runtime-database-password-for-tests';
  const pool = new Pool({ connectionString: database.url, options: `-c search_path=${schema}` });
  let runtimePool;
  const apiRoles = [];
  try {
    if (!process.env.TEST_DATABASE_URL) {
      // Reproduce Supabase's automatic grants only in the disposable cluster.
      await pool.query(`CREATE SCHEMA "${schema}"`);
      for (const apiRole of ['anon', 'authenticated']) {
        await pool.query(`CREATE ROLE "${apiRole}" NOLOGIN`);
        apiRoles.push(apiRole);
        await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT ALL ON TABLES TO "${apiRole}"`);
        await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT ALL ON SEQUENCES TO "${apiRole}"`);
      }
    }
    await withEnv({ DATABASE_SCHEMA: schema }, async () => {
      await assert.rejects(bootstrap(pool, { email: 'admin@example.com', password: 'short' }), /12/);
      assert.equal((await pool.query('SELECT count(*) FROM users')).rows[0].count, '0');
      const first = await bootstrap(pool, { email: 'admin@example.com', password: 'Initial-admin-password-2026' });
      assert.equal(first.created, true);
      assert.equal(first.imported.skipped, false);
      for (const apiRole of apiRoles) {
        const privileges = (await pool.query(`SELECT has_table_privilege($1, $2, 'SELECT') AS can_read,
          has_table_privilege($1, $2, 'INSERT') AS can_insert,
          has_sequence_privilege($1, $3, 'USAGE') AS can_use_sequence`,
        [apiRole, `${schema}.users`, `${schema}.ai_messages_id_seq`])).rows[0];
        assert.deepEqual(privileges, { can_read: false, can_insert: false, can_use_sequence: false });
      }
      assert.equal((await pool.query('SELECT count(*) FROM assessments')).rows[0].count, '0');
      await pool.query("UPDATE site_settings SET meta = jsonb_set(meta, '{schoolName}', '\"Kept school\"') WHERE id = 1");
      const second = await bootstrap(pool, { email: 'other@example.com', password: 'Replacement-password-2026' });
      assert.equal(second.created, false);
      assert.equal(second.imported.skipped, true);
      assert.equal(first.admin.id, second.admin.id);
      assert.equal((await pool.query('SELECT meta FROM site_settings')).rows[0].meta.schoolName, 'Kept school');
      assert.equal(await verifyPassword('Initial-admin-password-2026', (await pool.query('SELECT password_hash FROM users')).rows[0].password_hash), true);
      assert.deepEqual(await provisionRuntimeRole(pool, role, password), { created: true });
      assert.deepEqual(await provisionRuntimeRole(pool, role, 'ignored'), { created: false });
      const url = new URL(database.url); url.username = role; url.password = password;
      runtimePool = new Pool({ connectionString: url.toString(), options: `-c search_path=${schema}` });
      assert.equal((await runtimePool.query('SELECT count(*) FROM users')).rows[0].count, '1');
      await runtimePool.query("INSERT INTO public_records(collection, id, payload) VALUES('posts', 'runtime-post', '{}')");
      await runtimePool.query("UPDATE public_records SET payload = '{\"title\":\"Runtime\"}' WHERE id = 'runtime-post'");
      await runtimePool.query("DELETE FROM public_records WHERE id = 'runtime-post'");
      assert.equal((await runtimePool.query("SELECT vector_dot('{1,2}'::real[], '{3,4}'::real[]) AS value")).rows[0].value, 11);
      await assert.rejects(runtimePool.query('SELECT * FROM schema_migrations'), { code: '42501' });
      await assert.rejects(runtimePool.query('CREATE TABLE should_not_create(id int)'), { code: '42501' });
    });
  } finally {
    if (runtimePool) await runtimePool.end();
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.query(`DROP ROLE IF EXISTS "${role}"`);
    for (const apiRole of apiRoles) await pool.query(`DROP ROLE "${apiRole}"`);
    await pool.end();
    await database.close();
  }
});
