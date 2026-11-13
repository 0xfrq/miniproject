const ai = require('./ai-client');
const assessmentStore = require('./assessment-store');
const gradingRules = require('./grading');
const examRules = require('./assessments');
const { ApiError } = require('./api');

const MAX_IMAGES = 8;
const MAX_IMAGE_CHARS = 6 * 1024 * 1024;
const MAX_TOTAL_CHARS = 18 * 1024 * 1024;
const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
// Bila model belum menjawab setelah jeda ini, kirim permintaan kedua dan pakai yang lebih dulu selesai.
const hedgeDelayMs = () => Math.max(3000, Number(process.env.AI_OCR_HEDGE_MS) || 10_000);

function validateImages(images) {
  if (!Array.isArray(images) || !images.length) throw new ApiError(400, 'Unggah minimal satu foto lembar jawaban.');
  if (images.length > MAX_IMAGES) throw new ApiError(400, `Maksimal ${MAX_IMAGES} foto untuk satu siswa.`);
  let total = 0;
  for (const image of images) {
    if (typeof image !== 'string' || !IMAGE_PATTERN.test(image)) throw new ApiError(400, 'Foto harus berformat JPG, PNG, atau WEBP.');
    if (image.length > MAX_IMAGE_CHARS) throw new ApiError(413, 'Ukuran satu foto terlalu besar (maks. ±4 MB).');
    total += image.length;
  }
  if (total > MAX_TOTAL_CHARS) throw new ApiError(413, 'Total ukuran foto terlalu besar. Kurangi jumlah atau resolusi foto.');
  return images;
}

// Daftar soal ringkas: PG cukup pilihan pendek + kunci; isian/essay membawa acuan dan rubrik untuk penilaian.
function questionBrief(question, index) {
  if (question.type === 'Pilihan Ganda') {
    const options = question.options.map((option, i) => `${String.fromCharCode(65 + i)}. ${String(option).slice(0, 60)}`).join(' | ');
    return `${index + 1}. [PG] ${options} · kunci ${question.correct}`;
  }
  const lines = [`${index + 1}. [${question.type === 'Essay' ? 'Essay' : 'Isian'}] ${String(question.text).slice(0, 400)}`, `   Acuan: ${String(question.correct || '').slice(0, 600)}`];
  if (question.explanation) lines.push(`   Rubrik: ${String(question.explanation).slice(0, 500)}`);
  return lines.join('\n');
}

const PROMPT = `Foto = lembar jawaban tulisan tangan SATU siswa SD (bisa beberapa halaman), kertas bebas.
Baca nama siswa dan nomor absen bila tertulis (mis. "No. absen 12", "absen: 12", "no 12", biasanya di bagian atas).
Cocokkan jawaban ke nomor soal (format nomor bebas: 1. / 1) / no 1). Salin jawaban apa adanya, jangan dikoreksi.
PG: tulis HURUF pilihan akhir siswa (A–F). Jika ada coretan, pakai jawaban yang TIDAK dicoret. Jika siswa menulis isi pilihan, ubah ke hurufnya. Kosong/ganda/tak terbaca → "" dan c:"r".
Isian/Essay: p = usulan poin 0–10 berdasarkan acuan & rubrik (10 lengkap-benar, sebagian benar = poin sebagian, kosong/salah = 0; toleransi salah eja ringan), f = umpan balik singkat untuk guru ≤ 15 kata.
c = keyakinan baca: "t" jelas, "s" ragu sedikit, "r" sulit dibaca/nomor tidak pasti; isi "why" hanya bila c bukan "t".
Balas HANYA JSON: {"name":"","absen":"","a":[{"n":1,"r":"B","c":"t"},{"n":4,"r":"...","p":10,"f":"...","c":"t"}],"note":""}
Sertakan semua nomor soal; yang tidak dijawab r:"". "note" = catatan singkat kualitas foto bila ada masalah.`;

const retryable = (error) => ['AI_TIMEOUT', 'AI_NETWORK_ERROR', 'AI_EMPTY_RESPONSE'].includes(error?.code) || [429, 502, 503, 504].includes(error?.status);

