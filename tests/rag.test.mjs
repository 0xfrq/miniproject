import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const books = require('../lib/books');
const rag = require('../lib/rag');
const ocr = require('../lib/ocr-grading');
const { normalizeGenerated } = require('../lib/generated-questions');

const entry = (fields) => ({ id: '10', title: 'Matematika untuk SD/MI Kelas II', class: '2', level: 'SD/MI', type: 'pdf', subject: 'matematika', book_type: 'Buku Siswa', attachment: 'https://static-sc.cloudapp.web.id/content/pdf/bukuteks/kurikulum21/Matematika-BS-KLS-II.pdf', ...fields });

test('katalog SIBI hanya menerima buku teks PDF SD kelas 1–6 dari host resmi', () => {
  const book = books.normalizeCatalogEntry(entry({}), 'merdeka');
  assert.equal(book.grade, 2); assert.equal(book.bookType, 'siswa'); assert.equal(book.subject, 'Matematika'); assert.equal(book.curriculum, 'merdeka');
  assert.equal(books.normalizeCatalogEntry(entry({ class: '7', level: 'SMP/MTS' }), 'merdeka'), null);
  assert.equal(books.normalizeCatalogEntry(entry({ type: 'audio' }), 'merdeka'), null);
  assert.equal(books.normalizeCatalogEntry(entry({ attachment: 'https://evil.example/buku.pdf' }), 'merdeka'), null);
  assert.equal(books.normalizeCatalogEntry(entry({ attachment: 'http://static-sc.cloudapp.web.id/x.pdf' }), 'merdeka'), null);
  const legacy = books.normalizeCatalogEntry(entry({ attachment: 'https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/k13/bukusiswa/Kelas%201%20Tema%201%20BG%20press.pdf', title: 'Kelas I Tema 1 Diriku', subject: '', book_type: 'Buku Guru' }), 'k13');
  assert.equal(new URL(legacy.sourceUrl).hostname, 'static-sc.cloudapp.web.id');
  assert.equal(legacy.bookType, 'guru'); assert.equal(legacy.subject, 'Tematik');
  assert.equal(books.normalizeCatalogEntry(entry({ title: 'Panduan Guru Matematika untuk SD/MI Kelas II', book_type: 'Buku PDF' }), 'merdeka').bookType, 'guru');
});

test('mapel dipetakan tanpa tertukar antara Matematika dan Tematik', () => {
  assert.equal(books.subjectLabel('matematika', ''), 'Matematika');
  assert.equal(books.subjectLabel('tematik', ''), 'Tematik');
  assert.equal(books.subjectLabel('', 'Kelas V Tema 9 Benda Benda Di Sekitar Kita'), 'Tematik');
  assert.equal(books.subjectLabel('ipas', ''), 'IPAS');
  assert.equal(books.subjectLabel('agama_islam', ''), 'Pendidikan Agama Islam');
  assert.equal(books.subjectLabel('Bahasa_Inggris', ''), 'Bahasa Inggris');
});

test('chunking menjaga rentang halaman, overlap, dan menyambung kata terpenggal', () => {
  const pages = [Array.from({ length: 300 }, (_, i) => `kata${i}`).join(' '), 'foto-\nsintesis ' + Array.from({ length: 300 }, (_, i) => `isi${i}`).join(' ')];
  const chunks = rag.chunkPages(pages, { size: 200, overlap: 40 });
  assert.equal(chunks[0].pageStart, 1); assert.equal(chunks[0].pageEnd, 1);
  assert.ok(chunks.some((chunk) => chunk.pageStart === 1 && chunk.pageEnd === 2));
  assert.equal(chunks.at(-1).pageEnd, 2);
  assert.ok(chunks.some((chunk) => chunk.content.includes('fotosintesis')));
  const first = chunks[0].content.split(' ');
  assert.ok(chunks[1].content.startsWith(first.slice(-40)[0]));
  assert.deepEqual(rag.chunkPages(['', '  ']), []);
});

test('batch embedding mengikuti anggaran token per menit', () => {
  const batches = rag.embeddingBatches(Array.from({ length: 50 }, () => 'x'.repeat(3000)));
  assert.ok(batches.length > 1);
  assert.equal(batches.flat().length, 50);
  for (const batch of batches) assert.ok(batch.reduce((sum, text) => sum + Math.ceil(text.length / 3), 0) <= 10_000 || batch.length === 1);
});

