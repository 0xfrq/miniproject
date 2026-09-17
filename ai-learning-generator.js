/* Frontend demo services are intentionally isolated here.
 * AI generation calls the local Express backend. The API key never reaches this browser page:
 * /api/ai/generate-material, /api/ai/generate-questions, /api/ai/analyze-assessment.
 * Reference lookup and answer-sheet grading remain mock services until their provider is wired.
 * Google/PDF discovery must run on the backend because browser-side scraping is blocked by CORS,
 * robots policies, and should be handled with source/licensing checks before a real download.
 */

(() => {
  'use strict';

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const root = document.querySelector('#view-root');
  const staticIconRoot = document.body;
  const breadcrumbs = document.querySelector('#breadcrumbs');
  const toast = document.querySelector('#toast');
  const toastMessage = document.querySelector('#toast-message');
  const dialog = document.querySelector('#app-dialog');
  const dialogContent = document.querySelector('#dialog-content');
  const sheetUpload = document.querySelector('#sheet-upload');
  const cameraUpload = document.querySelector('#camera-upload');

  const materialSections = [
    { id: 'pendahuluan', title: 'Pendahuluan', body: 'Pernahkah kamu bertanya mengapa kita tetap dapat berlari, berbicara, dan berpikir meskipun tidak selalu menyadari cara tubuh bekerja? Semua itu berkaitan dengan sistem pernapasan. Sistem ini membantu tubuh mendapatkan oksigen dan membuang karbon dioksida.' },
    { id: 'inti', title: 'Materi Inti', body: 'Sistem pernapasan manusia terdiri dari beberapa organ yang bekerja bersama. Udara masuk melalui hidung, lalu melewati tenggorokan dan trakea sebelum menuju bronkus. Dari bronkus, udara bergerak ke paru-paru dan sampai ke alveolus. Di alveolus terjadi pertukaran oksigen dan karbon dioksida dengan bantuan pembuluh darah.' },
    { id: 'aktivitas', title: 'Aktivitas Pembelajaran', body: 'Dalam kelompok kecil, buatlah diagram perjalanan udara dari hidung hingga alveolus. Tandai tempat terjadinya pertukaran gas. Setelah itu, bandingkan diagram kelompokmu dengan kelompok lain dan jelaskan satu perbedaannya.' },
    { id: 'rangkuman', title: 'Rangkuman', body: 'Organ pernapasan bekerja sebagai satu rangkaian. Hidung menyaring udara, saluran pernapasan mengantarkannya, dan paru-paru menjadi tempat pertukaran oksigen serta karbon dioksida. Menjaga kualitas udara dan kesehatan tubuh membantu sistem ini bekerja dengan baik.' },
    { id: 'latihan', title: 'Latihan', body: 'Jelaskan dengan kalimatmu sendiri mengapa alveolus memiliki peran penting dalam sistem pernapasan. Sebutkan pula dua kebiasaan yang dapat membantu menjaga kesehatan organ pernapasan.' },
  ];

  const state = {
    view: readView(),
    materialStep: 1,
    materialConfig: { subject: 'IPA', grade: 'Kelas 5 SD', topic: 'Sistem Pernapasan Manusia', objective: 'Siswa mampu menjelaskan fungsi organ pernapasan manusia.', duration: '2 × 35 menit', depth: 'Sesuai usia' },
    materialFormat: 'Materi + Aktivitas',
    referenceQuery: { title: '', isbn: '' },
    referenceResults: [],
    selectedReference: null,
    referenceSearching: false,
    materialGenerating: false,
    materialGenerated: false,
    materialEditMode: false,
    materialSections: materialSections.map((section) => ({ ...section })),
    materialSaved: false,
    questionStep: 1,
    questionConfig: { subject: 'Matematika', grade: 'Kelas 5 SD', topic: 'Pecahan', objective: 'Siswa mampu membandingkan dan menyelesaikan operasi pecahan sederhana.', total: 20, duration: '35 menit', multiple: 15, short: 3, essay: 2 },
    questionDifficulty: 'Campuran',
    difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
    questionGenerating: false,
    questionsGenerated: false,
    questions: [],
    gradingStage: 'upload',
    gradingProgress: 0,
    gradingFiles: [],
    gradingResults: null,
    gradingAnalysis: null,
    gradingAnalysisLoading: false,
    scanner: null,
    historyFilter: { subject: 'Semua mata pelajaran', type: 'Semua jenis' },
    draggedQuestionId: null,
    toastTimer: null,
  };

  async function requestAI(path, payload) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 125000);
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Permintaan AI gagal.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Permintaan AI terlalu lama. Silakan coba lagi dengan format materi yang lebih ringkas.');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const mockServices = {
    async searchReferenceBook(query) {
      const response = await requestAI('/api/ai/search-reference', query);
      return response.results;
    },
    async generateMaterial(config) {
      const response = await requestAI('/api/ai/generate-material', { ...config, format: state.materialFormat, reference: state.selectedReference });
      return response;
    },
    async generateQuestions(config) {
      const response = await requestAI('/api/ai/generate-questions', { ...config, difficulty: state.questionDifficulty, distribution: state.difficultyDistribution });
      return response.questions;
    },
    async analyzeAssessment(results) {
      const response = await requestAI('/api/ai/analyze-assessment', { results });
      return response.analysis;
    },
    async gradeAnswerSheet(files) {
      await sleep(900);
      return {
        assessment: 'Ulangan Harian Matematika — Pecahan',
        totalQuestions: 20,
        results: [
          { name: 'Andi Pratama', correct: 18, wrong: 2, score: 90, status: 'Selesai', confidence: 'Tinggi' },
          { name: 'Siti Aulia', correct: 16, wrong: 4, score: 80, status: 'Selesai', confidence: 'Tinggi' },
          { name: 'Budi Santoso', correct: 14, wrong: 6, score: 70, status: 'Perlu ditinjau', confidence: 'Sedang' },
          { name: 'Citra Lestari', correct: 17, wrong: 3, score: 85, status: 'Selesai', confidence: 'Tinggi' },
        ],
        files,
      };
    },
  };

  function readView() {
    const allowed = ['dashboard', 'material', 'questions', 'grading', 'history'];
    const value = window.location.hash.replace('#', '');
    return allowed.includes(value) ? value : 'dashboard';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
  }

  function formatFileNames(files) {
    return files.map((file) => file.name || 'Foto lembar jawaban').join(', ');
  }

  function navigate(view) {
    if (window.location.hash === `#${view}`) {
      state.view = view;
      render();
      return;
    }
    window.location.hash = view;
  }

  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4200);
  }

  function hideToast() {
    toast.classList.remove('is-visible');
    window.clearTimeout(state.toastTimer);
  }

  function setDialog(content) {
    dialogContent.innerHTML = `<div class="dialog-content">${content}</div>`;
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function showDialog(kind, data = {}) {
    const dialogs = {
      profile: `<p class="eyebrow">Akun aktif</p><h2>Profil Bu Rina</h2><p>Guru kelas 5A di SDN Bangah No. 383. Semua materi dan penilaian yang dibuat di workspace ini tersimpan atas nama akun ini.</p><ul class="dialog-list"><li><strong>Peran</strong><br />Guru kelas</li><li><strong>Konteks belajar</strong><br />Kelas 5A · Tahun ajaran 2024/25</li></ul><button class="button button--primary" type="button" data-action="close-dialog">Tutup</button>`,
      settings: `<p class="eyebrow">Preferensi workspace</p><h2>Pengaturan</h2><p>Atur pengalaman membuat materi dan soal. Pengaturan ini masih berupa contoh UI dan belum terhubung ke backend.</p><ul class="dialog-list"><li>Bahasa keluaran AI <strong>Bahasa Indonesia</strong></li><li>Mode tinjauan guru <strong>Selalu aktif</strong></li><li>Notifikasi aktivitas <strong>Aktif</strong></li></ul><button class="button button--primary" type="button" data-action="close-dialog">Selesai</button>`,
      help: `<p class="eyebrow">Panduan singkat</p><h2>AI membantu, guru memutuskan.</h2><p>Mulai dari konteks belajar, baca hasil AI, ubah bagian yang diperlukan, lalu simpan atau gunakan. Tidak ada materi yang dipublikasikan otomatis.</p><ul class="dialog-list"><li><strong>1 · Beri konteks</strong><br />Topik, kelas, tujuan, dan durasi membantu AI menyusun keluaran yang relevan.</li><li><strong>2 · Periksa</strong><br />Setiap paragraf dan soal dapat diedit atau dibuat ulang per bagian.</li><li><strong>3 · Setujui</strong><br />Simpan sebagai draft atau gunakan setelah yakin dengan isinya.</li></ul><button class="button button--primary" type="button" data-action="close-dialog">Saya mengerti</button>`,
      notifications: `<p class="eyebrow">Notifikasi</p><h2>Beberapa hal baru.</h2><ul class="dialog-list"><li><strong>Hasil penilaian siap ditinjau</strong><br />Ulangan Harian Matematika memiliki satu lembar dengan confidence sedang.</li><li><strong>Catatan tersimpan</strong><br />Materi IPA — Sistem Pernapasan tersimpan sebagai draft kemarin.</li></ul><button class="button button--primary" type="button" data-action="close-dialog">Tutup</button>`,
      school: `<p class="eyebrow">Konteks workspace</p><h2>SDN Bangah No. 383</h2><p>Prototype ini menggunakan satu konteks sekolah dan satu kelas agar alur demo tetap fokus.</p><ul class="dialog-list"><li><strong>Kelas aktif</strong><br />5A · Wali kelas Bu Rina</li><li><strong>Tahun ajaran</strong><br />2024/25</li></ul><button class="button button--primary" type="button" data-action="close-dialog">Gunakan konteks ini</button>`,
      student: `<p class="eyebrow">Inspeksi jawaban</p><h2>${escapeHtml(data.name || 'Siswa')}</h2><p>Ringkasan ini membantu guru menemukan jawaban yang perlu dilihat lebih dekat.</p><ul class="dialog-list"><li><strong>Jawaban benar</strong><br />${data.correct || 0} dari 20 soal</li><li><strong>Jawaban salah</strong><br />${data.wrong || 0} soal</li><li><strong>Confidence pembacaan</strong><br />${data.confidence || 'Tinggi'} · cocokkan dengan lembar asli bila perlu</li></ul><button class="button button--primary" type="button" data-action="close-dialog">Kembali ke hasil</button>`,
    };
    setDialog(dialogs[kind] || dialogs.help);
  }

  function stepper(current, labels) {
    return `<div class="stepper" aria-label="Tahapan proses">${labels.map((label, index) => {
      const number = index + 1;
      const status = number < current ? 'is-done' : number === current ? 'is-active' : '';
      return `<div class="step ${status}"><span class="step__number">${number < current ? '✓' : number}</span><span>${label}</span>${number < labels.length ? '<span class="step__connector" aria-hidden="true"></span>' : ''}</div>`;
    }).join('')}</div>`;
  }

  function hydrateIcons(container = document) {
    const iconPaths = {
      home: '<path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5M9 21v-6h6v6"/>',
      book: '<path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z"/><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H19M8.5 8h6M8.5 11h4"/>',
      clipboard: '<rect x="5" y="4.5" width="14" height="16" rx="1.5"/><path d="M9 4.5V3h6v1.5M8.5 9h7M8.5 12h7M8.5 15h4"/>',
      clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
      scan: '<path d="M5 8V5h3M16 5h3v3M19 16v3h-3M8 19H5v-3"/><path d="M8 12h8M12 8v8"/>',
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
      upload: '<path d="M12 16V4M8 8l4-4 4 4M5 15v4h14v-4"/>',
      camera: '<path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4v-10Z"/><circle cx="12" cy="13.5" r="3"/>',
      spark: '<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z"/>',
      arrow: '<path d="M5 19 19 5M9 5h10v10"/>',
      chevronRight: '<path d="m9.5 5 7 7-7 7"/>',
      check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
      menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
      user: '<circle cx="12" cy="8" r="3.3"/><path d="M5 20c.7-3.2 3.1-5 7-5s6.3 1.8 7 5"/>',
      settings: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1-1.5 2.6-.2-.1a2 2 0 0 0-2.2.1l-.2.1a2 2 0 0 0-1 1.8v.2h-3v-.2a2 2 0 0 0-1.1-1.8l-.2-.1a2 2 0 0 0-2.2-.1l-.2.1-1.5-2.6.1-.1a2 2 0 0 0 .1-2.2v-.2a2 2 0 0 0-1.4-1.5H5.1V8h.3a2 2 0 0 0 1.4-1.4v-.2a2 2 0 0 0-.1-2.2l-.1-.1L8.1 1.5l.2.1a2 2 0 0 0 2.2-.1l.2-.1V1.2h3v.2a2 2 0 0 0 1 1.8l.2.1a2 2 0 0 0 2.2.1l.2-.1 1.5 2.6-.1.1a2 2 0 0 0-.1 2.2v.2a2 2 0 0 0 1.4 1.5h.3v3h-.3a2 2 0 0 0-1.4 1.5v.2a2 2 0 0 0 .1 2.2Z"/>',
      bell: '<path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8ZM10 21h4"/>' ,
    };
    container.querySelectorAll('[data-icon]').forEach((node) => {
      const name = node.dataset.icon;
      if (!iconPaths[name] || node.querySelector('svg')) return;
      node.innerHTML = `<svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`;
    });
  }

  function render() {
    state.view = readView();
    hydrateIcons(staticIconRoot);
    const viewNames = { dashboard: 'Dashboard', material: 'Generate Materi', questions: 'Generate Soal', grading: 'Auto Grading', history: 'Riwayat' };
    breadcrumbs.querySelector('strong').textContent = viewNames[state.view];
    root.innerHTML = ({ dashboard: renderDashboard, material: renderMaterial, questions: renderQuestions, grading: renderGrading, history: renderHistory }[state.view])();
    hydrateIcons(root);
    document.querySelectorAll('[data-view]').forEach((element) => element.classList.toggle('is-active', element.dataset.view === state.view));
    document.title = `${viewNames[state.view]} · SDN Bangah`;
    if (state.view === 'material' && state.materialStep === 3 && !state.materialGenerating && !state.materialGenerated) beginMaterialGeneration();
    if (state.view === 'questions' && state.questionStep === 3 && !state.questionGenerating && !state.questionsGenerated) beginQuestionGeneration();
    if (state.scanner) renderScannerOverlay();
  }

  function renderDashboard() {
    return `<div class="view dashboard-view">
      <header class="view-header"><div><p class="eyebrow">Selasa, 20 Mei 2025 · Workspace guru</p><h1>Selamat datang, Bu Rina.</h1><p>Siap membuat pembelajaran hari ini? Mulai dari satu ide, lalu biarkan AI membantu merapikannya.</p></div><span class="badge badge--green">SDN Bangah No. 383 · Kelas 5A</span></header>
      <section class="dashboard-welcome" aria-labelledby="welcome-title"><div><p class="section-label">Ruang kerja hari ini</p><h2 id="welcome-title">Buat pembelajaran yang terasa dekat dengan siswa.</h2><p>AI membantu menyusun materi dan soal berdasarkan konteks yang kamu berikan. Kamu tetap menjadi editor dan pengambil keputusan terakhir.</p></div><div class="welcome-art" aria-hidden="true"><div class="welcome-art__note"><span>Prinsip hari ini</span><strong>Periksa<br />sebelum<br />digunakan.</strong></div></div></section>
      <section class="quick-section" aria-labelledby="quick-title"><div class="quick-section__head"><h2 id="quick-title">Apa yang ingin dibuat?</h2><p>Tiga langkah utama untuk mulai.</p></div><div class="quick-actions">
        <button class="quick-action" type="button" data-view="material"><span class="quick-action__icon" data-icon="plus"></span><span><strong>Buat materi dengan AI</strong><small>Dari topik dan tujuan belajar</small></span><span class="quick-action__arrow" data-icon="arrow" aria-hidden="true"></span></button>
        <button class="quick-action" type="button" data-view="questions"><span class="quick-action__icon" data-icon="plus"></span><span><strong>Buat soal dengan AI</strong><small>Ulangan harian yang terarah</small></span><span class="quick-action__arrow" data-icon="arrow" aria-hidden="true"></span></button>
        <button class="quick-action" type="button" data-view="grading"><span class="quick-action__icon" data-icon="scan"></span><span><strong>Scan & nilai jawaban</strong><small>Foto lembar, lihat hasilnya</small></span><span class="quick-action__arrow" data-icon="arrow" aria-hidden="true"></span></button>
      </div></section>
      <div class="stat-strip" aria-label="Ringkasan aktivitas"><div class="stat-card"><span class="data-label">Total soal dibuat</span><strong class="stat-card__value">86</strong><span class="stat-card__label">sepanjang tahun ajaran</span></div><div class="stat-card"><span class="data-label">Materi dibuat</span><strong class="stat-card__value">12</strong><span class="stat-card__label">4 masih draft</span></div><div class="stat-card"><span class="data-label">Ulangan aktif</span><strong class="stat-card__value">03</strong><span class="stat-card__label">siap digunakan</span></div><div class="stat-card"><span class="data-label">Jawaban dinilai</span><strong class="stat-card__value">68</strong><span class="stat-card__label">lembar bulan ini</span></div></div>
      <div class="dashboard-grid"><section><div class="block-head"><h2>Aktivitas terbaru</h2><button class="button button--text" type="button" data-view="history">Lihat riwayat ↗</button></div><div class="activity-list">
        ${activityRow('Aa', 'Materi IPA — Sistem Pernapasan', 'Materi lengkap · Kelas 5 SD', 'Diedit', 'Kemarin', 'badge--yellow')}
        ${activityRow('∕', 'Ulangan Harian Matematika — Pecahan', '20 soal · Kelas 5 SD', 'Siap digunakan', '18 Mei', 'badge--green')}
        ${activityRow('B', 'Ulangan Bahasa Indonesia — Ide Pokok', '15 soal · Kelas 5 SD', 'Draft', '16 Mei', 'badge--blue')}
      </div></section><section><div class="block-head"><h2>Hasil terbaru</h2><button class="button button--text" type="button" data-view="grading">Buka penilaian ↗</button></div><div class="results-list">${resultRow('Ulangan Harian Matematika', '24 siswa · 20 soal', '82', '18 Mei')} ${resultRow('Latihan IPA — Organ Tubuh', '22 siswa · 10 soal', '78', '12 Mei')} ${resultRow('Bahasa Indonesia — Ide Pokok', '24 siswa · 15 soal', '85', '08 Mei')}</div></section></div>
    </div>`;
  }

  function activityRow(icon, title, meta, status, date, statusClass) {
    return `<div class="activity-row"><span class="activity-row__icon" aria-hidden="true">${icon}</span><div><strong>${title}</strong><small>${meta}</small></div><div class="activity-row__meta"><span class="badge ${statusClass}">${status}</span><span class="activity-row__date">${date}</span></div></div>`;
  }

  function resultRow(title, meta, score, date) {
    return `<div class="result-row"><div><strong>${title}</strong><small>${meta} · ${date}</small></div><span class="result-score">${score}</span></div>`;
  }

  function renderMaterial() {
    const labels = ['Tentukan materi', 'Pilih format', 'AI menyusun', 'Periksa hasil'];
    const head = `<header class="view-header"><div><p class="eyebrow">AI Learning Generator · materi</p><h1>Buat materi pembelajaran.</h1><p>Berikan konteks yang jelas. AI akan membantu menyusun draf, lalu kamu bisa mengedit setiap bagian sebelum digunakan.</p></div><span class="badge badge--yellow">Guru tetap editor utama</span></header>`;
    if (state.materialStep === 3) return `<div class="view material-view">${head}${stepper(3, labels)}${renderMaterialGeneration()}</div>`;
    if (state.materialStep === 4) return `<div class="view material-view">${head}${stepper(4, labels)}${renderMaterialPreview()}</div>`;
    if (state.materialStep === 2) return `<div class="view material-view">${head}${stepper(2, labels)}${renderMaterialFormat()}</div>`;
    return `<div class="view material-view">${head}${stepper(1, labels)}${renderMaterialConfig()}</div>`;
  }

  function renderMaterialConfig() {
    const config = state.materialConfig;
    const referenceResults = state.referenceResults.length ? `<div class="reference-results" aria-live="polite"><div class="reference-results__head"><strong>Hasil pencarian referensi</strong><span class="badge badge--blue">Simulasi Google Search</span></div>${state.referenceResults.map((book) => `<article class="reference-result ${state.selectedReference?.id === book.id ? 'is-selected' : ''}"><span class="reference-result__icon">PDF</span><div><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author)}</small><p>${escapeHtml(book.match)} · ${escapeHtml(book.source)}</p></div><button class="mini-button ${state.selectedReference?.id === book.id ? 'mini-button--primary' : ''}" type="button" data-action="select-reference" data-reference-id="${book.id}">${state.selectedReference?.id === book.id ? 'Dipilih' : 'Pakai referensi'}</button></article>`).join('')}</div>` : '';
    return `<div class="workflow-layout"><div class="workflow-main"><form class="form-card" data-form="material-config"><p class="section-label">Langkah 1 · Tentukan materi</p><h2>Mulai dari konteks belajar.</h2><p>Masukkan topik dan tujuan. Kamu juga dapat mencari buku referensi berdasarkan judul atau ISBN.</p><div class="form-grid">
      ${field('material-subject', 'Mata pelajaran', `<select name="subject"><option ${config.subject === 'IPA' ? 'selected' : ''}>IPA</option><option ${config.subject === 'Matematika' ? 'selected' : ''}>Matematika</option><option ${config.subject === 'Bahasa Indonesia' ? 'selected' : ''}>Bahasa Indonesia</option><option>PPKn</option></select>`)}
      ${field('material-grade', 'Kelas', `<select name="grade"><option ${config.grade === 'Kelas 4 SD' ? 'selected' : ''}>Kelas 4 SD</option><option ${config.grade === 'Kelas 5 SD' ? 'selected' : ''}>Kelas 5 SD</option><option ${config.grade === 'Kelas 6 SD' ? 'selected' : ''}>Kelas 6 SD</option></select>`)}
      ${field('material-topic', 'Topik / materi', `<input name="topic" value="${escapeHtml(config.topic)}" placeholder="Contoh: Sistem pernapasan manusia" required />`, true)}
      ${field('material-duration', 'Durasi pembelajaran', `<select name="duration"><option ${config.duration === '1 × 35 menit' ? 'selected' : ''}>1 × 35 menit</option><option ${config.duration === '2 × 35 menit' ? 'selected' : ''}>2 × 35 menit</option><option>3 × 35 menit</option></select>`)}
      ${field('material-objective', 'Tujuan pembelajaran', `<textarea name="objective" required>${escapeHtml(config.objective)}</textarea>`, true)}
      ${field('material-depth', 'Tingkat kedalaman', `<select name="depth"><option ${config.depth === 'Ringkas' ? 'selected' : ''}>Ringkas</option><option ${config.depth === 'Sesuai usia' ? 'selected' : ''}>Sesuai usia</option><option ${config.depth === 'Mendalam' ? 'selected' : ''}>Mendalam</option></select>`)}
    </div><section class="reference-search" aria-labelledby="reference-title"><div class="reference-search__head"><div><p class="form-label">Referensi buku <span class="badge">Opsional</span></p><h3 id="reference-title">Cari buku untuk menjadi pijakan materi.</h3></div><span class="reference-search__mark" aria-hidden="true" data-icon="search"></span></div><p class="form-hint">Cari berdasarkan nama buku atau ISBN. Sistem nantinya akan mencari sumber PDF melalui backend dan memeriksa sumbernya.</p><div class="reference-search__fields"><div class="form-field"><label class="form-label" for="reference-title-input">Nama buku / materi</label><input id="reference-title-input" name="referenceTitle" value="${escapeHtml(state.referenceQuery.title)}" placeholder="Contoh: Buku IPA Kelas 5" /></div><div class="form-field"><label class="form-label" for="reference-isbn">ISBN <span class="badge">Opsional</span></label><input id="reference-isbn" name="referenceIsbn" inputmode="numeric" value="${escapeHtml(state.referenceQuery.isbn)}" placeholder="978-…" /></div><button class="button button--quiet" type="button" data-action="search-reference">${state.referenceSearching ? 'Mencari…' : 'Cari buku'} <span data-icon="search" aria-hidden="true"></span></button></div>${state.referenceSearching ? '<div class="reference-search__loading">Mencari sumber referensi yang relevan…</div>' : referenceResults}${state.selectedReference ? `<div class="selected-reference"><span>✓</span><p><strong>Referensi terpilih</strong><br />${escapeHtml(state.selectedReference.title)}<small>Dipakai sebagai konteks tambahan, tetap perlu ditinjau guru.</small></p></div>` : ''}</section><div class="form-footer"><button class="button button--primary" type="submit">Lanjut pilih format <span data-icon="chevronRight" aria-hidden="true"></span></button></div></form></div><aside class="workflow-aside"><div class="context-card"><span class="context-card__mark" data-icon="spark"></span><h3>AI yang paham konteks kelas.</h3><p>Masukkan tujuan, tingkat kelas, dan bila perlu satu buku rujukan agar istilah serta contoh tetap relevan.</p></div><div class="ai-note"><strong>Sumber bukan keputusan akhir</strong><p>Hasil pencarian buku hanya menjadi referensi. Guru tetap memeriksa materi, sumber, dan kesesuaiannya sebelum digunakan.</p></div></aside></div>`;
  }

  function renderMaterialFormat() {
    const formats = [
      ['Ringkasan Materi', 'Poin inti yang cepat dibaca'], ['Materi Lengkap', 'Penjelasan bertahap dan utuh'], ['Modul Pembelajaran', 'Materi, kegiatan, dan latihan'], ['RPP / Lesson Plan', 'Rencana pembelajaran terstruktur'], ['Materi + Aktivitas', 'Konsep langsung dipraktikkan'], ['Materi + Contoh Soal', 'Materi dengan cek pemahaman'],
    ];
    return `<div class="workflow-layout"><div class="workflow-main"><section class="form-card"><p class="section-label">Langkah 2 · Pilih format materi</p><h2>Bagaimana materi ini akan digunakan?</h2><p>Pilih satu format. Kamu masih dapat mengedit isinya setelah AI selesai menyusun.</p><div class="format-grid">${formats.map(([title, description]) => `<label class="format-option ${state.materialFormat === title ? 'is-selected' : ''}"><input type="radio" name="material-format" value="${title}" ${state.materialFormat === title ? 'checked' : ''} data-action="material-format" /><span class="format-option__mark">✓</span><span><strong>${title}</strong><small>${description}</small></span></label>`).join('')}</div><div class="form-footer"><button class="button button--quiet" type="button" data-action="material-back">Kembali</button><button class="button button--primary" type="button" data-action="material-generate">Susun dengan AI <span data-icon="spark" aria-hidden="true"></span></button></div></section></div><aside class="workflow-aside"><div class="ai-note"><strong>Format terpilih</strong><p><b>${state.materialFormat}</b><br />Cocok untuk ${escapeHtml(state.materialConfig.grade)} · ${escapeHtml(state.materialConfig.duration)}.</p></div><div class="context-card"><span class="context-card__mark">2</span><h3>Satu langkah lagi.</h3><p>Setelah disusun, setiap bagian dapat diperbaiki tanpa mengulang seluruh materi.</p></div></aside></div>`;
  }

  function renderMaterialGeneration() {
    const steps = ['Memahami tujuan pembelajaran', 'Menyesuaikan tingkat kelas', 'Menyusun struktur materi', 'Menyiapkan contoh dan aktivitas'];
    return `<section class="generation-card" aria-live="polite"><div><div class="generation-card__illustration" aria-hidden="true"><span>✦</span></div><h2>AI sedang menyusun materi…</h2><p>Draf ini dibuat berdasarkan konteks yang kamu berikan. Prosesnya sebentar.</p><div class="generation-steps">${steps.map((item, index) => `<div class="generation-step ${index < state.materialGenerationIndex ? 'is-done' : index === state.materialGenerationIndex ? 'is-current' : ''}"><i>${index < state.materialGenerationIndex ? '✓' : index + 1}</i><span>${item}</span></div>`).join('')}</div><p class="generation-status">${state.materialGenerationIndex >= 4 ? 'Menunggu jawaban AI…' : 'Menyiapkan permintaan…'}</p><button class="button button--quiet" type="button" data-action="material-cancel">Batalkan dan kembali</button></div></section>`;
  }

  function renderMaterialPreview() {
    const config = state.materialConfig;
    return `<div class="material-editor"><div class="review-banner"><span class="review-banner__icon">✦</span><div><strong>Draf AI siap diperiksa.</strong><p>Baca setiap bagian, ubah kalimat yang diperlukan, lalu simpan setelah sesuai dengan cara mengajarmu.</p></div></div><div class="editor-toolbar"><div class="editor-toolbar__title"><strong>${escapeHtml(config.subject)} · ${escapeHtml(config.topic)}</strong><small>${escapeHtml(state.materialFormat)} · ${escapeHtml(config.grade)}</small></div><div class="editor-toolbar__actions"><button class="mini-button ${state.materialEditMode ? 'mini-button--primary' : ''}" type="button" data-action="material-edit">${state.materialEditMode ? 'Selesai edit' : 'Edit semua'}</button><button class="mini-button" type="button" data-action="material-regenerate">Regenerate materi</button></div></div><article class="document-sheet"><div class="document-sheet__meta"><span>Draft materi · AI assisted</span><span>Perlu tinjauan guru</span></div><h2>${escapeHtml(config.topic)}</h2><div class="document-sheet__objective"><strong>Tujuan pembelajaran</strong><p>${escapeHtml(config.objective)}</p></div>${state.materialSections.map((section) => `<section class="document-section" data-material-section="${section.id}" contenteditable="${state.materialEditMode}"><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.body)}</p><div class="section-tools" contenteditable="false"><button class="mini-button" type="button" data-section-action="regenerate" data-section-id="${section.id}">Regenerate bagian</button><button class="mini-button" type="button" data-section-action="simplify" data-section-id="${section.id}">Sederhanakan</button><button class="mini-button" type="button" data-section-action="example" data-section-id="${section.id}">Tambah contoh</button></div></section>`).join('')}</article><div class="form-footer"><button class="button button--quiet" type="button" data-action="material-save-draft">Simpan sebagai draft</button><button class="button button--primary" type="button" data-action="material-use">Simpan & gunakan <span data-icon="chevronRight" aria-hidden="true"></span></button><button class="button button--coral" type="button" data-action="questions-from-material">Generate soal dari materi <span data-icon="spark" aria-hidden="true"></span></button></div></div>`;
  }

  function field(id, label, control, full = false) {
    return `<div class="form-field ${full ? 'form-field--full' : ''}"><label class="form-label" for="${id}">${label}</label>${control}</div>`;
  }

  function renderQuestions() {
    const labels = ['Atur ulangan', 'Tentukan kesulitan', 'AI membuat soal', 'Periksa soal'];
    const head = `<header class="view-header"><div><p class="eyebrow">AI Learning Generator · asesmen</p><h1>Buat soal yang siap ditinjau.</h1><p>Susun ulangan harian dari awal atau mulai dari materi yang sudah dibuat. Setiap soal tetap dapat diubah manual.</p></div><span class="badge badge--coral">Tidak ada soal dipublikasikan otomatis</span></header>`;
    if (state.questionStep === 3) return `<div class="view questions-view">${head}${stepper(3, labels)}${renderQuestionGeneration()}</div>`;
    if (state.questionStep === 4) return `<div class="view questions-view">${head}${stepper(4, labels)}${renderQuestionReview()}</div>`;
    if (state.questionStep === 2) return `<div class="view questions-view">${head}${stepper(2, labels)}${renderQuestionDifficulty()}</div>`;
    return `<div class="view questions-view">${head}${stepper(1, labels)}${renderQuestionConfig()}</div>`;
  }

  function renderQuestionConfig() {
    const config = state.questionConfig;
    return `<div class="workflow-layout"><div class="workflow-main"><form class="form-card" data-form="question-config"><p class="section-label">Langkah 1 · Atur ulangan</p><h2>Ulangan harian untuk siapa?</h2><p>Masukkan tujuan dan jumlah soal. Pada langkah berikutnya, kamu dapat mengatur tingkat kesulitan dengan bahasa yang sederhana.</p><div class="form-grid">
      ${field('question-subject', 'Mata pelajaran', `<select name="subject"><option ${config.subject === 'Matematika' ? 'selected' : ''}>Matematika</option><option>IPA</option><option>Bahasa Indonesia</option><option>PPKn</option></select>`)}
      ${field('question-grade', 'Kelas', `<select name="grade"><option ${config.grade === 'Kelas 4 SD' ? 'selected' : ''}>Kelas 4 SD</option><option ${config.grade === 'Kelas 5 SD' ? 'selected' : ''}>Kelas 5 SD</option><option ${config.grade === 'Kelas 6 SD' ? 'selected' : ''}>Kelas 6 SD</option></select>`)}
      ${field('question-topic', 'Topik', `<input name="topic" value="${escapeHtml(config.topic)}" required />`, true)}
      ${field('question-total', 'Jumlah soal', `<input name="total" type="number" min="1" max="50" value="${config.total}" required />`)}
      ${field('question-duration', 'Durasi ujian', `<select name="duration"><option ${config.duration === '25 menit' ? 'selected' : ''}>25 menit</option><option ${config.duration === '35 menit' ? 'selected' : ''}>35 menit</option><option>45 menit</option></select>`)}
      ${field('question-objective', 'Tujuan pembelajaran', `<textarea name="objective" required>${escapeHtml(config.objective)}</textarea>`, true)}
    </div><div class="type-picker"><p class="form-label">Komposisi jenis soal</p><div class="type-row"><label for="multiple-count">Pilihan Ganda</label><input id="multiple-count" name="multiple" type="number" min="0" value="${config.multiple}" /></div><div class="type-row"><label for="short-count">Isian Singkat</label><input id="short-count" name="short" type="number" min="0" value="${config.short}" /></div><div class="type-row"><label for="essay-count">Essay</label><input id="essay-count" name="essay" type="number" min="0" value="${config.essay}" /></div></div><div class="form-footer"><button class="button button--primary" type="submit">Lanjut atur kesulitan <span data-icon="chevronRight" aria-hidden="true"></span></button></div></form></div><aside class="workflow-aside"><div class="context-card"><span class="context-card__mark" data-icon="spark"></span><h3>Soal yang punya tujuan.</h3><p>Setiap soal demo akan menampilkan kompetensi, kunci jawaban, penjelasan, dan tingkat kesulitannya.</p></div><div class="ai-note"><strong>Bisa mulai dari materi</strong><p>Setelah materi disimpan, gunakan tombol <b>Generate soal dari materi</b> agar topik terisi otomatis.</p></div></aside></div>`;
  }

  function renderQuestionDifficulty() {
    const levels = [['Mudah', 'Konsep dasar dan pengenalan'], ['Sedang', 'Penerapan dalam situasi baru'], ['Sulit', 'Penalaran dan penjelasan'], ['Campuran', 'Distribusi yang seimbang']];
    return `<div class="question-config"><section class="form-card"><p class="section-label">Langkah 2 · Tingkat kesulitan</p><h2>Atur tantangannya.</h2><p>Pilih campuran yang membantu siswa menunjukkan pemahaman, bukan sekadar menghafal.</p><div class="difficulty-picker">${levels.map(([name, description]) => `<label class="difficulty-option"><input type="radio" name="difficulty" value="${name}" ${state.questionDifficulty === name ? 'checked' : ''} data-action="question-difficulty" /><span><strong>${name}</strong><small>${description}</small></span><span class="difficulty-bar"><i style="width: ${name === 'Mudah' ? '30%' : name === 'Sedang' ? '60%' : name === 'Sulit' ? '100%' : '76%'}"></i></span></label>`).join('')}</div><div class="distribution-card"><div class="block-head"><h2>Distribusi yang disarankan</h2><p>Masih bisa diubah</p></div><div class="distribution-bars"><div class="distribution-bar"><span>Mudah</span><span class="distribution-bar__track"><i class="distribution-bar__fill" style="width:${state.difficultyDistribution.easy}%"></i></span><strong>${state.difficultyDistribution.easy}%</strong></div><div class="distribution-bar"><span>Sedang</span><span class="distribution-bar__track"><i class="distribution-bar__fill" style="width:${state.difficultyDistribution.medium}%"></i></span><strong>${state.difficultyDistribution.medium}%</strong></div><div class="distribution-bar"><span>Sulit</span><span class="distribution-bar__track"><i class="distribution-bar__fill" style="width:${state.difficultyDistribution.hard}%"></i></span><strong>${state.difficultyDistribution.hard}%</strong></div></div></div><div class="form-footer"><button class="button button--quiet" type="button" data-action="questions-back">Kembali</button><button class="button button--primary" type="button" data-action="questions-generate">Buat soal dengan AI <span data-icon="spark" aria-hidden="true"></span></button></div></section><aside class="config-side"><div class="ai-note"><strong>Bahasa yang digunakan</strong><p>Soal dibuat dalam Bahasa Indonesia dan disesuaikan untuk ${escapeHtml(state.questionConfig.grade)}.</p></div><div class="review-banner"><span class="review-banner__icon">✓</span><div><strong>Guru tetap memeriksa.</strong><p>AI quality check akan membantu menandai soal yang perlu dilihat lagi.</p></div></div></aside></div>`;
  }

  function renderQuestionGeneration() {
    const steps = ['Memahami materi', 'Menyesuaikan tingkat kelas', 'Menentukan tingkat kesulitan', 'Menyusun pertanyaan', 'Memeriksa kualitas soal'];
    return `<section class="generation-card" aria-live="polite"><div><div class="generation-card__illustration" aria-hidden="true"><span>?</span></div><h2>AI sedang membuat soal…</h2><p>Menjaga soal tetap jelas, sesuai usia, dan memiliki tujuan yang dapat ditinjau.</p><div class="generation-steps">${steps.map((item, index) => `<div class="generation-step ${index < state.questionGenerationIndex ? 'is-done' : index === state.questionGenerationIndex ? 'is-current' : ''}"><i>${index < state.questionGenerationIndex ? '✓' : index + 1}</i><span>${item}</span></div>`).join('')}</div></div></section>`;
  }

  function renderQuestionReview() {
    const total = state.questionConfig.total;
    return `<div class="questions-review"><div class="review-banner"><span class="review-banner__icon">✦</span><div><strong>${state.questions.length} contoh soal siap ditinjau dari ${total} soal.</strong><p>Semua kolom di bawah dapat diubah. Soal dengan tanda perhatian membutuhkan pemeriksaan lebih lanjut.</p></div></div><div class="editor-toolbar"><div class="editor-toolbar__title"><strong>${escapeHtml(state.questionConfig.subject)} · ${escapeHtml(state.questionConfig.topic)}</strong><small>${total} soal · ${escapeHtml(state.questionConfig.grade)}</small></div><div class="editor-toolbar__actions"><button class="mini-button" type="button" data-action="question-add">Tambah manual</button><button class="mini-button mini-button--primary" type="button" data-action="question-more">Generate soal tambahan</button></div></div><div class="questions-list" id="questions-list">${state.questions.map((question, index) => renderQuestionCard(question, index)).join('')}</div><div class="builder-summary"><div class="builder-summary__numbers"><span><strong>${total}</strong> soal</span><span><strong>${state.questionConfig.multiple}</strong> pilihan ganda</span><span><strong>${state.questionConfig.short}</strong> isian</span><span><strong>${state.questionConfig.essay}</strong> essay</span><span>Perkiraan <strong>${escapeHtml(state.questionConfig.duration)}</strong></span></div><div class="button-row"><button class="button button--quiet" type="button" data-action="question-save">Simpan draft</button><button class="button button--primary" type="button" data-action="question-publish">Terbitkan ulangan <span data-icon="arrow" aria-hidden="true"></span></button></div></div></div>`;
  }

  function renderQuestionCard(question, index) {
    const optionHtml = question.type === 'Pilihan Ganda' ? `<div class="option-list">${question.options.map((option, optionIndex) => { const letter = String.fromCharCode(65 + optionIndex); return `<label class="question-option ${question.correct === letter ? 'is-correct' : ''}"><b>${letter}</b><input class="question-option__input" data-q-field="option-${optionIndex}" data-q-id="${question.id}" value="${escapeHtml(option)}" aria-label="Pilihan ${letter}" /><span class="question-option__state">${question.correct === letter ? 'Kunci jawaban' : ''}</span></label>`; }).join('')}</div>` : `<div class="answer-preview"><span class="data-label">Kunci jawaban</span><strong>${escapeHtml(question.correct)}</strong></div>`;
    const quality = question.quality === 'warning' ? `<div class="quality-check is-warning"><div class="quality-check__head"><strong>⚠ Perlu ditinjau</strong><button class="mini-button" type="button" data-action="quality-fix" data-id="${question.id}">Perbaiki dengan AI</button></div><ul><li>Pilihan jawaban perlu dibandingkan</li><li>Pastikan satu jawaban paling tepat</li></ul></div>` : `<div class="quality-check"><div class="quality-check__head"><strong>AI Quality Check</strong><span class="badge badge--green">Lolos pemeriksaan awal</span></div><ul><li>Sesuai tingkat kelas</li><li>Satu jawaban benar</li><li>Tidak ambigu</li><li>Sesuai topik</li></ul></div>`;
    return `<article class="question-card" draggable="true" data-question-id="${question.id}"><div class="question-card__head"><div class="question-number"><strong>${String(index + 1).padStart(2, '0')}</strong><span>${escapeHtml(question.type)} · seret untuk mengurutkan</span></div><div class="question-card__actions"><button class="mini-button" type="button" data-action="question-edit" data-id="${question.id}">Edit</button><button class="mini-button" type="button" data-action="question-regenerate" data-id="${question.id}">Regenerate</button><button class="mini-button" type="button" data-action="question-duplicate" data-id="${question.id}">Duplikat</button><button class="mini-button" type="button" data-action="question-delete" data-id="${question.id}" aria-label="Hapus soal ${index + 1}">Hapus</button></div></div><div class="form-field"><label class="form-label" for="question-${question.id}">Pertanyaan</label><textarea id="question-${question.id}" data-q-field="text" data-q-id="${question.id}" rows="2">${escapeHtml(question.text)}</textarea></div>${optionHtml}<div class="question-details"><label><span class="data-label">Kunci / jawaban</span><select data-q-field="correct" data-q-id="${question.id}">${question.type === 'Pilihan Ganda' ? question.options.map((_, optionIndex) => { const letter = String.fromCharCode(65 + optionIndex); return `<option ${question.correct === letter ? 'selected' : ''}>${letter}</option>`; }).join('') : `<option>${escapeHtml(question.correct)}</option>`}</select></label><label><span class="data-label">Tingkat</span><select data-q-field="difficulty" data-q-id="${question.id}"><option ${question.difficulty === 'Mudah' ? 'selected' : ''}>Mudah</option><option ${question.difficulty === 'Sedang' ? 'selected' : ''}>Sedang</option><option ${question.difficulty === 'Sulit' ? 'selected' : ''}>Sulit</option></select></label><label><span class="data-label">Tujuan / kompetensi</span><input data-q-field="objective" data-q-id="${question.id}" value="${escapeHtml(question.objective)}" /></label></div><div class="form-field question-explanation"><label class="form-label" for="explanation-${question.id}">Penjelasan jawaban</label><textarea id="explanation-${question.id}" data-q-field="explanation" data-q-id="${question.id}" rows="2">${escapeHtml(question.explanation)}</textarea></div>${quality}</article>`;
  }

  function renderGrading() {
    const head = `<header class="view-header"><div><p class="eyebrow">AI Learning Generator · penilaian</p><h1>Nilai jawaban tanpa mengulang semuanya.</h1><p>Upload foto lembar jawaban, biarkan sistem membaca, lalu periksa hasil yang membutuhkan perhatian.</p></div><span class="badge badge--blue">Computer vision · teacher review</span></header>`;
    if (state.gradingStage === 'processing') return `<div class="view grading-view">${head}${renderGradingProcessing()}</div>`;
    if (state.gradingStage === 'result' && state.gradingResults) return `<div class="view grading-view">${head}${renderGradingResult()}</div>`;
    return `<div class="view grading-view">${head}<div class="grading-layout"><section class="upload-card"><div><p class="section-label">Langkah 1 · Upload / scan</p><h2>Mulai dari lembar jawaban.</h2><p class="form-hint">Satu atau beberapa foto dapat diproses sekaligus. Pastikan seluruh lembar terlihat dan tidak terlalu buram.</p></div><label class="dropzone" id="dropzone" for="sheet-upload"><span class="dropzone__icon" data-icon="upload"></span><strong>Seret foto lembar jawaban ke sini</strong><p>atau pilih file dari perangkat</p><small>JPG · PNG · PDF · bisa beberapa file</small></label><div class="button-row"><button class="button button--primary" type="button" data-action="choose-sheet"><span data-icon="upload"></span> Upload foto</button><button class="button button--quiet" type="button" data-action="open-scanner"><span data-icon="camera"></span> Buka kamera</button></div><div class="grading-options"><div><label class="form-label" for="grading-assessment">Pilih ulangan</label><select id="grading-assessment"><option>Ulangan Harian Matematika — Pecahan</option><option>Latihan IPA — Organ Tubuh</option></select></div><span class="badge badge--green">Kunci jawaban tersedia</span></div></section><aside class="process-card"><h3>Yang akan dilakukan sistem</h3><p class="form-hint">Setiap tahap dapat ditinjau ulang jika hasilnya tidak meyakinkan.</p><ol class="process-list"><li><i>1</i>Mendeteksi lembar jawaban</li><li><i>2</i>Membaca identitas siswa</li><li><i>3</i>Mendeteksi jawaban</li><li><i>4</i>Mencocokkan dengan kunci</li><li><i>5</i>Menghitung nilai</li></ol><div class="ai-note" style="margin-top: 1.5rem"><strong>Perlu foto ulang?</strong><p>Jawaban dengan confidence sedang akan diberi tanda agar guru bisa melakukan review manual.</p></div></aside></div><section class="empty-state" style="margin-top: 2rem"><div><span class="empty-state__mark">⌁</span><h3>Belum ada hasil penilaian hari ini.</h3><p>Upload lembar jawaban untuk melihat ringkasan nilai siswa.</p></div></section></div>`;
  }

  function renderGradingProcessing() {
    const steps = ['Mendeteksi lembar jawaban', 'Membaca identitas siswa', 'Mendeteksi jawaban', 'Mencocokkan dengan kunci', 'Menghitung nilai'];
    return `<section class="generation-card" aria-live="polite"><div><div class="generation-card__illustration" aria-hidden="true"><span>⌁</span></div><h2>Memproses lembar jawaban…</h2><p>${state.gradingFiles.length} file sedang diperiksa. Jangan tutup halaman ini.</p><div class="generation-steps">${steps.map((item, index) => `<div class="generation-step ${index < state.gradingProgress ? 'is-done' : index === state.gradingProgress ? 'is-current' : ''}"><i>${index < state.gradingProgress ? '✓' : index + 1}</i><span>${item}</span></div>`).join('')}</div></div></section>`;
  }

  function renderGradingResult() {
    const result = state.gradingResults;
    const scores = result.results.map((item) => item.score);
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    return `<div class="grading-result"><div class="review-banner"><span class="review-banner__icon">✓</span><div><strong>Penilaian selesai untuk ${result.results.length} siswa.</strong><p>${formatFileNames(result.files)} · hasil dengan confidence sedang tetap perlu dicocokkan.</p></div></div><div class="result-summary" style="margin-top: 1.5rem"><div class="result-stat"><span class="data-label">Total siswa</span><strong>${result.results.length}</strong><span>terdeteksi</span></div><div class="result-stat"><span class="data-label">Sudah dinilai</span><strong>${result.results.length}</strong><span>lembar selesai</span></div><div class="result-stat"><span class="data-label">Rata-rata nilai</span><strong>${average}</strong><span>dari 100</span></div><div class="result-stat"><span class="data-label">Nilai tertinggi</span><strong>${highest}</strong><span>nilai terendah ${lowest}</span></div></div><div class="distribution"><div><h3>Distribusi hasil</h3><div class="distribution-bars"><div class="distribution-bar"><span>90–100</span><span class="distribution-bar__track"><i class="distribution-bar__fill" style="width:25%"></i></span><strong>1</strong></div><div class="distribution-bar"><span>75–89</span><span class="distribution-bar__track"><i class="distribution-bar__fill" style="width:50%"></i></span><strong>2</strong></div><div class="distribution-bar"><span>&lt; 75</span><span class="distribution-bar__track"><i class="distribution-bar__fill" style="width:25%"></i></span><strong>1</strong></div></div></div><div class="ai-analysis"><span class="ai-analysis__label">✦ Interpretasi berbantuan AI</span><h3>Temukan pola setelah menilai.</h3><p>${state.gradingAnalysis ? escapeHtml(state.gradingAnalysis) : 'AI dapat membantu merangkum pola hasil. Analisis ini bersifat interpretasi berdasarkan data yang tersedia, bukan keputusan otomatis.'}</p>${state.gradingAnalysis ? '' : '<button class="button button--coral" style="margin-top: 1rem" type="button" data-action="ai-analysis">Lihat analisis AI</button>'}</div></div><div class="block-head" style="margin-top: 2.5rem"><div><h2>Hasil per siswa</h2><p>${result.assessment}</p></div><button class="button button--quiet" type="button" data-action="grading-reset">Scan lembar lain</button></div><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Nama siswa</th><th>Benar</th><th>Salah</th><th>Nilai</th><th>Confidence</th><th>Status</th><th></th></tr></thead><tbody>${result.results.map((student) => `<tr><td><strong>${escapeHtml(student.name)}</strong></td><td>${student.correct} / ${result.totalQuestions}</td><td>${student.wrong}</td><td class="score-cell">${student.score}</td><td><span class="badge ${student.confidence === 'Tinggi' ? 'badge--green' : 'badge--yellow'}">${student.confidence}</span></td><td><span class="badge ${student.status === 'Selesai' ? 'badge--green' : 'badge--yellow'}">${student.status}</span></td><td><button class="mini-button" type="button" data-action="inspect-student" data-student="${escapeHtml(student.name)}">Periksa</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function renderHistory() {
    const items = [
      { icon: 'Aa', title: 'Materi IPA — Sistem Pernapasan', type: 'Materi', subject: 'IPA', grade: 'Kelas 5 SD', date: '19 Mei 2025', status: 'Diedit', badge: 'badge--yellow' },
      { icon: '∕', title: 'Ulangan Harian Matematika — Pecahan', type: 'Ulangan', subject: 'Matematika', grade: 'Kelas 5 SD', date: '18 Mei 2025', status: 'Siap digunakan', badge: 'badge--green' },
      { icon: 'B', title: 'Ulangan Bahasa Indonesia — Ide Pokok', type: 'Soal', subject: 'Bahasa Indonesia', grade: 'Kelas 5 SD', date: '16 Mei 2025', status: 'Draft', badge: 'badge--blue' },
      { icon: '⌁', title: 'Hasil Penilaian — Pecahan', type: 'Hasil Penilaian', subject: 'Matematika', grade: 'Kelas 5 SD', date: '18 Mei 2025', status: 'Selesai', badge: 'badge--green' },
      { icon: 'Aa', title: 'Materi IPA — Organ Tubuh', type: 'Materi', subject: 'IPA', grade: 'Kelas 5 SD', date: '12 Mei 2025', status: 'Draft', badge: 'badge--blue' },
    ];
    const filtered = items.filter((item) => (state.historyFilter.subject === 'Semua mata pelajaran' || item.subject === state.historyFilter.subject) && (state.historyFilter.type === 'Semua jenis' || item.type === state.historyFilter.type));
    return `<div class="view history-view"><header class="view-header"><div><p class="eyebrow">Workspace · arsip</p><h1>Riwayat yang mudah ditemukan.</h1><p>Semua materi, soal, ulangan, dan hasil penilaian tersimpan dalam satu tempat.</p></div><span class="badge badge--green">${items.length} aktivitas tersimpan</span></header><div class="history-filters"><select data-history-filter="subject" aria-label="Filter mata pelajaran"><option>Semua mata pelajaran</option><option ${state.historyFilter.subject === 'IPA' ? 'selected' : ''}>IPA</option><option ${state.historyFilter.subject === 'Matematika' ? 'selected' : ''}>Matematika</option><option ${state.historyFilter.subject === 'Bahasa Indonesia' ? 'selected' : ''}>Bahasa Indonesia</option></select><select data-history-filter="type" aria-label="Filter jenis"><option>Semua jenis</option><option ${state.historyFilter.type === 'Materi' ? 'selected' : ''}>Materi</option><option ${state.historyFilter.type === 'Soal' ? 'selected' : ''}>Soal</option><option ${state.historyFilter.type === 'Ulangan' ? 'selected' : ''}>Ulangan</option><option ${state.historyFilter.type === 'Hasil Penilaian' ? 'selected' : ''}>Hasil Penilaian</option></select><button class="button button--quiet" type="button" data-action="history-clear">Reset filter</button></div>${filtered.length ? `<div class="history-list">${filtered.map((item) => `<article class="history-row"><span class="history-row__icon">${item.icon}</span><div><strong>${item.title}</strong><small>${item.type} · ${item.subject} · ${item.grade}</small></div><span class="history-row__date">${item.date}</span><span class="badge ${item.badge}">${item.status}</span><button class="mini-button" type="button" data-view="${item.type === 'Materi' ? 'material' : item.type === 'Hasil Penilaian' ? 'grading' : 'questions'}">Buka</button></article>`).join('')}</div>` : `<div class="empty-state"><div><span class="empty-state__mark">⌕</span><h3>Tidak ada aktivitas yang cocok.</h3><p>Coba ubah filter mata pelajaran atau jenis aktivitas.</p><button class="button button--primary" type="button" data-action="history-clear">Tampilkan semua</button></div></div>`}</div>`;
  }

  async function beginMaterialGeneration() {
    state.materialGenerating = true;
    state.materialGenerationIndex = 0;
    render();
    for (let index = 0; index < 4; index += 1) {
      await sleep(420);
      state.materialGenerationIndex = index + 1;
      render();
    }
    try {
      const generated = await mockServices.generateMaterial(state.materialConfig);
      state.materialSections = generated.sections;
      state.materialGenerating = false;
    } catch (error) {
      state.materialGenerating = false;
      state.materialStep = 2;
      showToast(error.message);
      render();
      return;
    }
    state.materialGenerated = true;
    state.materialStep = 4;
    showToast('Draf materi selesai dibuat. Silakan periksa setiap bagian.');
    render();
  }

  async function beginQuestionGeneration() {
    state.questionGenerating = true;
    state.questionGenerationIndex = 0;
    render();
    for (let index = 0; index < 5; index += 1) {
      await sleep(390);
      state.questionGenerationIndex = index + 1;
      render();
    }
    try {
      state.questions = await mockServices.generateQuestions(state.questionConfig);
      state.questionGenerating = false;
    } catch (error) {
      state.questionGenerating = false;
      state.questionStep = 2;
      showToast(error.message);
      render();
      return;
    }
    state.questionsGenerated = true;
    state.questionStep = 4;
    showToast('Contoh soal selesai dibuat. Periksa kualitasnya sebelum digunakan.');
    render();
  }

  function syncMaterialConfig(form) {
    const data = new FormData(form);
    state.materialConfig = { ...state.materialConfig, subject: data.get('subject'), grade: data.get('grade'), topic: data.get('topic'), objective: data.get('objective'), duration: data.get('duration'), depth: data.get('depth') };
  }

  function syncQuestionConfig(form) {
    const data = new FormData(form);
    state.questionConfig = { ...state.questionConfig, subject: data.get('subject'), grade: data.get('grade'), topic: data.get('topic'), objective: data.get('objective'), duration: data.get('duration'), total: Number(data.get('total')) || 1, multiple: Number(data.get('multiple')) || 0, short: Number(data.get('short')) || 0, essay: Number(data.get('essay')) || 0 };
  }

  function updateMaterialSection(sectionId, action) {
    const section = state.materialSections.find((item) => item.id === sectionId);
    if (!section) return;
    if (action === 'simplify') section.body = 'Gunakan kalimat singkat dan contoh dekat dengan kehidupan sehari-hari. ' + section.body.split('.').slice(0, 2).join('.') + '.';
    if (action === 'example') section.body += ' Contoh: saat menarik napas, oksigen masuk ke paru-paru dan digunakan oleh tubuh.';
    if (action === 'regenerate') section.body = section.id === 'aktivitas' ? 'Amati pola napasmu selama satu menit. Catat perubahan setelah berjalan di tempat. Diskusikan: mengapa tubuh membutuhkan lebih banyak udara saat bergerak?' : `Versi alternatif untuk ${section.title.toLowerCase()}: ${section.body}`;
    showToast(`${section.title} diperbarui. Baca kembali sebelum disimpan.`);
    render();
  }

  function questionById(id) {
    return state.questions.find((question) => question.id === id);
  }

  function updateQuestionField(element) {
    const question = questionById(element.dataset.qId);
    if (!question) return;
    const field = element.dataset.qField;
    if (field.startsWith('option-')) question.options[Number(field.replace('option-', ''))] = element.value;
    else question[field] = element.value;
  }

  function questionAction(action, id) {
    const question = questionById(id);
    if (!question) return;
    if (action === 'question-edit') {
      document.querySelector(`#question-${id}`)?.focus();
      showToast('Soal siap diedit. Ubah langsung pada kolom yang tersedia.');
    }
    if (action === 'question-regenerate') {
      question.text = question.type === 'Pilihan Ganda' ? 'Manakah pernyataan yang paling tepat tentang pecahan senilai?' : 'Jelaskan kembali konsep ini dengan contoh yang kamu temukan di rumah.';
      question.quality = 'ok';
      showToast('Soal diperbarui dengan versi alternatif.');
      render();
    }
    if (action === 'question-duplicate') {
      const copy = { ...question, id: `q-${Date.now()}`, options: [...question.options], text: `${question.text} (salinan)` };
      state.questions.splice(state.questions.indexOf(question) + 1, 0, copy);
      showToast('Soal berhasil diduplikat.');
      render();
    }
    if (action === 'question-delete') {
      state.questions = state.questions.filter((item) => item.id !== id);
      showToast('Soal dihapus dari susunan ulangan.');
      render();
    }
    if (action === 'quality-fix') {
      question.quality = 'ok';
      question.options[1] = '5/6';
      showToast('AI memperbaiki potensi kemiripan pilihan. Tetap periksa hasilnya.');
      render();
    }
  }

  async function handleFiles(fileList, scannerMode = false) {
    const files = [...fileList].filter((file) => file && (file.type.startsWith('image/') || file.type === 'application/pdf' || file.name?.endsWith('.pdf')));
    if (!files.length) {
      showToast('File tidak dapat diproses. Pilih foto JPG, PNG, atau PDF.');
      return;
    }
    state.gradingFiles = files;
    state.gradingStage = 'processing';
    state.gradingProgress = 0;
    if (!scannerMode) { state.scanner = null; render(); }
    else renderScannerOverlay();
    for (let index = 0; index < 5; index += 1) {
      await sleep(430);
      state.gradingProgress = index + 1;
      if (scannerMode) renderScannerOverlay(); else render();
    }
    state.gradingResults = await mockServices.gradeAnswerSheet(files);
    state.gradingStage = 'result';
    state.gradingAnalysis = null;
    if (scannerMode) {
      state.scanner.stage = 'result';
      state.scanner.result = state.gradingResults.results[0];
      renderScannerOverlay();
    } else {
      showToast('Hasil penilaian sudah siap ditinjau.');
      render();
    }
  }

  function resetGrading() {
    state.gradingStage = 'upload';
    state.gradingFiles = [];
    state.gradingResults = null;
    state.gradingAnalysis = null;
    navigate('grading');
  }

  function openScanner() {
    state.scanner = { stage: 'preview', file: null, result: null };
    renderScannerOverlay();
  }

  function closeScanner() {
    state.scanner = null;
    document.querySelector('.scanner-overlay')?.remove();
  }

  function renderScannerOverlay() {
    document.querySelector('.scanner-overlay')?.remove();
    if (!state.scanner) return;
    const overlay = document.createElement('div');
    overlay.className = 'scanner-overlay';
    if (state.scanner.stage === 'processing') {
      overlay.innerHTML = `<div class="scanner-card"><div class="scanner-processing"><div class="scanner-processing__mark">⌁</div><h2>Memproses lembar jawaban…</h2><p>Tahap ${Math.min(state.gradingProgress + 1, 5)} dari 5 · ${['Mendeteksi lembar jawaban', 'Membaca identitas siswa', 'Mendeteksi jawaban', 'Mencocokkan dengan kunci', 'Menghitung nilai'][Math.min(state.gradingProgress, 4)]}</p><ul class="process-list"><li class="${state.gradingProgress > 0 ? 'is-done' : 'is-current'}"><i>1</i>Mendeteksi lembar jawaban</li><li class="${state.gradingProgress > 1 ? 'is-done' : state.gradingProgress === 1 ? 'is-current' : ''}"><i>2</i>Membaca identitas siswa</li><li class="${state.gradingProgress > 2 ? 'is-done' : state.gradingProgress === 2 ? 'is-current' : ''}"><i>3</i>Mendeteksi jawaban</li><li class="${state.gradingProgress > 3 ? 'is-done' : state.gradingProgress === 3 ? 'is-current' : ''}"><i>4</i>Mencocokkan dengan kunci</li><li class="${state.gradingProgress > 4 ? 'is-done' : state.gradingProgress === 4 ? 'is-current' : ''}"><i>5</i>Menghitung nilai</li></ul></div></div>`;
    } else if (state.scanner.stage === 'confirm') {
      const imageUrl = state.scanner.file ? URL.createObjectURL(state.scanner.file) : '';
      overlay.innerHTML = `<div class="scanner-card"><p class="eyebrow">Periksa foto</p><h2>Sudah cukup jelas?</h2><div class="scanner-preview"><img src="${imageUrl}" alt="Pratinjau lembar jawaban" style="width: 46%; height: 65%; object-fit: cover; transform: rotate(-5deg); box-shadow: var(--shadow-lift)" /></div><p>Pastikan seluruh lembar terlihat sebelum sistem membaca jawaban.</p><div class="scanner-actions"><button class="button button--quiet" type="button" data-action="scanner-cancel">Ambil ulang</button><button class="button button--coral" type="button" data-action="scanner-process">Gunakan foto <span aria-hidden="true">→</span></button></div></div>`;
      window.setTimeout(() => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, 1000);
    } else if (state.scanner.stage === 'result') {
      const student = state.scanner.result;
      overlay.innerHTML = `<div class="scanner-card"><p class="eyebrow">Hasil penilaian</p><h2>${escapeHtml(student.name)}</h2><div class="result-summary"><div class="result-stat"><span class="data-label">Benar</span><strong>${student.correct}</strong><span>dari 20 soal</span></div><div class="result-stat"><span class="data-label">Salah</span><strong>${student.wrong}</strong><span>perlu ditinjau</span></div><div class="result-stat" style="grid-column: span 2; background: var(--color-sun)"><span class="data-label">Nilai</span><strong>${student.score}</strong><span>confidence ${student.confidence.toLowerCase()}</span></div></div><p>Hasil ini sudah dihitung dari lembar yang dipindai. Kamu tetap dapat melihat semua hasil bersama-sama.</p><div class="scanner-actions"><button class="button button--quiet" type="button" data-action="scanner-next">Scan berikutnya</button><button class="button button--coral" type="button" data-action="scanner-all-results">Lihat semua hasil <span aria-hidden="true">→</span></button></div></div>`;
    } else {
      overlay.innerHTML = `<div class="scanner-card"><p class="eyebrow">Auto Grading · kamera</p><h2>Posisikan lembar jawaban di dalam kotak.</h2><div class="scanner-preview"><div class="scanner-preview__sheet" aria-hidden="true"></div></div><p>Letakkan kamera sejajar dengan kertas dan pastikan pencahayaan cukup.</p><div class="scanner-actions"><button class="button button--quiet" type="button" data-action="scanner-cancel">Tutup kamera</button><button class="button button--coral" type="button" data-action="scanner-capture">Ambil foto <span aria-hidden="true">●</span></button><button class="button button--quiet" type="button" data-action="scanner-demo">Gunakan contoh foto</button></div></div>`;
    }
    document.body.appendChild(overlay);
    hydrateIcons(overlay);
  }

  function studentResult(name) {
    return state.gradingResults?.results.find((item) => item.name === name);
  }

  document.addEventListener('click', (event) => {
    const viewTrigger = event.target.closest('[data-view]');
    if (viewTrigger) {
      event.preventDefault();
      navigate(viewTrigger.dataset.view);
      return;
    }
    const sectionTrigger = event.target.closest('[data-section-action]');
    if (sectionTrigger) {
      updateMaterialSection(sectionTrigger.dataset.sectionId, sectionTrigger.dataset.sectionAction);
      return;
    }
    const actionTrigger = event.target.closest('[data-action]');
    if (!actionTrigger) return;
    const action = actionTrigger.dataset.action;
    if (action === 'hide-toast') hideToast();
    if (action === 'show-profile') showDialog('profile');
    if (action === 'show-settings') showDialog('settings');
    if (action === 'show-help') showDialog('help');
    if (action === 'show-notifications') showDialog('notifications');
    if (action === 'show-school-menu') showDialog('school');
    if (action === 'close-dialog') closeDialog();
    if (action === 'material-back' || action === 'material-cancel') { state.materialStep = action === 'material-cancel' ? 2 : 1; state.materialGenerating = false; render(); }
    if (action === 'material-generate') { state.materialStep = 3; render(); }
    if (action === 'material-edit') { state.materialEditMode = !state.materialEditMode; render(); }
    if (action === 'material-regenerate') { state.materialGenerated = false; state.materialGenerating = false; state.materialStep = 3; render(); }
    if (action === 'material-save-draft') { state.materialSaved = true; saveMaterialToWorkspace(); }
    if (action === 'material-use') { state.materialSaved = true; saveMaterialToWorkspace('Materi disimpan dan siap digunakan di kelas.'); }
    if (action === 'questions-from-material') { state.questionConfig.subject = state.materialConfig.subject; state.questionConfig.grade = state.materialConfig.grade; state.questionConfig.topic = state.materialConfig.topic; state.questionConfig.objective = state.materialConfig.objective; state.questionStep = 1; state.questionsGenerated = false; navigate('questions'); }
    if (action === 'questions-back') { state.questionStep = 1; render(); }
    if (action === 'questions-generate') { state.questionStep = 3; render(); }
    if (action === 'question-add') { state.questions.push({ id: `q-${Date.now()}`, type: 'Pilihan Ganda', text: 'Tulis pertanyaan baru di sini.', options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'], correct: 'A', difficulty: 'Sedang', objective: 'Tambahkan tujuan pembelajaran', explanation: 'Tambahkan penjelasan jawaban.', quality: 'warning' }); showToast('Soal manual ditambahkan ke bagian akhir.'); render(); }
    if (action === 'question-more') { state.questions.push({ id: `q-${Date.now()}`, type: 'Pilihan Ganda', text: 'Manakah contoh pecahan yang tepat dalam kehidupan sehari-hari?', options: ['1/4', '4/0', '5/1', '8/2'], correct: 'A', difficulty: 'Mudah', objective: 'Menghubungkan pecahan dengan konteks sehari-hari', explanation: 'Satu dari empat bagian sama besar ditulis sebagai 1/4.', quality: 'ok' }); showToast('Satu soal tambahan dibuat.'); render(); }
    if (action === 'question-save') saveQuestionsToWorkspace();
    if (action === 'question-publish') { showDialog('help'); showToast('Prototype: ulangan siap masuk ke tahap publikasi setelah konfirmasi guru.'); }
    if (action === 'quality-fix' || ['question-edit', 'question-regenerate', 'question-duplicate', 'question-delete'].includes(action)) questionAction(action, actionTrigger.dataset.id);
    if (action === 'choose-sheet') sheetUpload.click();
    if (action === 'open-scanner') openScanner();
    if (action === 'search-reference') searchReference();
    if (action === 'select-reference') selectReference(actionTrigger.dataset.referenceId);
    if (action === 'ai-analysis') beginAnalysis();
    if (action === 'grading-reset') resetGrading();
    if (action === 'inspect-student') { const student = studentResult(actionTrigger.dataset.student); showDialog('student', student); }
    if (action === 'history-clear') { state.historyFilter = { subject: 'Semua mata pelajaran', type: 'Semua jenis' }; render(); }
    if (action === 'scanner-cancel') closeScanner();
    if (action === 'scanner-capture') cameraUpload.click();
    if (action === 'scanner-process') { const file = state.scanner?.file; if (file) { state.scanner.stage = 'processing'; handleFiles([file], true); } }
    if (action === 'scanner-demo') { state.scanner.stage = 'processing'; handleFiles([{ name: 'contoh-lembar-andi.jpg', type: 'image/jpeg', size: 100000 }], true); }
    if (action === 'scanner-next') { state.scanner = { stage: 'preview', file: null, result: null }; renderScannerOverlay(); }
    if (action === 'scanner-all-results') { closeScanner(); navigate('grading'); }
    if (action === 'material-format') { state.materialFormat = actionTrigger.value; render(); }
    if (action === 'question-difficulty') { state.questionDifficulty = actionTrigger.value; }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.matches('[data-form="material-config"]')) {
      event.preventDefault();
      syncMaterialConfig(event.target);
      state.materialStep = 2;
      render();
    }
    if (event.target.matches('[data-form="question-config"]')) {
      event.preventDefault();
      syncQuestionConfig(event.target);
      state.questionStep = 2;
      render();
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-q-field]')) updateQuestionField(event.target);
    if (event.target.closest('[data-material-section]') && event.target.closest('[data-material-section]').isContentEditable) {
      const sectionNode = event.target.closest('[data-material-section]');
      const section = state.materialSections.find((item) => item.id === sectionNode.dataset.materialSection);
      if (section) section.body = sectionNode.innerText.replace(/\n+/g, ' ').replace(/Regenerate bagianSederhanakanTambah contoh/g, '').trim();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'sheet-upload') handleFiles(event.target.files);
    if (event.target.id === 'camera-upload' && event.target.files[0] && state.scanner) { state.scanner.file = event.target.files[0]; state.scanner.stage = 'confirm'; renderScannerOverlay(); }
    if (event.target.matches('[data-history-filter]')) { state.historyFilter[event.target.dataset.historyFilter] = event.target.value; render(); }
    if (event.target.matches('[data-q-field]')) { updateQuestionField(event.target); }
  });

  document.addEventListener('dragover', (event) => {
    const dropzone = event.target.closest('#dropzone');
    if (!dropzone) return;
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  });

  document.addEventListener('dragleave', (event) => {
    event.target.closest('#dropzone')?.classList.remove('is-dragging');
  });

  document.addEventListener('drop', (event) => {
    const dropzone = event.target.closest('#dropzone');
    if (!dropzone) return;
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    handleFiles(event.dataTransfer.files);
  });

  document.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.question-card');
    if (card) state.draggedQuestionId = card.dataset.questionId;
  });

  document.addEventListener('dragover', (event) => {
    if (event.target.closest('.question-card')) event.preventDefault();
  });

  document.addEventListener('drop', (event) => {
    const targetCard = event.target.closest('.question-card');
    if (!targetCard || !state.draggedQuestionId || targetCard.dataset.questionId === state.draggedQuestionId) return;
    event.preventDefault();
    const from = state.questions.findIndex((item) => item.id === state.draggedQuestionId);
    const to = state.questions.findIndex((item) => item.id === targetCard.dataset.questionId);
    const [moved] = state.questions.splice(from, 1);
    state.questions.splice(to, 0, moved);
    state.draggedQuestionId = null;
    showToast('Urutan soal diperbarui.');
    render();
  });

  async function saveMaterialToWorkspace(successMessage = 'Materi AI disimpan sebagai draft.') {
    try {
      const response = await requestAI('/api/materials', { title: `${state.materialConfig.subject} · ${state.materialConfig.topic}`, subject: state.materialConfig.subject, grade: state.materialConfig.grade, summary: state.materialSections[0]?.body || `Materi ${state.materialConfig.topic}`, content: state.materialSections.map((section) => `${section.title}\n${section.body}`).join('\n\n'), sections: state.materialSections, status: 'Draft', updatedAt: 'Hari ini' });
      if (!response?.id) throw new Error('Materi belum berhasil disimpan.');
      showToast(successMessage);
    } catch (error) { showToast(error.message); }
  }

  async function saveQuestionsToWorkspace() {
    try {
      const assessment = await requestAI('/api/assessments', { title: `${state.questionConfig.subject} — ${state.questionConfig.topic}`, subject: state.questionConfig.subject, grade: state.questionConfig.grade, questionCount: state.questions.length || state.questionConfig.total, duration: state.questionConfig.duration, status: 'Draft', updatedAt: 'Hari ini' });
      await Promise.all(state.questions.map(({ id: _id, ...question }, index) => requestAI('/api/questions', { ...question, assessmentId: assessment.id, number: index + 1 })));
      showToast('Ulangan dan soal AI disimpan sebagai draft.');
    } catch (error) { showToast(error.message); }
  }

  async function beginAnalysis() {
    if (state.gradingAnalysisLoading || !state.gradingResults) return;
    state.gradingAnalysisLoading = true;
    showToast('AI sedang membaca pola dari hasil penilaian.');
    render();
    try {
      state.gradingAnalysis = await mockServices.analyzeAssessment(state.gradingResults.results);
      state.gradingAnalysisLoading = false;
      render();
    } catch (error) {
      state.gradingAnalysisLoading = false;
      showToast(error.message);
      render();
    }
  }

  async function searchReference() {
    const titleInput = document.querySelector('#reference-title-input');
    const isbnInput = document.querySelector('#reference-isbn');
    const title = titleInput?.value.trim() || '';
    const isbn = isbnInput?.value.trim() || '';
    if (!title && !isbn) {
      showToast('Masukkan nama buku atau ISBN untuk mulai mencari.');
      titleInput?.focus();
      return;
    }
    state.referenceQuery = { title, isbn };
    state.referenceSearching = true;
    state.referenceResults = [];
    render();
    try {
      state.referenceResults = await mockServices.searchReferenceBook(state.referenceQuery);
      state.referenceSearching = false;
      showToast('Referensi ditemukan. Verifikasi sumber sebelum digunakan.');
    } catch (error) {
      state.referenceSearching = false;
      showToast(error.message);
    }
    render();
  }

  function selectReference(id) {
    state.selectedReference = state.referenceResults.find((book) => book.id === id) || null;
    if (state.selectedReference) showToast('Referensi dipilih sebagai konteks tambahan.');
    render();
  }

  window.addEventListener('hashchange', render);
  hydrateIcons(document);
  render();
})();
