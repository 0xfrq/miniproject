const { Pool } = require('pg');

function poolOptions(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const url = new URL(connectionString);
  const transactionPooler = process.env.DATABASE_POOL_MODE === 'transaction' ||
    (process.env.DATABASE_POOL_MODE !== 'session' && (process.env.VERCEL === '1' || url.port === '6543'));
  if (transactionPooler && schemaName() !== 'public') {
    throw new Error('Transaction pooler memerlukan DATABASE_SCHEMA=public. Gunakan session pooler untuk schema lain.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  // URL SSL options override the explicit pg ssl object. Remote connections must
  // verify certificates, including when a project-specific CA is configured.
  for (const name of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'ssl', 'uselibpqcompat']) url.searchParams.delete(name);
  if (transactionPooler) url.searchParams.delete('options');
  const max = Number(process.env.DATABASE_POOL_MAX || (process.env.VERCEL === '1' ? 2 : 5));
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new Error('DATABASE_POOL_MAX harus antara 1 dan 20.');
  return {
    connectionString: url.toString(),
    ...(transactionPooler ? {} : { options: `-c search_path=${schemaName()}` }),
    ssl: local ? false : { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n') } : {}) },
    max, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000,
    application_name: 'sdn-bangah-platform',
  };
}

function schemaName() {
  const name = process.env.DATABASE_SCHEMA || 'public';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error('Nama schema database tidak valid.');
  return name;
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('Database belum dikonfigurasi. Jalankan npm run db:setup.');
    error.status = 503;
    throw error;
  }
  const options = poolOptions();
  const key = JSON.stringify(options);
  if (!globalThis.__sdnDatabase || globalThis.__sdnDatabase.key !== key) {
    globalThis.__sdnDatabase = {
      key,
      pool: new Pool(options),
    };
    globalThis.__sdnDatabase.pool.on('error', () => console.error('Koneksi PostgreSQL terputus.'));
  }
  return globalThis.__sdnDatabase.pool;
}

async function transaction(task) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await task(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

module.exports = { getPool, schemaName, transaction, poolOptions };
