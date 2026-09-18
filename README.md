# Smart School Learning Platform

Prototype backend untuk dashboard guru SDN Bangah No. 383 menggunakan Express.js.

## Menjalankan

Prasyarat: Node.js 18 atau lebih baru.

```bash
npm install
npm start
```

Buka `http://localhost:3000/ai-learning-generator.html` untuk halaman dashboard.

Mode pengembangan:

```bash
npm run dev
```

## Endpoint dashboard guru

- `GET /api/health` - pemeriksaan status backend.
- `GET /api/dashboard/summary` - metrik dashboard, evaluasi terbaru, siswa yang perlu perhatian, dan aktivitas.
- `GET /api/students` - daftar siswa beserta rata-rata, nilai terakhir, tren, dan histori nilai. Mendukung `?search=nama`.
- `GET /api/students/:studentId/progress` - detail perkembangan satu siswa.
- `GET /api/assessments` - daftar evaluasi beserta hasil dan rata-rata.
- `GET /api/assessments/:assessmentId/results` - hasil evaluasi berdasarkan siswa.

Data saat ini masih in-memory untuk mendukung MVP. Data akan kembali ke seed awal setiap server dimulai. Tahap berikutnya adalah mengganti array seed dengan database SQL dan menambahkan autentikasi guru.

## Contoh respons ringkasan

```js
const response = await fetch('/api/dashboard/summary');
const summary = await response.json();
console.log(summary.metrics.averageScore);
```
