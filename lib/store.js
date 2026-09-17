const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const dataDirectory = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDirectory, 'db.json');

const seed = {
  meta: {
    schoolName: 'SDN Bangah No. 383',
    shortName: 'SDN Bangah',
    eyebrow: 'Sekolah dasar · Belajar dekat dengan kehidupan',
    heroTitle: 'Belajar dengan rasa ingin tahu.',
    heroDescription: 'Di SDN Bangah, pelajaran tidak berhenti di halaman buku. Kami merawat pertanyaan, memberi ruang untuk mencoba, dan berjalan bersama setiap prosesnya.',
    aboutTitle: 'Sekolah yang hadir sepenuhnya.',
    aboutDescription: 'Kami percaya pendidikan yang baik membuat anak lebih peka terhadap sekitarnya—dan lebih berani mengambil bagian.',
    aboutBody: 'SDN Bangah adalah ruang belajar untuk anak-anak yang sedang menyusun cara pandangnya sendiri. Di sini, matematika bisa dimulai dari kebun, lingkungan sekitar menjadi bahan pengamatan, dan karya seni boleh lahir dari kegagalan percobaan pertama. Kegiatan belajar dirancang dekat dengan kehidupan nyata. Guru mengajak siswa bertanya, menguji, menyusun ulang, lalu menjelaskan kembali dengan bahasa mereka sendiri.',
    contactEmail: 'halo@sdnbangah.sch.id',
    phone: '(031) 555 0125',
    address: 'Jl. Pendidikan No. 383, Bangah',
    year: '2024/25',
    imageLabels: {
      hero: 'IMAGE · HERO UTAMA',
      secondary: 'IMAGE · HALAMAN SEKOLAH',
      activity: 'IMAGE · KEGIATAN SEKOLAH',
      news: 'IMAGE · BERITA UTAMA',
    },
  },
  values: [
    { id: 'value-1', title: 'Datang dengan pertanyaan', description: 'Rasa penasaran bukan gangguan. Ia adalah awal dari pelajaran yang melekat.' },
    { id: 'value-2', title: 'Membuat sesuatu bersama', description: 'Ide tumbuh lebih kuat saat dibagikan dan dikerjakan bersama.' },
    { id: 'value-3', title: 'Pulang membawa cerita', description: 'Setiap hari menyisakan sesuatu untuk dibagikan kembali di rumah.' },
  ],
  activities: [
    { id: 'activity-1', title: 'Membaca lebih dekat', description: 'Klub mingguan untuk menemukan satu buku, lalu membawanya ke percakapan.', label: '01 · Studio baca', imageLabel: 'IMAGE · STUDIO BACA' },
    { id: 'activity-2', title: 'Belajar dari sekitar', description: 'Siswa mengamati lingkungan, bertemu narasumber, dan menyusun temuannya.', label: '02 · Jelajah sekitar', imageLabel: 'IMAGE · JELAJAH SEKITAR' },
    { id: 'activity-3', title: 'Menguji kemungkinan', description: 'Ruang eksperimen untuk membuat prototipe dan belajar dari hasilnya.', label: '03 · Laboratorium ide', imageLabel: 'IMAGE · LABORATORIUM IDE' },
    { id: 'activity-4', title: 'Berani tampil, siap mendengar', description: 'Presentasi dan forum siswa untuk melatih suara serta empati.', label: '04 · Panggung bersama', imageLabel: 'IMAGE · PANGGUNG BERSAMA' },
  ],
  posts: [
    { id: 'post-1', title: 'Ketika sekolah memberi waktu untuk mendengar.', excerpt: 'Beberapa pelajaran terbaik dimulai saat kita berhenti sebentar, memperhatikan, lalu mengajukan pertanyaan yang lebih baik.', category: 'Catatan kepala sekolah', date: '18 Mei 2025', featured: true, imageLabel: 'IMAGE · BERITA UTAMA' },
    { id: 'post-2', title: 'Klub sains mengubah halaman belakang menjadi kebun belajar.', excerpt: 'Kabar dari halaman sekolah dan percakapan siswa.', category: 'Kabar siswa', date: '12 Mei 2025', featured: false, imageLabel: 'IMAGE · KABAR SISWA' },
    { id: 'post-3', title: 'Menemani anak memilih jalan setelah sekolah.', excerpt: 'Beberapa cara sederhana membuka obrolan tentang hari belajar.', category: 'Untuk keluarga', date: '04 Mei 2025', featured: false, imageLabel: 'IMAGE · UNTUK KELUARGA' },
    { id: 'post-4', title: 'Proyek kecil, percakapan besar di kelas lima.', excerpt: 'Catatan tentang proses belajar yang tumbuh dari hal sederhana.', category: 'Ruang guru', date: '27 April 2025', featured: false, imageLabel: 'IMAGE · RUANG GURU' },
  ],
  agenda: [
    { id: 'agenda-1', title: 'Open house dan tur ruang belajar', description: 'Kenali ruang belajar dan berbincang dengan tim sekolah.', date: '07 Juni 2025', time: '09.00–12.00' },
    { id: 'agenda-2', title: 'Pameran karya akhir semester', description: 'Karya siswa dibuka untuk keluarga dan masyarakat.', date: '21 Juni 2025', time: '15.30–18.00' },
    { id: 'agenda-3', title: 'Forum keluarga: memilih langkah berikutnya', description: 'Percakapan terbuka tentang perkembangan belajar anak.', date: '12 Juli 2025', time: '09.00–11.00' },
  ],
  materials: [
    { id: 'material-1', title: 'Sistem Pernapasan Manusia', subject: 'IPA', grade: 'Kelas 5 SD', summary: 'Materi tentang organ dan fungsi sistem pernapasan.', content: 'Sistem pernapasan manusia terdiri dari organ yang bekerja bersama untuk mengambil oksigen dan membuang karbon dioksida.', status: 'Draft', updatedAt: '19 Mei 2025' },
  ],
  assessments: [
    { id: 'assessment-1', title: 'Ulangan Harian Matematika — Pecahan', subject: 'Matematika', grade: 'Kelas 5 SD', questionCount: 20, duration: '35 menit', status: 'Siap digunakan', updatedAt: '18 Mei 2025' },
  ],
  questions: [
    { id: 'question-1', assessmentId: 'assessment-1', number: 1, type: 'Pilihan Ganda', text: 'Pecahan manakah yang senilai dengan 1/2?', options: ['2/4', '2/3', '3/5', '4/5'], answer: '2/4', objective: 'Mengenali pecahan senilai', difficulty: 'Mudah' },
    { id: 'question-2', assessmentId: 'assessment-1', number: 2, type: 'Pilihan Ganda', text: 'Hasil dari 2/3 + 1/6 adalah …', options: ['1/2', '5/6', '3/9', '1 1/6'], answer: '5/6', objective: 'Menjumlahkan pecahan berbeda penyebut', difficulty: 'Sedang' },
  ],
  grading: [
    { id: 'grading-1', assessmentId: 'assessment-1', studentName: 'Andi Pratama', correct: 18, wrong: 2, score: 90, status: 'Selesai', confidence: 'Manual' },
    { id: 'grading-2', assessmentId: 'assessment-1', studentName: 'Siti Aulia', correct: 16, wrong: 4, score: 80, status: 'Selesai', confidence: 'Manual' },
  ],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStore() {
  if (!fs.existsSync(dataDirectory)) fs.mkdirSync(dataDirectory, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(seed, null, 2));
    return;
  }
  // Lightweight migration for data created before a new collection was added.
  const current = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  let changed = false;
  for (const [key, value] of Object.entries(seed)) {
    if (!(key in current)) {
      current[key] = clone(value);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(dataFile, JSON.stringify(current, null, 2));
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  return data;
}

function getCollection(data, collection) {
  if (!Array.isArray(data[collection])) throw new Error(`Unknown collection: ${collection}`);
  return data[collection];
}

function list(collection) {
  return clone(getCollection(readStore(), collection));
}

function create(collection, input) {
  const data = readStore();
  const item = { id: `${collection.slice(0, -1)}-${randomUUID().slice(0, 8)}`, ...input };
  getCollection(data, collection).unshift(item);
  writeStore(data);
  return clone(item);
}

function update(collection, id, input) {
  const data = readStore();
  const items = getCollection(data, collection);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...input, id };
  writeStore(data);
  return clone(items[index]);
}

function remove(collection, id) {
  const data = readStore();
  const items = getCollection(data, collection);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return false;
  items.splice(index, 1);
  writeStore(data);
  return true;
}

function getSite() {
  const data = readStore();
  return clone({ meta: data.meta, values: data.values, activities: data.activities, posts: data.posts, agenda: data.agenda });
}

function updateSite(input) {
  const data = readStore();
  if (input.meta) data.meta = { ...data.meta, ...input.meta };
  if (Array.isArray(input.values)) data.values = input.values;
  writeStore(data);
  return getSite();
}

function dashboard() {
  const data = readStore();
  const results = data.grading;
  const scores = results.map((item) => Number(item.score) || 0);
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  return clone({
    counts: { materials: data.materials.length, assessments: data.assessments.length, activities: data.activities.length, posts: data.posts.length, agenda: data.agenda.length, graded: data.grading.length },
    recentMaterials: data.materials.slice(0, 4),
    recentAssessments: data.assessments.slice(0, 4),
    recentQuestions: data.questions.slice(0, 5),
    recentResults: data.grading.slice(0, 5),
    gradingSummary: { average, highest: scores.length ? Math.max(...scores) : 0, lowest: scores.length ? Math.min(...scores) : 0 },
  });
}

module.exports = { ensureStore, readStore, writeStore, list, create, update, remove, getSite, updateSite, dashboard };
