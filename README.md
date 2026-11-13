# Smart School Learning Platform

Platform profil sekolah dan workspace guru SDN Bangah No. 383 menggunakan Next.js App Router dan React. Halaman, aset publik, dan API dijalankan oleh satu server Next.js.

## Menjalankan

Prasyarat: Node.js 18.18 atau lebih baru, npm, dan PostgreSQL 18 lokal. Panduan koneksi dan akun pertama: [SETUP_DATABASE.md](SETUP_DATABASE.md).

```bash
npm install
npm run db:setup
npm run dev
```

Alamat default: `http://localhost:3000`. Untuk memilih port atau host lain, gunakan argumen Next.js, misalnya `npm run dev -- --port 3001 --hostname 127.0.0.1`.

Untuk menjalankan versi produksi, buat build terlebih dahulu:

```bash
npm run build
npm start
```

## Halaman

- `/` dan `/index.html`: profil publik sekolah.
- `/berita/:id`: isi lengkap berita sekolah; berita yang dihapus menghasilkan halaman 404.
- `/login`: login akun admin atau guru.
- `/admin`: editor profil sekolah, galeri, informasi, dan agenda.
- `/guru`: workspace materi, ulangan, penilaian, dan riwayat guru.
- `/ai-learning-generator.html`: generator materi dan soal dengan alur review guru.

Halaman publik di `app/page.js` mempertahankan desain sekolah yang sudah ada. `next.config.js` memetakan `/index.html` ke `/` tanpa redirect agar tautan lama tetap berfungsi. Profil, galeri, berita, dan agenda dibaca dari PostgreSQL melalui API. Halaman mengambil perubahan terbaru ketika dibuka atau tab kembali aktif.

Admin dapat mengubah identitas, judul dan isi profil, visi/misi, kontak, tautan Instagram, logo, dan foto utama melalui **Profil sekolah**. Menu **Galeri**, **Informasi & blog**, dan **Agenda** mengelola konten publik. Klik **Tambah**, isi formulir, lalu **Simpan** untuk menerbitkan; **Batal** tidak membuat record baru. Berita mendukung ringkasan dan isi lengkap dalam teks biasa. Foto dapat menggunakan URL atau upload JPG, PNG, GIF, WebP, dan AVIF hingga 4 MiB per file; upload disimpan bersama konten di database.

Kalender menampilkan bulan saat ini menurut waktu Jakarta, dengan pilihan bulan serta tombol navigasi. Agenda disusun menurut tanggal sebenarnya, termasuk tanggal lama berformat Indonesia. Jika belum ada konten atau foto, halaman menampilkan keterangan yang sesuai.

Generator HTML berada di `templates/` dan dilayani melalui route Next.js yang memeriksa sesi. CSS, JavaScript, dan aset publik tetap berada di `public/`. Halaman admin dan guru memerlukan login; pilihan masuk mode demo telah digantikan autentikasi sebenarnya. Admin dapat membuat, mengedit, menonaktifkan, dan mereset password akun guru melalui menu **Akun guru**.

Di **Workspace Guru → Materi**, guru dapat menambah, melihat isi lengkap, mengedit, dan menghapus materi miliknya. Formulir memuat judul, mata pelajaran, kelas, ringkasan opsional, isi materi, serta status **Draft** atau **Siap digunakan**. Menambah atau membatalkan formulir tidak langsung membuat record. Penyimpanan memperbarui daftar, riwayat, dan jumlah materi di dashboard tanpa reload. Hapus memerlukan konfirmasi; jika penyimpanan gagal, formulir beserta isinya tetap terbuka.

Validasi browser dan server mewajibkan judul, mata pelajaran, kelas, serta isi materi. Batasnya: judul 200, mata pelajaran/kelas 100, ringkasan 2.000, dan isi materi 2.000.000 karakter. Waktu penyimpanan ditentukan server dan ditampilkan menurut WIB. Record lama tetap disimpan; tidak ada migrasi data tambahan untuk fitur materi manual.

Untuk mencetak materi, pilih **Materi → Lihat → Cetak materi / PDF**. Pratinjau A4 memuat identitas sekolah, judul, mata pelajaran, kelas, waktu pembaruan, ringkasan bila diisi, dan isi lengkap materi. Pilih **Cetak / Simpan PDF** untuk membuka dialog browser. Draft diberi label; materi tanpa isi belum dapat dicetak. Dokumen membaca data terakhir yang disimpan, sehingga perubahan formulir yang belum disimpan tidak ikut tercetak.

