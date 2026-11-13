const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
const settings = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummyHash = `scrypt$32768$8$3$${'00'.repeat(16)}$${'00'.repeat(64)}`;

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    const error = new Error('Kata sandi harus terdiri dari 12–128 karakter.');
    error.status = 400;
    throw error;
  }
}

async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, settings);
  return `scrypt$32768$8$3$${salt}$${hash.toString('hex')}`;
}

async function verifyPassword(password, encoded = dummyHash) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [kind, n, r, p, salt, hex] = encoded.split('$');
  if (kind !== 'scrypt' || n !== '32768' || r !== '8' || p !== '3' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
  const actual = await derive(password, salt, 64, settings);
  return timingSafeEqual(actual, Buffer.from(hex, 'hex'));
}

module.exports = { hashPassword, verifyPassword, validatePassword };
