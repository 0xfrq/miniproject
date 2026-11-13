import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

function run(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(`PostgreSQL test helper failed (${code}): ${output}`)));
  });
}

export async function testDatabase() {
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Tests require a local database');
    return { url: process.env.TEST_DATABASE_URL, close: async () => {} };
  }
  const directory = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '/usr/lib/postgresql/18/bin');
  const extension = process.platform === 'win32' ? '.exe' : '';
  const initdb = path.join(directory, `initdb${extension}`);
  const pgctl = path.join(directory, `pg_ctl${extension}`);
  try { await access(initdb); }
  catch { throw new Error('Set PG_BIN to the PostgreSQL bin directory, or TEST_DATABASE_URL to a local test connection.'); }
  const scratch = await mkdtemp(path.join(tmpdir(), 'sdn-pg-test-'));
  const data = path.join(scratch, 'cluster');
  const password = randomBytes(24).toString('base64url');
  const passwordFile = path.join(scratch, 'init-password');
  await writeFile(passwordFile, password, { mode: 0o600 });
  let started = false;
  const close = async () => {
    if (started) { await run(pgctl, ['-D', data, '-w', 'stop', '-m', 'fast']); started = false; }
    assert.equal(path.dirname(scratch), path.resolve(tmpdir()));
    assert.ok(path.basename(scratch).startsWith('sdn-pg-test-'));
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  };
  try {
    await run(initdb, ['-D', data, '--username=sdn_test_admin', '--auth=scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C']);
    const reserve = createServer();
    reserve.listen(0, '127.0.0.1');
    await once(reserve, 'listening');
    const port = reserve.address().port;
    await new Promise((resolve) => reserve.close(resolve));
    await run(pgctl, ['-D', data, '-l', path.join(scratch, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
    started = true;
    return { url: `postgresql://sdn_test_admin:${password}@127.0.0.1:${port}/postgres`, close };
  } catch (error) {
    await close();
    throw error;
  }
}
