import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { gradeCsv, cell } = require('../lib/grade-csv');

test('CSV preserves UTF-8, quoted multiline cells, decimal scores, duplicates and legacy omissions', () => {
  const exam = { title: 'Tes / "Pecahan"', subject: 'Matematika', grade: 'Kelas 5 SD' };
  const result = { id: 'grading-one', studentName: 'Ayu; "你好"', score: 83.33, notes: 'Baris satu; catatan\r\nBaris "dua"', schemaVersion: 1,
    assessmentSnapshot: { ...exam, title: 'Judul asli', questions: [{ correct: 'PRIVATE_KEY' }] }, answers: [{ response: 'PRIVATE_RESPONSE' }], earnedPoints: 25, maxPoints: 30, correct: 2, partial: 1, wrong: 0, unanswered: 0 };
  const file = gradeCsv(exam, [result, { id: 'legacy-two', studentName: result.studentName, score: 80 }]);
  assert.equal(file.count, 2); assert.equal(file.filename, 'nilai-tes-pecahan.csv'); assert.ok(file.content.startsWith('\uFEFF'));
  assert.ok(file.content.includes('"Ayu; ""你好"""')); assert.ok(file.content.includes('"83,33"')); assert.ok(file.content.includes('"Baris satu; catatan\r\nBaris ""dua"""'));
  assert.ok(file.content.includes('"Judul asli"')); assert.ok(file.content.includes('"Ringkasan lama"'));
  assert.equal(file.content.includes('PRIVATE_KEY'), false); assert.equal(file.content.includes('PRIVATE_RESPONSE'), false);
  assert.equal(gradeCsv(exam, []).content.split('\r\n').length, 2);
});

test('CSV neutralizes spreadsheet formulas, including leading whitespace and control characters', () => {
  for (const value of ['=1+1', '+SUM(1,2)', '-1+2', '@SUM(A1)', ' \t=cmd()', '\tname', '\rname', '\nname', '\uFEFF=1']) assert.ok(cell(value).startsWith('"\''), JSON.stringify(value));
  assert.equal(cell('Nama biasa'), '"Nama biasa"'); assert.equal(cell('A;B"C'), '"A;B""C"');
});
