const { randomUUID } = require('node:crypto');
const db = require('./database');
const { ApiError } = require('./api');
const rules = require('./grading');

function scope(user) {
  if (!user?.id || !['admin', 'guru'].includes(user.role)) throw new ApiError(401, 'Silakan masuk terlebih dahulu.');
  return user.role === 'admin' ? null : user.id;
}
function timestamp(previous) { const time = Date.parse(previous); return new Date(Math.max(Date.now(), Number.isFinite(time) ? time + 1 : 0)).toISOString(); }
function calculated(input, exam) {
  const { pending, ...scores } = rules.scoreAnswers(exam, input.answers);
  return { ...rules.resultFields(input), ...scores, schemaVersion: 1, assessmentId: exam.id, assessmentSnapshot: exam, status: 'Selesai', confidence: 'Manual' };
}
async function create(input, user) {
  const owner = scope(user);
  if (typeof input.assessmentId !== 'string' || !input.assessmentId) throw new ApiError(400, 'Pilih ulangan yang akan dinilai.');
  return db.transaction(async (client) => {
    const row = (await client.query('SELECT payload,owner_id FROM assessments WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2) FOR UPDATE', [input.assessmentId, owner])).rows[0];
    if (!row) throw new ApiError(404, 'Ulangan tidak ditemukan.');
    if (typeof input.assessmentVersion !== 'string' || input.assessmentVersion !== row.payload.updatedAt) throw new ApiError(409, 'Ulangan telah berubah. Pilih ulang ulangan untuk memuat soal dan kunci terbaru.');
    const questions = (await client.query("SELECT payload FROM questions WHERE assessment_id=$1 ORDER BY payload->'number',position,id", [input.assessmentId])).rows.map((item) => item.payload);
    const exam = rules.snapshot({ ...row.payload, questions });
    const now = timestamp();
    const item = { ...calculated(input, exam), id: `grading-${randomUUID()}`, createdAt: now, updatedAt: now };
    await client.query('INSERT INTO grading(id,owner_id,assessment_id,payload) VALUES($1,$2,$3,$4)', [item.id, row.owner_id, exam.id, item]);
    return item;
  });
}
async function update(id, input, user) {
  const owner = scope(user);
  return db.transaction(async (client) => {
    const row = (await client.query('SELECT payload FROM grading WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2) FOR UPDATE', [id, owner])).rows[0];
    if (!row) return null;
    const saved = row.payload;
    if (input.assessmentId !== undefined && input.assessmentId !== saved.assessmentId) throw new ApiError(400, 'Ulangan pada hasil tersimpan tidak dapat diganti. Buat penilaian baru untuk ulangan lain.');
    if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== saved.updatedAt) throw new ApiError(409, 'Hasil penilaian telah berubah. Muat ulang halaman sebelum mengedit kembali.');
    let changes;
    if (saved.schemaVersion === 1 && saved.assessmentSnapshot) {
      changes = calculated({ ...saved, ...input }, saved.assessmentSnapshot);
    } else {
      // Legacy summaries have no answer sheet. Preserve their original counts;
      // only the explicitly entered summary score, name and notes are editable.
      if (input.answers !== undefined || input.assessmentSnapshot !== undefined) throw new ApiError(400, 'Hasil lama belum memiliki rincian jawaban. Buat penilaian baru untuk mencatat jawaban asli.');
      const value = input.score === undefined ? saved.score : input.score;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new ApiError(400, 'Nilai ringkasan harus berupa angka 0–100.');
      changes = { ...rules.resultFields({ ...saved, ...input }), score: rules.round(value), summaryOnly: true,
        originalSummary: saved.originalSummary || { score: saved.score, correct: saved.correct, wrong: saved.wrong } };
    }
    const item = { ...saved, ...changes, id, updatedAt: timestamp(saved.updatedAt) };
    await client.query('UPDATE grading SET payload=$2,updated_at=now() WHERE id=$1', [id, item]);
    return item;
  });
}
module.exports = { create, update };
