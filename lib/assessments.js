const statuses = ['Draft', 'Siap digunakan'];
const types = ['Pilihan Ganda', 'Isian Singkat', 'Essay'];
const maxQuestions = 200;
function fail(message) { const error = new Error(message); error.status = 400; throw error; }
function text(value, label, limit, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') fail(`${label} harus berupa teks.`);
  const result = value.trim();
  if (required && !result) fail(`${label} wajib diisi.`);
  if (result.length > limit) fail(`${label} maksimal ${limit} karakter.`);
  return result;
}
function minutes(value) {
  const match = /^(\d+)\s*(?:menit)?$/i.exec(String(value ?? '').trim());
  const number = match ? Number(match[1]) : NaN;
  return Number.isInteger(number) && number >= 1 && number <= 600 ? number : null;
}
function optionText(value, index) {
  return typeof value === 'string' ? value.replace(new RegExp(`^${String.fromCharCode(65 + index)}[.)]\\s+`), '') : value;
}
function answerLetter(value, options) {
  if (!value) return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return '';
  const letter = trimmed.toUpperCase();
  if (/^[A-F]$/.test(letter) && letter.charCodeAt(0) - 65 < options.length) return letter;
  const index = options.findIndex((option, i) => optionText(option, i)?.trim() === trimmed || option === trimmed);
  return index < 0 ? null : String.fromCharCode(65 + index);
}
function normalizeQuestion(input, index, ready) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(`Soal ${index + 1} tidak valid.`);
  const label = `Soal ${index + 1}`;
  const type = input.type === undefined ? (input.options?.length ? types[0] : types[1]) : input.type;
  if (!types.includes(type)) fail(`${label}: jenis soal tidak valid.`);
  const question = { type, number: index + 1, text: text(input.text, label, 10000, true), explanation: text(input.explanation, `${label}: pembahasan`, 10000) };
  const answer = input.correct !== undefined ? input.correct : input.answer;
  if (type === types[0]) {
    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 6) fail(`${label}: isi 2–6 pilihan jawaban.`);
    question.options = input.options.map((value, i) => text(optionText(value, i), `${label}: pilihan ${String.fromCharCode(65 + i)}`, 2000, true));
    if (new Set(question.options.map((value) => value.toLocaleLowerCase('id-ID'))).size !== question.options.length) fail(`${label}: pilihan jawaban tidak boleh sama.`);
    if (answer !== undefined && typeof answer !== 'string') fail(`${label}: kunci jawaban harus berupa teks.`);
    question.correct = answerLetter(answer, question.options);
    if (question.correct === null) fail(`${label}: kunci harus sesuai dengan pilihan jawaban.`);
  } else {
    question.options = [];
    question.correct = text(answer, `${label}: kunci jawaban`, 10000);
  }
  if (ready && !question.correct) fail(`${label}: kunci jawaban wajib diisi sebelum siap digunakan.`);
  question.answer = question.correct;
  return question;
}
function normalizeAssessment(input, questions) {
  const assessment = {
    title: text(input.title, 'Judul ulangan', 200, true), subject: text(input.subject, 'Mata pelajaran', 100, true),
    grade: text(input.grade, 'Kelas', 100, true), status: input.status === undefined ? 'Draft' : input.status,
  };
  const duration = minutes(input.duration);
  if (!duration) fail('Durasi harus 1–600 menit.');
  assessment.duration = `${duration} menit`;
  if (!statuses.includes(assessment.status)) fail('Status harus Draft atau Siap digunakan.');
  if (!Array.isArray(questions) || questions.length > maxQuestions) fail(`Daftar soal harus berupa array dengan maksimal ${maxQuestions} soal.`);
  const ready = assessment.status === 'Siap digunakan';
  if (ready && !questions.length) fail('Tambahkan minimal satu soal sebelum siap digunakan.');
  const normalized = questions.map((item, index) => normalizeQuestion(item, index, ready));
  return { assessment: { ...assessment, questionCount: normalized.length }, questions: normalized };
}
function orderedQuestions(questions, assessmentId) {
  return questions.filter((item) => item.assessmentId === assessmentId).sort((a, b) => (Number(a.number) || Infinity) - (Number(b.number) || Infinity));
}
module.exports = { statuses, types, maxQuestions, minutes, optionText, answerLetter, normalizeQuestion, normalizeAssessment, orderedQuestions };
