const { randomBytes, createHash } = require('node:crypto');
const db = require('./database');
const { ApiError } = require('./api');
const passwords = require('./passwords');
const COOKIE_NAME = 'sdn_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;

function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }

function cookieToken(cookie = '') {
  const match = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const value = match?.slice(COOKIE_NAME.length + 1) || '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, className: user.class_name || '', academicYear: user.academic_year || '', active: user.is_active, createdAt: user.created_at };
}

async function userFromToken(token) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await db.getPool().query(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true`, [tokenHash(token)]);
  return result.rows[0] ? publicUser(result.rows[0]) : null;
}

async function requireUser(request, roles) {
  const user = await userFromToken(cookieToken(request.headers.get('cookie') || ''));
  if (!user) throw new ApiError(401, 'Silakan masuk terlebih dahulu.');
  if (roles && !roles.includes(user.role)) throw new ApiError(403, 'Akses tidak diizinkan.');
  return user;
}

function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  const configured = process.env.APP_ORIGIN;
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expected && origin !== configured)) {
    throw new ApiError(403, 'Asal permintaan tidak diizinkan.');
  }
}

function sessionCookie(token, request, expire = false) {
  const secure = process.env.AUTH_COOKIE_SECURE === 'true' || new URL(request.url).protocol === 'https:';
  return `${COOKIE_NAME}=${expire ? '' : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expire ? 0 : SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

async function login({ email, password, role }, request) {
  if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 128 || !['admin', 'guru'].includes(role)) {
    throw new ApiError(400, 'Email, kata sandi, atau peran tidak valid.');
  }
  email = email.trim().toLowerCase();
  const attemptKey = tokenHash(email);
  const budget = await db.getPool().query(`INSERT INTO login_attempts(key, attempts) VALUES($1, 1)
    ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN login_attempts.window_start < now() - interval '15 minutes' THEN 1 ELSE login_attempts.attempts + 1 END,
    window_start = CASE WHEN login_attempts.window_start < now() - interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`, [attemptKey]);
  if (budget.rows[0].attempts > 10) throw new ApiError(429, 'Terlalu banyak percobaan. Coba kembali dalam 15 menit.');
  const result = await db.getPool().query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  const valid = await passwords.verifyPassword(password, user?.password_hash);
  if (!valid || !user?.is_active || user.role !== role) throw new ApiError(401, 'Email, kata sandi, atau peran tidak sesuai.');
  const token = randomBytes(32).toString('base64url');
  const previous = cookieToken(request.headers.get('cookie') || '');
  await db.transaction(async (client) => {
    await client.query('DELETE FROM login_attempts WHERE key = $1', [attemptKey]);
    await client.query('DELETE FROM sessions WHERE expires_at <= now()');
    if (previous) await client.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(previous)]);
    await client.query("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1, $2, now() + interval '7 days')", [tokenHash(token), user.id]);
  });
  return { token, user: publicUser(user) };
}

async function logout(request) {
  const token = cookieToken(request.headers.get('cookie') || '');
  if (token) await db.getPool().query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
}

module.exports = { COOKIE_NAME, cookieToken, userFromToken, requireUser, publicUser, assertSameOrigin, sessionCookie, login, logout };
