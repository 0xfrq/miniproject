const examRules = require('./assessments');
const pointsPerQuestion = 10;
function invalid(message) { const error = new Error(message); error.status = 400; throw error; }
function text(value, label, limit, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > limit) invalid(`${label} harus berupa teks maksimal ${limit} karakter.`);
  const result = value.trim();
  if (required && !result) invalid(`${label} wajib diisi.`);
  return result;
}
function round(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function snapshot(assessment) {
  if (assessment.status !== 'Siap digunakan') invalid('Ulangan harus berstatus Siap digunakan sebelum dinilai.');
  const normalized = examRules.normalizeAssessment(assessment, assessment.questions);
  return {
    id: assessment.id, title: normalized.assessment.title, subject: normalized.assessment.subject,
    grade: normalized.assessment.grade, duration: normalized.assessment.duration, updatedAt: assessment.updatedAt,
    questions: normalized.questions.map((question, index) => ({ ...question, id: assessment.questions[index].id })),
  };
}
function scoreAnswers(exam, input, { preview = false } = {}) {
  if (!exam?.questions?.length) invalid('Ulangan belum memiliki soal untuk dinilai.');
  if (!Array.isArray(input) || input.length !== exam.questions.length) invalid('Isi satu jawaban untuk setiap soal ulangan.');
  const expectedIds = new Set(exam.questions.map((question) => question.id));
  const supplied = new Map();
  for (const answer of input) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer) || !expectedIds.has(answer.questionId) || supplied.has(answer.questionId)) invalid('ID jawaban tidak sesuai dengan soal atau digunakan dua kali.');
    supplied.set(answer.questionId, answer);
  }
  let earnedPoints = 0, correct = 0, partial = 0, wrong = 0, unanswered = 0, pending = 0;
  const answers = exam.questions.map((question, index) => {
    const raw = supplied.get(question.id);
    const response = text(raw.response, `Jawaban soal ${index + 1}`, 10000);
    const feedback = text(raw.feedback, `Catatan soal ${index + 1}`, 2000);
    let points;
    let normalizedResponse = response;
    if (question.type === 'Pilihan Ganda') {
      normalizedResponse = examRules.answerLetter(response, question.options);
      if (normalizedResponse === null) invalid(`Soal ${index + 1}: jawaban harus sesuai pilihan yang tersedia.`);
      points = normalizedResponse && normalizedResponse === question.correct ? pointsPerQuestion : 0;
    } else {
      points = raw.points;
      if (preview && (points === null || points === undefined)) { points = null; pending += 1; }
      else if (typeof points !== 'number' || !Number.isFinite(points) || points < 0 || points > pointsPerQuestion || Math.abs(points * 100 - Math.round(points * 100)) > 0.000001) invalid(`Soal ${index + 1}: isi nilai 0–10, maksimal dua angka desimal.`);
      if (!response && points > 0) invalid(`Soal ${index + 1}: jawaban kosong harus bernilai 0.`);
    }
    if (!normalizedResponse) unanswered += 1;
    if (points !== null) {
      earnedPoints += points;
      if (points === pointsPerQuestion) correct += 1;
      else if (points > 0) partial += 1;
      else wrong += 1;
    }
    return { questionId: question.id, response: normalizedResponse, points, feedback };
  });
  const maxPoints = exam.questions.length * pointsPerQuestion;
  return { answers, earnedPoints: round(earnedPoints), maxPoints, correct, partial, wrong, unanswered, pending, score: pending ? null : round(earnedPoints / maxPoints * 100) };
}
function studentNumber(value) {
  const result = text(value === null ? undefined : typeof value === 'number' ? String(value) : value, 'No. absen', 10);
  if (result && !/^[0-9A-Za-z./-]+$/.test(result)) invalid('No. absen hanya boleh berisi angka/huruf tanpa spasi, maksimal 10 karakter.');
  return result;
}
function resultFields(input) {
  return { studentName: text(input.studentName, 'Nama siswa', 150, true), studentNumber: studentNumber(input.studentNumber), notes: text(input.notes, 'Catatan hasil', 2000) };
}
function summary(results) {
  const scores = results.map((item) => Number(item.score)).filter((score) => Number.isFinite(score) && score >= 0 && score <= 100);
  return { average: scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0, highest: scores.length ? Math.max(...scores) : 0, lowest: scores.length ? Math.min(...scores) : 0 };
}
module.exports = { pointsPerQuestion, round, text, snapshot, scoreAnswers, resultFields, summary };
