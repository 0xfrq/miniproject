const { schemaName } = require('./database');

async function provisionRuntimeRole(pool, role, password) {
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(role || '') || ['postgres', 'anon', 'authenticated', 'service_role', 'authenticator'].includes(role) || role.startsWith('pg_') || role.startsWith('supabase')) {
    throw new Error('Choose a dedicated APP_DATABASE_ROLE such as sdn_bangah_app.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sdn-runtime-role:${role}`]);
    const existing = (await client.query('SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolreplication FROM pg_roles WHERE rolname = $1', [role])).rows[0];
    if (existing && Object.values(existing).some(Boolean)) throw new Error('Existing runtime role has elevated privileges. Use a dedicated restricted role.');
    if (!existing) {
      if (typeof password !== 'string' || password.length < 24) throw new Error('APP_DATABASE_PASSWORD must have at least 24 characters.');
      const statement = (await client.query("SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', $1::text, $2::text) AS sql", [role, password])).rows[0].sql;
      await client.query(statement);
    }
    const schema = schemaName();
    await client.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${role}"`);
    for (const table of ['users', 'sessions', 'login_attempts', 'site_settings', 'public_records', 'materials', 'assessments', 'questions', 'grading', 'books', 'book_chunks', 'ai_conversations', 'ai_messages']) {
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "${schema}"."${table}" TO "${role}"`);
    }
    for (const sequence of ['public_records_position_seq', 'materials_position_seq', 'assessments_position_seq', 'questions_position_seq', 'grading_position_seq', 'ai_messages_id_seq']) {
      await client.query(`GRANT USAGE, SELECT ON SEQUENCE "${schema}"."${sequence}" TO "${role}"`);
    }
    await client.query(`GRANT EXECUTE ON FUNCTION "${schema}".vector_dot(real[], real[]) TO "${role}"`);
    await client.query('COMMIT');
    return { created: !existing };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

module.exports = { provisionRuntimeRole };
