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

async function readObject(request, message) {
  // Match the previous JSON middleware: empty/non-JSON requests have an empty body.
  const contentType = request.headers.get('content-type') || '';
  if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') return {};
  if (Number(request.headers.get('content-length')) > BODY_LIMIT) {
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
        if (size > BODY_LIMIT) {
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
      return await handler(...args);
    } catch (error) {
      return Response.json({ error: error.message || 'Terjadi kesalahan server.' }, { status: error.status || 500 });
    }
  };
}

module.exports = { ApiError, handleApi, readObject, requireCollection };