test('OCR menolak gambar yang tidak valid atau terlalu banyak', () => {
  const image = 'data:image/jpeg;base64,/9j/AAAA';
  assert.deepEqual(ocr.validateImages([image]), [image]);
  assert.throws(() => ocr.validateImages([]), /minimal satu foto/);
  assert.throws(() => ocr.validateImages(['data:text/html;base64,PGI+']), /JPG, PNG, atau WEBP/);
  assert.throws(() => ocr.validateImages(Array(9).fill(image)), /Maksimal 8 foto/);
});

test('soal hasil AI dinormalisasi untuk editor ulangan', () => {
  const [mc, letterAnswer, essay, isian] = normalizeGenerated([
    { type: 'Pilihan Ganda', text: 'Zat hijau daun?', options: ['A. Air', 'B. Klorofil', 'C. Oksigen', 'D. Tanah'], correct: 'Klorofil', source: '[2]' },
    { type: 'pilihan ganda', text: 'Bahan fotosintesis?', options: ['Air', 'Batu', 'Besi'], correct: 'A' },
    { type: 'Uraian', text: 'Jelaskan fotosintesis.', correct: 'Proses membuat makanan', explanation: 'Rubrik 0–10' },
    { type: 'Isian', text: 'Gas yang dihasilkan?', answer: 'Oksigen' },
  ]);
  assert.deepEqual(mc.options, ['Air', 'Klorofil', 'Oksigen', 'Tanah']); assert.equal(mc.correct, 'B'); assert.match(mc.explanation, /Sumber: \[2\]/);
  assert.equal(letterAnswer.correct, 'A');
  assert.equal(essay.type, 'Essay'); assert.deepEqual(essay.options, []); assert.equal(essay.correct, 'Proses membuat makanan');
  assert.equal(isian.type, 'Isian Singkat'); assert.equal(isian.correct, 'Oksigen');
});

const gradingRules = require('../lib/grading');
const { groupPages } = require('../lib/ocr-pages');
const ai = require('../lib/ai-client');

test('no. absen opsional, divalidasi, dan ikut ke CSV', () => {
  assert.equal(gradingRules.resultFields({ studentName: 'Ayu' }).studentNumber, '');
  assert.equal(gradingRules.resultFields({ studentName: 'Ayu', studentNumber: ' 12 ' }).studentNumber, '12');
  assert.equal(gradingRules.resultFields({ studentName: 'Ayu', studentNumber: 7 }).studentNumber, '7');
  assert.throws(() => gradingRules.resultFields({ studentName: 'Ayu', studentNumber: '1 2' }), /No. absen/);
  assert.throws(() => gradingRules.resultFields({ studentName: 'Ayu', studentNumber: '12345678901' }), /No. absen/);
  const { gradeCsv } = require('../lib/grade-csv');
  const csv = gradeCsv({ title: 'T', subject: 'S', grade: 'G' }, [{ id: 'g1', studentName: 'Ayu', studentNumber: '12', score: 90 }]).content;
  assert.ok(csv.includes('"No. absen";"Nama siswa"')); assert.ok(csv.includes('"12";"Ayu"'));
});

const exam = { questions: [
  { id: 'q1', type: 'Pilihan Ganda', options: ['Air', 'Klorofil', 'Oksigen'], correct: 'B' },
  { id: 'q2', type: 'Pilihan Ganda', options: ['Air', 'Klorofil', 'Oksigen'], correct: 'C' },
  { id: 'q3', type: 'Isian Singkat', options: [], correct: 'Oksigen' },
] };

