# Smart School Learning Platform

Platform profil sekolah dan workspace guru SDN Bangah No. 383 menggunakan Next.js App Router dan React. Halaman, aset publik, dan API dijalankan oleh satu server Next.js.

## Menjalankan

Prasyarat: Node.js 18.18 atau lebih baru dan npm.

```bash
npm install
npm run dev
```

Alamat default: `http://localhost:3000`. Untuk memilih port atau host lain, gunakan argumen Next.js, misalnya `npm run dev -- --port 3001 --hostname 127.0.0.1`.

Untuk menjalankan versi produksi, buat build terlebih dahulu:

```bash
npm run build
npm start
```

## Halaman

- `/` dan `/index.html`: profil publik sekolah, termasuk navigasi artikel melalui hash URL.
- `/admin`: editor profil sekolah, galeri, informasi, dan agenda.
- `/guru`: workspace materi, ulangan, penilaian, dan riwayat guru.
- `/ai-learning-generator.html`: generator materi dan soal dengan alur review guru.

Halaman publik di `app/page.js` menggunakan desain profil sekolah dari salinan proyek yang digabungkan, dengan interaksi React dan data CMS yang sama dengan admin. `next.config.js` memetakan `/index.html` ke `/` tanpa redirect agar tautan lama tetap berfungsi. Berita, detail artikel (`#artikel/:id`), galeri kegiatan, agenda, dan kontak tetap terhubung dengan data sekolah. Kalender menampilkan bulan dari agenda pertama yang memiliki tanggal valid.

Stylesheet profil publik di `components/public-profile.css` dibatasi ke `.static-public-profile` agar tidak mengubah tampilan admin dan workspace guru. Generator HTML serta aset publik lainnya tetap dilayani dari `public/`. Logo, gambar hero, dan ikon WhatsApp yang dirujuk salinan unduhan tidak disertakan di dalamnya; halaman menggunakan fallback tanpa permintaan gambar yang hilang. Form kontak mempertahankan perilaku demo lokal.

## API

Semua endpoint menggunakan Next.js Route Handlers di `app/api/` dengan runtime Node.js.

- `GET /api/health`: status layanan dan konfigurasi AI.
- `GET /api/ai/status`: status konfigurasi AI.
- `GET /api/site` dan `PUT /api/site`: membaca dan memperbarui profil sekolah.
- `GET /api/dashboard`: ringkasan workspace.
- `GET /api/:collection` dan `POST /api/:collection`: daftar dan tambah data.
- `PUT /api/:collection/:id` dan `DELETE /api/:collection/:id`: ubah dan hapus data.

Collection yang tersedia: `activities`, `posts`, `agenda`, `materials`, `assessments`, `questions`, dan `grading`. Penambahan data menghasilkan status `201`; penghapusan berhasil menghasilkan `204`. Payload JSON dibatasi 20 MiB.

Endpoint AI:

- `POST /api/ai/search-reference`
- `POST /api/ai/generate-material`
- `POST /api/ai/generate-questions`
- `POST /api/ai/analyze-assessment`

Konfigurasi provider menggunakan variabel dalam `.env.example`. Buat `.env` dan isi `AI_API_KEY`, `AI_BASE_URL`, serta `AI_MODEL`. API key hanya dipakai di server.

## Penyimpanan dan batasan prototipe

`lib/store.js` menyimpan data di `data/db.json`; data tetap tersedia setelah server dimulai ulang. Jika file belum ada, data seed dibuat saat API penyimpanan pertama kali diakses. Gunakan server Node.js dengan disk persisten dan satu instance untuk penyimpanan ini.

Alur scan lembar jawaban masih menggunakan data dummy. Pencarian referensi menghasilkan saran AI yang perlu diverifikasi. Migrasi ke Next.js mempertahankan perilaku tersebut.

## Verifikasi

```bash
npm test
```

Perintah ini membuat build produksi dan menjalankan pengujian HTTP terhadap server Next.js dengan database sementara serta provider AI tiruan lokal. Pengujian mencakup homepage gabungan dan perubahan CMS, URL publik, halaman React, seluruh collection CRUD, validasi payload, batas ukuran JSON, penyimpanan setelah restart, serta respons dan kegagalan AI. Database proyek dan provider AI asli tidak dipakai untuk pengujian.