Di **Workspace Guru → Ulangan**, guru dapat membuat, membuka, mengedit, dan menghapus ulangan miliknya. Formulir memuat judul, mata pelajaran, kelas, durasi 1–600 menit, serta status **Draft** atau **Siap digunakan**. Setiap ulangan mendukung hingga 200 soal: **Pilihan Ganda**, **Isian Singkat**, dan **Essay**. Guru dapat mengubah pertanyaan, menambah/menghapus pilihan (2–6 pilihan untuk pilihan ganda), memilih kunci jawaban, menulis pembahasan, menghapus soal, dan memindahkan urutannya menggunakan tombol panah. Perubahan lokal baru tersimpan saat **Simpan ulangan** diklik; **Batal** tidak menerbitkan perubahan.

Draft boleh belum memiliki soal atau kunci jawaban. Setiap soal yang ditambahkan memerlukan pertanyaan; pilihan ganda memerlukan pilihan yang terisi dan berbeda. Status **Siap digunakan** memerlukan minimal satu soal dan kunci yang valid pada semua soal. **Lembar soal** menampilkan soal tanpa kunci/pembahasan; **Kunci jawaban** merupakan tampilan terpisah untuk guru. Soal tanpa relasi ulangan dari data lama tidak dimasukkan ke suatu lembar secara otomatis.

Penyimpanan judul dan seluruh soal dilakukan dalam satu transaksi PostgreSQL. ID soal yang masih digunakan dipertahankan ketika diubah atau diurutkan ulang; nomor dan jumlah soal dihitung server. Penghapusan ulangan memerlukan konfirmasi dan menghapus soal terkait. Ulangan dengan hasil penilaian tidak dapat dihapus (HTTP 409), sehingga nilai lama tetap tersimpan. Edit dengan `expectedUpdatedAt` yang sudah kedaluwarsa juga menghasilkan 409 agar perubahan baru tidak tertimpa. Tidak ada migrasi schema atau perubahan otomatis pada record lama untuk fitur ini.

Untuk mencetak, buka ulangan tersimpan lalu pilih **Cetak lembar soal** atau **Cetak kunci jawaban**. Pratinjau dibuka di tab terpisah; pilih **Cetak / Simpan PDF**, lalu printer atau tujuan **Save as PDF** pada dialog browser. Gunakan A4, skala 100%, dan matikan header/footer browser bila tidak diperlukan. Lembar soal memuat identitas sekolah dari CMS, informasi ulangan, kolom nama/kelas/tanggal, pilihan jawaban, serta ruang jawaban (dua baris untuk isian dan enam untuk essay). Kunci merupakan dokumen guru terpisah dengan jawaban dan pembahasan dalam urutan yang sama. Toolbar tidak ikut tercetak, dan soal dijaga tetap satu blok halaman jika muat.

Kedua pratinjau memuat data SQL terakhir saat dibuka, sesuai kepemilikan akun. Draft diberi label **DRAFT — UNTUK DITINJAU**; ulangan kosong belum dapat dicetak. Kolom kunci dan pembahasan dihapus di server sebelum data lembar soal dikirim ke browser, termasuk data React yang tertanam dalam HTML. Rute dokumen adalah `/guru/ulangan/:id/cetak/soal` dan `/guru/ulangan/:id/cetak/kunci`; keduanya memerlukan login dan mengembalikan 404 jika ulangan sudah dihapus atau tidak tersedia untuk akun tersebut.

Di **Workspace Guru → Penilaian**, pilih **Tambah penilaian**, isi nama siswa, lalu pilih ulangan **Siap digunakan** yang memiliki soal dan kunci lengkap. Pertanyaan diambil dari ulangan tersimpan; tidak ada jawaban contoh yang dibuat otomatis. Pilihan ganda dinilai server, sedangkan isian singkat dan essay memerlukan nilai guru 0–10 per soal (maksimal dua angka desimal). Semua soal berbobot sama, maksimal 10 poin; nilai akhir adalah `total poin / poin maksimal × 100`, dibulatkan dua angka desimal. Jawaban kosong bernilai nol; jawaban tertulis kosong tidak dapat diberi poin positif. Catatan per soal dan catatan keseluruhan bersifat opsional.