// Strategi cepat namun tetap akurat: model utama, cadangan saat sibuk (503/429), dan hedged request.
async function readWithVision(messages, options = {}) {
  const primary = ai.visionModel();
  const queue = [primary, ...ai.visionFallbackModels(), primary];
  const controllers = new Set();
  let firstError = null;
  const attempt = (model) => {
    const controller = new AbortController();
    controllers.add(controller);
    return ai.askModelDirect(messages, { model, temperature: 0.1, maxTokens: 4000, timeoutMs: options.timeoutMs || 90_000, signal: controller.signal })
      .then((text) => ({ text, model, data: ai.parseJson(text) }))
      .finally(() => controllers.delete(controller));
  };
  try {
    return await new Promise((resolve, reject) => {
      let pending = 0;
      let next = 0;
      let done = false;
      let hedgeTimer = null;
      const launch = () => {
        if (done || next >= queue.length) return false;
        const model = queue[next++];
        pending += 1;
        attempt(model).then((result) => { done = true; resolve(result); }, (error) => {
          pending -= 1;
          if (done) return;
          if (error.code !== 'AI_CANCELLED') firstError = firstError || error;
          if (!retryable(error) && error.code !== 'AI_INVALID_JSON') { done = true; reject(firstError); return; }
          if (!launch() && pending === 0) { done = true; reject(firstError); }
        });
        return true;
      };
      launch();
      hedgeTimer = setTimeout(() => { if (!done && pending < 2) launch(); }, hedgeDelayMs());
      hedgeTimer.unref?.();
    });
  } finally {
    for (const controller of controllers) controller.abort();
  }
}

function clampPoints(value) {
  const number = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return null;
  return Math.round(Math.min(gradingRules.pointsPerQuestion, Math.max(0, number)) * 100) / 100;
}

const CONFIDENCE = { t: 'tinggi', s: 'sedang', r: 'rendah', tinggi: 'tinggi', sedang: 'sedang', rendah: 'rendah' };

function cleanNumber(value) {
  const text = String(value ?? '').trim();
  const digits = /\d{1,3}/.exec(text)?.[0];
  return digits ? String(Number(digits)) : '';
}

function mapResult(exam, data) {
  const rows = Array.isArray(data?.a) ? data.a : Array.isArray(data?.answers) ? data.answers : [];
  const byNumber = new Map();
  rows.forEach((row, index) => {
    const number = Number.parseInt(row?.n ?? row?.number ?? index + 1, 10);
    if (Number.isInteger(number) && !byNumber.has(number)) byNumber.set(number, row);
  });
  const answers = exam.questions.map((question, index) => {
    const row = byNumber.get(index + 1) || {};
    let confidence = CONFIDENCE[row.c ?? row.confidence] || 'sedang';
    let reason = String(row.why ?? row.reason ?? '').slice(0, 300);
    let response = String(row.r ?? row.response ?? '').trim().slice(0, 10000);
    let points = null;
    if (question.type === 'Pilihan Ganda') {
      const letter = /^[A-Fa-f]$/.test(response) ? response.toUpperCase() : examRules.answerLetter(response, question.options);
      if (letter === null || (letter && letter.charCodeAt(0) - 65 >= question.options.length)) { reason = reason || `Jawaban terbaca "${response}" tidak sesuai pilihan.`; confidence = 'rendah'; response = ''; }
      else response = letter;
    } else {
      points = response ? clampPoints(row.p ?? row.points) : 0;
      if (points === null) { points = 0; confidence = 'rendah'; reason = reason || 'AI tidak memberi usulan poin.'; }
    }
    if (!byNumber.has(index + 1)) { confidence = 'rendah'; reason = reason || 'Jawaban untuk nomor ini tidak ditemukan pada foto.'; }
    return { questionId: question.id, response, points, feedback: String(row.f ?? row.feedback ?? '').trim().slice(0, 2000), confidence, reason };
  });
  return {
    studentName: String(data?.name ?? data?.studentName ?? '').trim().slice(0, 150),
    studentNumber: cleanNumber(data?.absen ?? data?.studentNumber),
    notes: String(data?.note ?? data?.notes ?? '').trim().slice(0, 1000),
    answers,
  };
}

async function readAnswerSheet(input, user) {
  if (typeof input.assessmentId !== 'string' || !input.assessmentId) throw new ApiError(400, 'Pilih ulangan terlebih dahulu.');
  const images = validateImages(input.images);
  const assessment = await assessmentStore.get(input.assessmentId, user);
  if (!assessment) throw new ApiError(404, 'Ulangan tidak ditemukan.');
  const exam = gradingRules.snapshot(assessment);
  const content = [
    { type: 'text', text: `${PROMPT}\n\nULANGAN: ${exam.title} · ${exam.subject} · ${exam.grade}\nSOAL (${exam.questions.length}):\n${exam.questions.map(questionBrief).join('\n')}` },
    ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
  ];
  const started = Date.now();
  const { data, model } = await readWithVision([{ role: 'user', content }]);
  return { assessmentId: exam.id, assessmentVersion: exam.updatedAt, ...mapResult(exam, data), model, durationMs: Date.now() - started };
}

module.exports = { readAnswerSheet, validateImages, mapResult, questionBrief, readWithVision };
