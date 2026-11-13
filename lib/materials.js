const limits = { title: 200, subject: 100, grade: 100, summary: 2000, content: 2000000 };
const labels = { title: 'Judul', subject: 'Mata pelajaran', grade: 'Kelas', summary: 'Ringkasan', content: 'Isi materi' };
const statuses = ['Draft', 'Siap digunakan'];

// Shared by the manual editor and SQL writes; imported records are left untouched.
function normalizeMaterial(input) {
  const result = {};
  for (const [key, limit] of Object.entries(limits)) {
    const value = input[key] === undefined && key === 'summary' ? '' : input[key];
    if (typeof value !== 'string') fail(`${labels[key]} harus berupa teks.`);
    const trimmed = value.trim();
    if (key !== 'summary' && !trimmed) fail(`${labels[key]} wajib diisi.`);
    if (trimmed.length > limit) fail(`${labels[key]} maksimal ${limit.toLocaleString('id-ID')} karakter.`);
    result[key] = trimmed;
  }
  result.status = input.status === undefined ? 'Draft' : input.status;
  if (!statuses.includes(result.status)) fail('Status harus Draft atau Siap digunakan.');
  return result;
}

function fail(message) { const error = new Error(message); error.status = 400; throw error; }
module.exports = { limits, statuses, normalizeMaterial };