Hasil dapat dilihat, diedit, dan dihapus dengan konfirmasi. Daftar, jumlah hasil, rata-rata dashboard, dan riwayat diperbarui setelah penyimpanan. Server menentukan ulang nilai dan jumlah soal penuh/sebagian/nol poin dari jawaban asli, sehingga nilai akhir yang dikirim client tidak dipercaya. Setiap hasil menyimpan salinan soal, kunci, identitas, dan versi ulangan yang digunakan. Edit hasil tetap memakai salinan tersebut walaupun ulangan kemudian berubah. Ulangan tidak dapat diganti pada hasil tersimpan; buat hasil baru untuk ulangan lain. Semua hasil dibatasi menurut kepemilikan guru.

Ringkasan nilai lama tetap ditampilkan dengan label **Ringkasan lama**. Nama, nilai ringkasan, dan catatan dapat diperbarui tanpa membuat rincian jawaban baru; jumlah benar/salah lama tetap dipertahankan sebagai data historis. Ringkasan asli disalin ke `originalSummary` saat pertama kali diedit. Penilaian baru wajib memuat jawaban per soal, bukan hanya angka nilai. Tidak ada perubahan otomatis pada data lama atau migrasi schema tambahan.

Di halaman daftar **Penilaian**, gunakan panel **Ekspor nilai ke CSV**, pilih ulangan, lalu **Unduh CSV**. File hanya memuat hasil tersimpan untuk ulangan tersebut, satu baris per hasil dengan ID unik; nama yang sama tidak digabung. Kolom mencakup nama, identitas ulangan, nilai, poin, rincian jumlah soal, jenis hasil, waktu pembaruan, dan catatan. Identitas ulangan pada hasil baru mengikuti salinan yang tersimpan bersama nilai. Hasil lama diberi label dan kolom rincian yang tidak tersedia dikosongkan. Ulangan tanpa hasil menghasilkan file berisi judul kolom saja.

CSV menggunakan UTF-8 dengan BOM, pemisah titik koma, dan desimal koma untuk Excel berbahasa Indonesia. Jika Excel tidak memisahkan kolom otomatis, gunakan **Data → From Text/CSV** dengan encoding UTF-8 dan delimiter semicolon (`;`). Kutip, pemisah, baris baru, dan karakter Unicode dipertahankan; teks yang diawali karakter formula spreadsheet diberi awalan apostrof agar dibaca sebagai teks. Rincian jawaban dan kunci tidak disertakan pada ekspor nilai. Kegagalan unduhan ditampilkan pada panel dan dapat dicoba ulang.

Untuk laporan individual, pilih **Penilaian → Lihat → Cetak laporan / PDF**. Laporan A4 menampilkan nama, identitas ulangan, nilai akhir, total poin, jawaban per soal, acuan jawaban, poin yang diberikan, pembahasan, dan catatan guru/hasil. Dokumen menggunakan salinan soal dan kunci pada hasil tersimpan; perubahan ulangan setelah penilaian tidak mengganti isi laporan lama. Hasil ringkasan lama tetap dapat dicetak dengan penjelasan bahwa rincian jawaban belum tersedia. Semua halaman cetak dan endpoint CSV memeriksa sesi serta kepemilikan akun; tidak ada migrasi database atau perubahan data akibat mencetak/mengunduh.

## API

Semua endpoint menggunakan Next.js Route Handlers di `app/api/` dengan runtime Node.js.

- `GET /api/health`: status layanan dan konfigurasi AI.
- `POST /api/auth/login` dan `POST /api/auth/logout`: mulai dan akhiri sesi login.
- `GET /api/me`: identitas akun yang sesinya diverifikasi server.
- `GET /api/admin/users`, `POST /api/admin/users`, `PUT /api/admin/users/:id`: pengelolaan akun guru oleh admin.
- `GET /api/ai/status`: status konfigurasi AI.
- `GET /api/site` dan `PUT /api/site`: membaca dan memperbarui profil sekolah.
- `GET /api/dashboard`: ringkasan workspace.
- `GET /api/:collection` dan `POST /api/:collection`: daftar dan tambah data.
- `PUT /api/:collection/:id` dan `DELETE /api/:collection/:id`: ubah dan hapus data.
- `GET /api/:collection/:id`: detail record; data privat tetap memerlukan sesi dan diperiksa kepemilikannya.
- `GET /api/assessments/:id/grades.csv`: unduhan CSV nilai tersimpan untuk satu ulangan, dengan pemeriksaan sesi/kepemilikan dan respons tanpa cache.

