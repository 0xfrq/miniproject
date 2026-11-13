// Leave headroom below Vercel's 4.5 MB request limit for JSON metadata.
const MAX_OCR_BODY_BYTES = 4_000_000;

function ocrRequestBody(assessmentId, images) {
  const body = JSON.stringify({ assessmentId, images });
  if (new TextEncoder().encode(body).byteLength > MAX_OCR_BODY_BYTES) {
    throw new Error('Total foto terlalu besar. Kurangi jumlah halaman atau resolusi foto, lalu coba lagi.');
  }
  return body;
}

module.exports = { MAX_OCR_BODY_BYTES, ocrRequestBody };
