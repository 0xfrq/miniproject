// Seed data used only by the one-time PostgreSQL import.
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

module.exports = { seed };