Collection yang tersedia: `activities`, `posts`, `agenda`, `materials`, `assessments`, `questions`, dan `grading`. Penambahan data menghasilkan status `201`; penghapusan berhasil menghasilkan `204`. Payload JSON dibatasi 20 MiB.

Konten sekolah dapat dibaca publik dan hanya dapat diubah admin. Materi, ulangan, soal, hasil penilaian, dan endpoint AI memerlukan sesi login. Guru hanya dapat mengakses data ajarnya sendiri. Admin dapat mengakses seluruh data. `POST /api/assessments` menerima daftar `questions` opsional (default kosong untuk draft). `GET /api/assessments/:id` mengembalikan detail beserta soal berurutan; `PUT` menerima daftar `questions` untuk menyimpan seluruh susunan soal secara atomik. Jika `questions` tidak dikirim pada `PUT`, soal lama dipertahankan. API soal langsung juga menjaga jumlah soal dan validitas status ulangan terkait.

`POST /api/grading` memerlukan `studentName`, `assessmentId`, `assessmentVersion` (nilai `updatedAt` dari detail ulangan), serta `answers: [{ questionId, response, points, feedback }]`. `points` diabaikan untuk pilihan ganda dan wajib berupa angka 0–10 untuk soal tertulis. Versi ulangan yang sudah berubah menghasilkan HTTP 409. `PUT /api/grading/:id` mendukung perubahan jawaban/catatan dan `expectedUpdatedAt` untuk pemeriksaan edit kedaluwarsa; salinan soal dan kunci tidak dapat diganti oleh payload client.

Endpoint AI:

- `POST /api/ai/search-reference`
- `POST /api/ai/generate-material`
- `POST /api/ai/generate-questions`
- `POST /api/ai/analyze-assessment`

Konfigurasi provider menggunakan variabel dalam `.env.example`. Buat `.env` dan isi `AI_API_KEY`, `AI_BASE_URL`, serta `AI_MODEL`. API key hanya dipakai di server.

## Penyimpanan dan batasan prototipe

`lib/store.js` menggunakan PostgreSQL melalui `lib/sql-store.js` dan `lib/database.js`. Setup mengimpor data awal dari `data/db.json` satu kali tanpa menghapus atau mengubah file asal. Perubahan berikutnya disimpan di PostgreSQL. ID, isi record, urutan, dan relasi lama dipertahankan; record lama dimiliki admin pertama karena JSON belum mencatat pembuatnya.

Koneksi role aplikasi disimpan di `.env.local`. Kredensial admin pertama yang dihasilkan setup berada di `.local/setup/admin-credentials.txt`. Kedua lokasi diabaikan Git. Migrasi berikutnya: `npm run db:migrate`. Setup ulang tidak menimpa edit yang sudah ada di SQL.

Penilaian manual pada `/guru` menggunakan jawaban asli dan perhitungan server. Pemindaian/OCR belum terhubung ke alur ini. Generator HTML lama masih memiliki tampilan scan demo; hasil baru melalui API tetap wajib memenuhi validasi jawaban asli. Pencarian referensi menghasilkan saran AI yang perlu diverifikasi. Integrasi AI ditunda sampai alur manual selesai.

## Verifikasi

```bash
npm test
```

Perintah ini membuat build produksi dan menjalankan PostgreSQL sementara di port lain serta provider AI tiruan lokal. Pengujian mencakup import data, setup ulang, password, sesi, login/logout, role admin/guru, isolasi data antar guru, transaksi ulangan, perubahan serentak, CRUD, batas payload, restart, respons/kegagalan AI, serta publikasi profil/galeri/berita/agenda, halaman berita, kalender, dan validasi gambar/tanggal. Database aplikasi dan provider AI asli tidak dipakai untuk pengujian. Detail pengaturan Windows dan `TEST_DATABASE_URL` tersedia pada [SETUP_DATABASE.md](SETUP_DATABASE.md).

Untuk membuat build pemeriksaan tanpa mengganggu server development yang aktif, gunakan direktori terpisah. Contoh PowerShell: `$env:NEXT_DIST_DIR = '.next-cms-check'`, lalu `npm run build` atau `npm test`.
