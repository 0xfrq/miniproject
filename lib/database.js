const { Pool } = require('pg');

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
  const key = `${process.env.DATABASE_URL}|${schemaName()}`;
  if (!globalThis.__sdnDatabase || globalThis.__sdnDatabase.key !== key) {
    globalThis.__sdnDatabase = {
      key,
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
        options: `-c search_path=${schemaName()}`,
        max: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
        application_name: 'sdn-bangah-platform',
      }),
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

module.exports = { getPool, schemaName, transaction };
