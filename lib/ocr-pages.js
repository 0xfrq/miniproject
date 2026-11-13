// Menggabungkan halaman: foto tanpa nama & no. absen dianggap halaman lanjutan siswa sebelumnya.
function groupPages(rows, { mergePages = true } = {}) {
  const students = [];
  for (const row of rows) {
    const identity = row.result && (row.result.studentName || row.result.studentNumber);
    const previous = students.at(-1);
    if (mergePages && !row.split && row.result && !identity && previous) previous.rows.push(row);
    else students.push({ key: row.key, rows: [row] });
  }
  return students.map((student) => {
    const lead = student.rows[0];
    const done = student.rows.filter((row) => row.result);
    const answers = new Map();
    for (const row of done) {
      for (const answer of row.result.answers) {
        const current = answers.get(answer.questionId);
        const better = !current || (!current.response && answer.response) || (current.confidence === 'rendah' && answer.response && answer.confidence !== 'rendah');
        if (better) answers.set(answer.questionId, answer);
      }
    }
    const statuses = student.rows.map((row) => row.status);
    const status = statuses.includes('membaca') || statuses.includes('antre') ? 'proses' : statuses.includes('gagal') ? 'gagal' : lead.savedId ? 'tersimpan' : 'selesai';
    return {
      key: student.key, rows: student.rows, status, savedId: lead.savedId,
      studentName: lead.nameEdit ?? done.find((row) => row.result.studentName)?.result.studentName ?? '',
      studentNumber: lead.numberEdit ?? done.find((row) => row.result.studentNumber)?.result.studentNumber ?? '',
      answers, notes: done.map((row) => row.result.notes).filter(Boolean).join(' '), model: done[0]?.result.model,
    };
  });
}

module.exports = { groupPages };
