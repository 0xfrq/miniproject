# PostgreSQL lokal dan akun sekolah

PostgreSQL 18 berjalan di laptop pada `127.0.0.1:5432`. Aplikasi menggunakan driver `pg` dari server Next.js. `runpsql.bat` tetap bisa dipakai untuk membuka SQL Shell secara manual; aplikasi tidak menjalankan batch tersebut untuk setiap permintaan.

## Setup pertama

1. Isi password yang dipilih saat instalasi PostgreSQL pada `.env.local`:

   ```dotenv
   POSTGRES_ADMIN_PASSWORD="password_instalasi_postgresql"
   ADMIN_EMAIL="admin@sdnbangah.local"
   ADMIN_NAME="Administrator"
   ```

   Gunakan `POSTGRES_ADMIN_USER` jika akun instalasi bukan `postgres`, atau `POSTGRES_ADMIN_PORT` jika port bukan `5432`. File ini diabaikan Git. Untuk karakter `$` pada file env Next.js, tulis `\$`.

2. Jalankan:

   ```bash
   npm install
   npm run db:setup
   ```

   Setup membuat database `sdn_bangah` dan role `sdn_bangah_app` dengan password acak. Role aplikasi bukan superuser. Koneksi aplikasi disimpan sebagai `DATABASE_URL` di `.env.local`; password akun instalasi dihapus dari file itu setelah setup berhasil. Jika database/role dengan nama tersebut sudah ada, setup meminta koneksi yang benar dan tidak mengganti password database lama.

   Setup menjalankan migrasi SQL, membuat satu akun admin pertama, dan mengimpor data JSON dalam transaksi. Password login admin yang dibuat secara acak tersimpan di `.local/setup/admin-credentials.txt`. Password login aplikasi berbeda dari password PostgreSQL.

3. Jalankan aplikasi:

   ```bash
   npm run dev
   ```

   Buka `http://localhost:3000/login`, pilih **Admin**, lalu gunakan kredensial lokal tersebut. Jika server sudah berjalan sebelum setup, mulai ulang agar `DATABASE_URL` terbaca.

4. Pada sidebar admin, buka **Akun guru** untuk membuat akun guru beserta nama, email, password awal (12–128 karakter), kelas, dan tahun ajaran. Guru masuk melalui halaman login dengan peran **Guru**.

## Data yang dipertahankan

JSON asli di `data/db.json` tidak dihapus atau dipakai untuk menyimpan perubahan baru. Import mempertahankan ID, seluruh isi record, urutan, dan relasi soal/penilaian dengan ulangan. Duplikat dengan ID dan isi yang identik dihitung sebagai satu record; duplikat dengan isi berbeda menghentikan import untuk diperiksa.

Materi, ulangan, soal, dan hasil lama belum memiliki informasi pemilik, sehingga dimiliki oleh akun admin awal setelah migrasi. Admin dapat mengakses data ini melalui `/guru`. Akun guru baru hanya dapat mengakses record miliknya; data lama tidak dibagikan ke semua guru.

Tabel PostgreSQL memisahkan akun, sesi, profil sekolah, konten publik, materi, ulangan, soal, dan hasil penilaian. Kolom JSONB pada tabel konten mempertahankan field prototipe yang bervariasi; ID pemilik dan relasi ulangan menggunakan foreign key SQL. Penambahan ulangan beserta daftar `questions` disimpan dalam satu transaksi.

Menjalankan `db:setup` kembali tidak mengimpor ulang atau menimpa edit yang sudah tersimpan di PostgreSQL. Migrasi berikutnya dapat dijalankan dengan `npm run db:migrate`.

## Akses dan sesi

- Profil sekolah dan konten publik tetap dapat dibaca tanpa login.
- `/admin` dan API pengelolaan sekolah/akun hanya untuk admin.
- `/guru`, generator AI, materi, ulangan, soal, dan hasil penilaian memerlukan login.
- Guru hanya dapat membaca dan mengubah data ajarnya sendiri. Admin dapat mengelola semua data.
- `/api/me` mengembalikan identitas akun yang sesinya diverifikasi server.
- Sesi disimpan di PostgreSQL selama 7 hari. Cookie menggunakan HttpOnly dan SameSite=Lax. Aktifkan `AUTH_COOKIE_SECURE=true` jika aplikasi dilayani melalui HTTPS; untuk localhost HTTP gunakan nilai default `false`.
- Tombol **Keluar** menghapus sesi. Menonaktifkan akun atau mereset password guru menghapus seluruh sesi akun tersebut.
- Tidak ada pendaftaran akun guru mandiri atau tombol bypass login demo.

