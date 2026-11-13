const BODY_LIMIT = 20 * 1024 * 1024;
const collections = new Set(['activities', 'posts', 'agenda', 'materials', 'assessments', 'questions', 'grading']);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireCollection(collection) {
  if (!collections.has(collection)) throw new ApiError(404, 'Data tidak ditemukan.');
  return collection;
}

async function readObject(request, message, limit = process.env.VERCEL === '1' ? 4_000_000 : BODY_LIMIT) {
  // Match the previous JSON middleware: empty/non-JSON requests have an empty body.
  const contentType = request.headers.get('content-type') || '';
  if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') return {};
  if (Number(request.headers.get('content-length')) > limit) {
    throw new ApiError(413, 'Payload terlalu besar.');
  }

  const chunks = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new ApiError(413, 'Payload terlalu besar.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  let body;
  try {
    body = size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  } catch {
    throw new ApiError(400, message);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, message);
  return body;
}

function handleApi(handler) {
  return async (...args) => {
    try {
      const request = args[0];
      if (request && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) require('./auth').assertSameOrigin(request);
      const response = await handler(...args);
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    } catch (error) {
      if (error.status) return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
      if (error.code === '23505') return Response.json({ error: 'Email atau ID tersebut sudah digunakan.' }, { status: 409 });
      if (error.code === '23503') return Response.json({ error: 'Data terkait tidak ditemukan.' }, { status: 400 });
      if (['23514', '22P02'].includes(error.code)) return Response.json({ error: 'Data tidak valid.' }, { status: 400 });
      if (['ECONNREFUSED', 'ETIMEDOUT', '28P01', '3D000', '42P01'].includes(error.code)) {
        return Response.json({ error: 'Database belum tersedia. Periksa koneksi dan jalankan npm run db:setup.' }, { status: 503 });
      }
      console.error('Permintaan API gagal:', error.code || error.name);
      return Response.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
    }
  };
}

module.exports = { ApiError, handleApi, readObject, requireCollection };
