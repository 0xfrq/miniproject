const { dateText } = require('./record-print');
const headers = ['No', 'ID hasil', 'No. absen', 'Nama siswa', 'Ulangan', 'Mata pelajaran', 'Kelas', 'Nilai akhir (0–100)', 'Poin diperoleh', 'Poin maksimal', 'Soal penuh', 'Soal sebagian', 'Soal nol poin', 'Tidak dijawab', 'Jenis hasil', 'Diperbarui (WIB)', 'Catatan'];
function cell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // Spreadsheet programs can evaluate leading formulas even inside quoted CSV.
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
function decimal(value) { return typeof value === 'number' && Number.isFinite(value) ? String(value).replace('.', ',') : ''; }
function gradeCsv(assessment, results) {
  const rows = results.map((item, index) => {
    const detailed = item.schemaVersion === 1 && !!item.assessmentSnapshot;
    const exam = detailed ? item.assessmentSnapshot : assessment;
    return [index + 1, item.id, item.studentNumber || '', item.studentName, exam.title, exam.subject, exam.grade, decimal(item.score),
      detailed ? decimal(item.earnedPoints) : '', detailed ? decimal(item.maxPoints) : '',
      detailed ? item.correct : '', detailed ? item.partial : '', detailed ? item.wrong : '', detailed ? item.unanswered : '',
      detailed ? 'Rincian jawaban' : 'Ringkasan lama', item.updatedAt || item.createdAt ? dateText(item.updatedAt || item.createdAt) : '', item.notes || ''];
  });
  const title = String(assessment.title || 'ulangan').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).toLowerCase() || 'ulangan';
  return { filename: `nilai-${title}.csv`, content: '\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n', count: results.length };
}
module.exports = { gradeCsv, cell };