test('hasil OCR ringkas dipetakan ke jawaban, no. absen, dan tingkat keyakinan', () => {
  const result = ocr.mapResult(exam, { name: 'Rara Aulia', absen: 'No. 07', a: [{ n: 1, r: 'b', c: 't' }, { n: 2, r: 'Oksigen', c: 's', why: 'tulisan miring' }, { n: 3, r: 'oksigen', p: '9,5', f: 'Tepat', c: 't' }], note: '' });
  assert.equal(result.studentName, 'Rara Aulia'); assert.equal(result.studentNumber, '7');
  assert.deepEqual(result.answers.map((answer) => answer.response), ['B', 'C', 'oksigen']);
  assert.equal(result.answers[1].confidence, 'sedang'); assert.equal(result.answers[2].points, 9.5);
  const missing = ocr.mapResult(exam, { a: [{ n: 1, r: 'Z', c: 't' }] });
  assert.equal(missing.answers[0].response, ''); assert.equal(missing.answers[0].confidence, 'rendah');
  assert.equal(missing.answers[2].points, 0); assert.equal(missing.answers[2].confidence, 'rendah');
  assert.match(ocr.questionBrief(exam.questions[0], 0), /^1\. \[PG\] A\. Air \| B\. Klorofil \| C\. Oksigen · kunci B$/);
});

test('scan batch menggabungkan halaman lanjutan tanpa nama ke siswa sebelumnya', () => {
  const page = (key, studentName, studentNumber, answers, extra = {}) => ({ key, status: 'selesai', result: { studentName, studentNumber, notes: '', model: 'm', answers }, ...extra });
  const rows = [
    page('a', 'Rara', '21', [{ questionId: 'q1', response: 'B', confidence: 'tinggi' }, { questionId: 'q3', response: '', confidence: 'rendah' }]),
    page('b', '', '', [{ questionId: 'q1', response: '', confidence: 'rendah' }, { questionId: 'q3', response: 'oksigen', points: 10, confidence: 'tinggi' }]),
    page('c', '', '7', [{ questionId: 'q1', response: 'A', confidence: 'tinggi' }]),
  ];
  const students = groupPages(rows);
  assert.equal(students.length, 2);
  assert.deepEqual(students[0].rows.map((row) => row.key), ['a', 'b']);
  assert.equal(students[0].answers.get('q1').response, 'B'); assert.equal(students[0].answers.get('q3').response, 'oksigen');
  assert.equal(students[1].studentNumber, '7');
  assert.equal(groupPages(rows, { mergePages: false }).length, 3);
  assert.equal(groupPages([rows[0], { ...rows[1], split: true }]).length, 2);
  assert.equal(groupPages([{ ...rows[0], nameEdit: 'Rara Aulia' }])[0].studentName, 'Rara Aulia');
});

test('OCR pindah ke model cadangan saat model utama sibuk dan memakai hedged request saat lambat', async () => {
  const original = ai.askModelDirect;
  const env = { ...process.env };
  process.env.AI_VISION_MODEL = 'utama'; process.env.AI_VISION_FALLBACK_MODELS = 'cadangan'; process.env.AI_OCR_HEDGE_MS = '3000';
  try {
    const calls = [];
    ai.askModelDirect = async (messages, options) => {
      calls.push(options.model);
      if (options.model === 'utama') { const error = new ai.AIError('sibuk', 502, 'AI_PROVIDER_ERROR'); throw error; }
      return '{"a":[]}';
    };
    const busy = await ocr.readWithVision([]);
    assert.equal(busy.model, 'cadangan'); assert.deepEqual(calls, ['utama', 'cadangan']);

    const cancelled = [];
    ai.askModelDirect = (messages, options) => new Promise((resolve, reject) => {
      const delay = options.model === 'utama' ? 60_000 : 50;
      const timer = setTimeout(() => resolve(`{"name":"${options.model}"}`), delay);
      options.signal.addEventListener('abort', () => { clearTimeout(timer); cancelled.push(options.model); reject(new ai.AIError('batal', 499, 'AI_CANCELLED')); });
    });
    const started = Date.now();
    const slow = await ocr.readWithVision([]);
    assert.equal(slow.model, 'cadangan'); assert.ok(Date.now() - started < 10_000); assert.deepEqual(cancelled, ['utama']);

    ai.askModelDirect = async () => { throw new ai.AIError('Model tidak ditemukan', 404, 'AI_PROVIDER_ERROR'); };
    await assert.rejects(ocr.readWithVision([]), /tidak ditemukan/);
  } finally {
    ai.askModelDirect = original;
    for (const key of ['AI_VISION_MODEL', 'AI_VISION_FALLBACK_MODELS', 'AI_OCR_HEDGE_MS']) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
  }
});
