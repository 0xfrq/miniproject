const { randomUUID } = require('node:crypto');
const db = require('./database');
const { ApiError } = require('./api');
const { hashPassword } = require('./passwords');
const { publicUser } = require('./auth');

function emailAddress(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new ApiError(400, 'Alamat email tidak valid.');
  return value.trim().toLowerCase();
}

function displayName(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw new ApiError(400, 'Nama wajib diisi, maksimal 120 karakter.');
  return value.trim();
}

function shortText(value = '') {
  if (typeof value !== 'string' || value.length > 120) throw new ApiError(400, 'Data kelas atau tahun ajaran tidak valid.');
  return value.trim();
}

async function listTeachers() {
  const result = await db.getPool().query("SELECT * FROM users WHERE role = 'guru' ORDER BY created_at DESC, id");
  return result.rows.map(publicUser);
}

async function createTeacher(input) {
  if (input.role !== undefined && input.role !== 'guru') throw new ApiError(400, 'Form ini hanya dapat membuat akun guru.');
  const email = emailAddress(input.email);
  const name = displayName(input.name);
  const className = shortText(input.className);
  const academicYear = shortText(input.academicYear);
  const hash = await hashPassword(input.password);
  const result = await db.getPool().query("INSERT INTO users(id, email, name, role, password_hash, class_name, academic_year) VALUES($1, $2, $3, 'guru', $4, $5, $6) RETURNING *", [randomUUID(), email, name, hash, className, academicYear]);
  return publicUser(result.rows[0]);
}

async function updateTeacher(id, input) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new ApiError(404, 'Akun guru tidak ditemukan.');
  if (input.role !== undefined && input.role !== 'guru') throw new ApiError(400, 'Peran akun tidak dapat diubah melalui form ini.');
  if (input.active !== undefined && typeof input.active !== 'boolean') throw new ApiError(400, 'Status akun tidak valid.');
  const hash = input.password === undefined ? null : await hashPassword(input.password);
  return db.transaction(async (client) => {
    const existing = (await client.query("SELECT * FROM users WHERE id = $1 AND role = 'guru' FOR UPDATE", [id])).rows[0];
    if (!existing) throw new ApiError(404, 'Akun guru tidak ditemukan.');
    const result = await client.query(`UPDATE users SET email = $2, name = $3, class_name = $4, academic_year = $5,
      is_active = $6, password_hash = $7, updated_at = now() WHERE id = $1 RETURNING *`, [id,
      input.email === undefined ? existing.email : emailAddress(input.email),
      input.name === undefined ? existing.name : displayName(input.name),
      input.className === undefined ? existing.class_name : shortText(input.className),
      input.academicYear === undefined ? existing.academic_year : shortText(input.academicYear),
      input.active ?? existing.is_active, hash || existing.password_hash]);
    if (hash || input.active === false) await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);
    return publicUser(result.rows[0]);
  });
}

module.exports = { emailAddress, listTeachers, createTeacher, updateTeacher };