Autentikasi tidak mengubah status fitur scan yang masih berupa demo. Halaman publik mempertahankan desain dan perilaku frontend yang sudah ada.

## Pengujian

```bash
npm test
```

Pengujian membuat build produksi, lalu menjalankan PostgreSQL sementara dengan password acak pada port lain. Lokasi default binari Windows: `C:/Program Files/PostgreSQL/18/bin`. Gunakan `PG_BIN` jika PostgreSQL ada di lokasi berbeda. Jika Windows membatasi peluncuran proses PostgreSQL, jalankan pengujian dari terminal normal di luar sandbox.

Sebagai alternatif, `TEST_DATABASE_URL` dapat menunjuk ke koneksi PostgreSQL lokal yang mengizinkan pembuatan schema. Pengujian hanya membuat dan menghapus schema acak dengan awalan `sdn_test_`; tidak mengubah schema aplikasi. Provider AI tiruan lokal digunakan agar pengujian tidak mengirim konten atau biaya ke provider asli.

## Asisten AI, buku SIBI, dan OCR

Migrasi `002_books_rag_assistant.sql` menambahkan katalog buku, potongan teks RAG (`book_chunks`), dan riwayat percakapan asisten. Jalankan `npm run db:migrate` setelah menarik perubahan ini.

- **Katalog buku SIBI**: `npm run books:sync` mengambil semua buku teks PDF SD kelas 1–6 (Kurikulum Merdeka dan K13) dari API resmi `buku.kemendikdasmen.go.id`. Katalog juga otomatis diambil saat pertama kali menu **Buku SIBI** dibuka.
- **Indexing per buku**: tombol **Siapkan untuk AI** mengunduh PDF ke `.local/books/`, mengekstrak teks di worker thread, lalu membuat embedding `gemini-embedding-001` (768 dimensi). Kuota gratis Gemini dibatasi sekitar 30.000 token per menit, jadi satu buku memerlukan sekitar 2–6 menit. Untuk menyiapkan banyak buku sekaligus dari terminal: `npm run books:index -- --grade 4 --curriculum merdeka` atau `npm run books:index -- <id buku>`.
- **Asisten AI**: menjawab berdasarkan potongan buku yang dipilih (pencarian hybrid embedding + full-text bahasa Indonesia) dan mencantumkan halaman PDF sumber.
- **Generator**: materi (menu Materi) dan soal ujian beserta kunci jawaban (menu Ulangan → *Buat dengan AI*) dapat memakai buku referensi.
- **OCR lembar jawaban**: menu Penilaian → *Tambah penilaian* (satu siswa) atau *Scan batch (OCR)* (seluruh kelas). Gemini Vision membaca nama, no. absen, dan jawaban. Pilihan ganda dinilai otomatis, isian/essay mendapat usulan nilai AI, dan guru meninjau sebelum menyimpan. Mode batch membaca 3 foto sekaligus dan otomatis menggabungkan foto tanpa nama/no. absen sebagai halaman lanjutan siswa sebelumnya. Bila model utama sibuk (503/429) atau lambat (> `AI_OCR_HEDGE_MS`, default 10 detik), permintaan dialihkan atau dikirim paralel ke model cadangan `AI_VISION_FALLBACK_MODELS` (default `gemini-3.5-flash-lite` untuk endpoint Gemini). Foto tidak disimpan di server.

Variabel opsional di `.env`: `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMENSIONS` (default 768; ubah sebelum ada buku terindeks), `AI_EMBEDDING_TPM` (default 25000), `AI_VISION_MODEL` (default `AI_MODEL`), `AI_VISION_FALLBACK_MODELS` (kosongkan untuk mematikan cadangan), `AI_OCR_HEDGE_MS`, `SIBI_API_BASE`, dan `BOOKS_CACHE_DIR`.
