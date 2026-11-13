const { randomUUID } = require('node:crypto');
const { ApiError } = require('./api');

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function settings() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let url;
  try { url = new URL(process.env.SUPABASE_URL); } catch { /* Report a configuration error below. */ }
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'school-images';
  if (!key || !url || url.protocol !== 'https:' || url.username || url.password || !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(bucket)) {
    throw new ApiError(503, 'Penyimpanan gambar belum dikonfigurasi. Hubungi administrator.');
  }
  return { url: url.origin, key, bucket };
}

async function storageRequest(endpoint, options = {}) {
  const config = settings();
  let response;
  try {
    response = await fetch(`${config.url}/storage/v1${endpoint}`, {
      ...options, headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new ApiError(502, 'Penyimpanan gambar tidak dapat dihubungi. Coba lagi.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new ApiError(502, 'Penyimpanan gambar belum tersedia. Periksa konfigurasi bucket.');
    error.storageStatus = Number(data.statusCode) || response.status;
    throw error;
  }
  return data;
}

async function signedImageUpload(user, { type, size } = {}) {
  if (!user || user.role !== 'admin') throw new ApiError(403, 'Akses tidak diizinkan.');
  if (!Object.hasOwn(IMAGE_TYPES, type) || !Number.isInteger(size) || size < 1 || size > MAX_IMAGE_BYTES) {
    throw new ApiError(400, 'Pilih gambar JPG, PNG, GIF, WebP, atau AVIF dengan ukuran maksimal 4 MB.');
  }
  const { url, bucket } = settings();
  const path = `cms/${user.id}/${randomUUID()}.${IMAGE_TYPES[type]}`;
  const data = await storageRequest(`/object/upload/sign/${bucket}/${path}`, { method: 'POST', body: '{}' });
  if (typeof data.url !== 'string' || !data.url.startsWith(`/object/upload/sign/${bucket}/${path}?`)) {
    throw new ApiError(502, 'Alamat upload gambar tidak valid.');
  }
  return { uploadUrl: `${url}/storage/v1${data.url}`, publicUrl: `${url}/storage/v1/object/public/${bucket}/${path}` };
}

async function setupBucket() {
  const { bucket } = settings();
  let existing;
  try { existing = await storageRequest(`/bucket/${bucket}`); }
  catch (error) { if (error.storageStatus !== 404) throw error; }
  if (existing) {
    if (existing.public !== true || Number(existing.file_size_limit) !== MAX_IMAGE_BYTES ||
      !Array.isArray(existing.allowed_mime_types) || existing.allowed_mime_types.length !== Object.keys(IMAGE_TYPES).length ||
      !existing.allowed_mime_types.every((type) => Object.hasOwn(IMAGE_TYPES, type))) {
      throw new Error(`Existing bucket ${bucket} must be public, limited to 4194304 bytes, and allow only ${Object.keys(IMAGE_TYPES).join(', ')}. No settings were changed.`);
    }
    return { created: false };
  }
  await storageRequest('/bucket', { method: 'POST', body: JSON.stringify({ id: bucket, name: bucket, public: true,
    file_size_limit: MAX_IMAGE_BYTES, allowed_mime_types: Object.keys(IMAGE_TYPES) }) });
  return { created: true };
}

module.exports = { signedImageUpload, setupBucket, MAX_IMAGE_BYTES };
