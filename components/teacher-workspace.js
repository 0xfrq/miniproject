'use client';

import { useEffect, useState } from 'react';
import { Icon } from './ui-icon';
import LogoutButton from './logout-button';
import TeacherMaterials from './teacher-materials';
import TeacherAssessments from './teacher-assessments';
import assessmentRules from '../lib/assessments';
import gradingRules from '../lib/grading';
import TeacherGrading from './teacher-grading';
import TeacherAssistant, { BookLibrary } from './teacher-assistant';
import { BookPicker, gradeNumber } from './book-tools';



function Layout({ active, setActive, children, user, userLoading }) {
  const links = [['dashboard', 'Dashboard', 'home'], ['assistant', 'Asisten AI', 'spark'], ['library', 'Buku SIBI', 'search'], ['materials', 'Materi', 'book'], ['assessments', 'Ulangan', 'clipboard'], ['grading', 'Penilaian', 'chart'], ['history', 'Riwayat', 'clock']];
  const classLabel = user?.className || user?.class?.name || user?.class?.label || user?.kelas?.name || user?.kelas || 'Kelas belum ditentukan';
  const yearLabel = user?.academicYear || user?.tahunAjaran || '';
  const initials = user?.name ? user.name.trim().split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase() : 'G';
  return <div className="teacher-shell">
    <aside className="teacher-sidebar">
      <a className="teacher-brand" href="/" aria-label="Kembali ke beranda SDN Bangah">
        <span className="teacher-brand__logo"><img src="/assets/logo-sekolah.png" alt="Logo SDN Bangah" onError={(event) => { event.currentTarget.style.display = 'none'; }} /></span>
        <span><strong>SDN Bangah</strong><small>WORKSPACE GURU</small></span>
      </a>
      <div className="teacher-school"><span>B</span><div><strong>SDN Bangah No. 383</strong><small>{userLoading ? 'Memuat kelas...' : classLabel}{yearLabel ? ` · ${yearLabel}` : ''}</small></div></div>
      <nav aria-label="Navigasi workspace guru">{links.map(([key, label, icon]) => <button type="button" key={key} className={active === key ? 'is-active' : ''} onClick={() => setActive(key)}><i><Icon name={icon} size={17} /></i><span>{label}</span></button>)}</nav>
      <div className="teacher-sidebar__bottom"><div className="teacher-ai-note"><span><Icon name="spark" size={18} /></span><strong>Workspace pembelajaran</strong><p>Kelola materi, asesmen, dan hasil penilaian dari satu tempat.</p></div><a href="/"><Icon name="chevronLeft" size={14} /> Kembali ke profil</a></div>
    </aside>
    <main className="teacher-main"><header className="teacher-topbar"><div className="teacher-mobile-brand"><strong>SDN Bangah</strong></div><span className="teacher-breadcrumb">Workspace Guru / <strong>{links.find(([key]) => key === active)?.[1]}</strong></span><div className="teacher-topbar__right"><span className="teacher-mode">{userLoading ? 'Memuat profil...' : (user?.name || 'Profil belum terhubung')}</span><span className="teacher-avatar" title={user?.name || 'Guru'}>{initials}</span><LogoutButton /></div></header>{children}</main>
  </div>;
}

export default function TeacherWorkspace() {
  const [active, setActive] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState('');
  const [assessments, setAssessments] = useState([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [assessmentsError, setAssessmentsError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [grading, setGrading] = useState([]);
  const [gradingLoading, setGradingLoading] = useState(true);
  const [gradingError, setGradingError] = useState('');
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);
  const [assistantBooks, setAssistantBooks] = useState([]);

  useEffect(() => {
    // /api/me adalah kontrak untuk backend autentikasi di masa depan.
    // Tidak menggunakan nama dan kelas dummy jika endpoint belum tersedia.
    const controller = new AbortController();
    async function load() {
      const endpoints = ['/api/dashboard', '/api/materials', '/api/assessments', '/api/questions', '/api/grading', '/api/me'];
      const results = await Promise.allSettled(endpoints.map(async (url) => {
        const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json();
      }));
      if (controller.signal.aborted) return;
      const values = results.map((result) => result.status === 'fulfilled' ? result.value : null);
      const [dash, materialData, assessmentData, questionData, gradingData, profile] = values;
      setDashboard(dash && typeof dash === 'object' ? dash : null);
      setDashboardError(!dash);
      setMaterials(Array.isArray(materialData) ? materialData : []);
      setMaterialsError(Array.isArray(materialData) ? '' : 'Materi belum dapat dimuat. Periksa koneksi, lalu coba lagi.');
      setMaterialsLoading(false);
      setAssessments(Array.isArray(assessmentData) ? assessmentData : []);
      setQuestions(Array.isArray(questionData) ? questionData : []);
      setAssessmentsError(Array.isArray(assessmentData) && Array.isArray(questionData) ? '' : 'Ulangan dan soal belum dapat dimuat. Coba lagi.');
      setAssessmentsLoading(false);
      setGrading(Array.isArray(gradingData) ? gradingData : []);
      setGradingError(Array.isArray(gradingData) ? '' : 'Hasil penilaian belum dapat dimuat. Coba lagi.');
      setGradingLoading(false);
      // Dukungan bentuk {user:{...}}, {profile:{...}} atau objek profil langsung.
      const person = profile?.user || profile?.profile || profile;
      setUser(person && typeof person === 'object' && (person.name || person.nama) ? { ...person, name: person.name || person.nama } : null);
      setUserLoading(false);
      setDashboardLoading(false);
      if (!dash) setNotice('Statistik belum tersedia. Periksa koneksi API dashboard.');
    }
    load().catch(() => { if (!controller.signal.aborted) { setMaterialsLoading(false); setMaterialsError('Materi belum dapat dimuat. Coba lagi.'); setAssessmentsLoading(false); setAssessmentsError('Ulangan dan soal belum dapat dimuat. Coba lagi.'); setGradingLoading(false); setGradingError('Hasil penilaian belum dapat dimuat. Coba lagi.'); setUserLoading(false); setDashboardLoading(false); setDashboardError(true); setNotice('Data belum dapat dimuat.'); } });
    return () => controller.abort();
  }, []);

  async function materialRequest(url, options) {
    let response;
    try { response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options }); }
    catch { throw new Error('Koneksi terputus. Perubahan belum disimpan. Coba lagi.'); }
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(response.status === 401 ? 'Sesi berakhir. Silakan masuk kembali.' : data?.error || 'Permintaan belum berhasil. Coba lagi.');
    return data;
  }

  async function retryMaterials() {
    setMaterialsLoading(true); setMaterialsError('');
    try { setMaterials(await materialRequest('/api/materials')); }
    catch (error) { setMaterialsError(error.message); }
    finally { setMaterialsLoading(false); }
  }

  function syncMaterialDashboard(items) {
    setDashboard((current) => current ? { ...current, counts: { ...current.counts, materials: items.length }, recentMaterials: items.slice(0, 4) } : current);
  }

  async function saveMaterial(id, payload) {
    setNotice('');
    const item = await materialRequest(`/api/materials${id ? '/' + encodeURIComponent(id) : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const next = id ? materials.map((existing) => existing.id === id ? item : existing) : [item, ...materials];
    setMaterials(next); syncMaterialDashboard(next);
    setNotice(id ? 'Materi berhasil diperbarui.' : 'Materi berhasil disimpan.');
    return item;
  }

  async function deleteMaterial(id) {
    setNotice('');
    await materialRequest(`/api/materials/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const next = materials.filter((item) => item.id !== id);
    setMaterials(next); syncMaterialDashboard(next); setNotice('Materi berhasil dihapus.');
  }

  async function retryAssessments() {
    setAssessmentsLoading(true); setAssessmentsError('');
    try {
      const [items, savedQuestions] = await Promise.all([materialRequest('/api/assessments'), materialRequest('/api/questions')]);
      setAssessments(items); setQuestions(savedQuestions);
    } catch (error) { setAssessmentsError(error.message); }
    finally { setAssessmentsLoading(false); }
  }

  async function saveAssessment(id, payload) {
    setNotice('');
    const saved = await materialRequest(`/api/assessments${id ? '/' + encodeURIComponent(id) : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const { questions: savedQuestions, ...assessment } = saved;
    const next = id ? assessments.map((item) => item.id === id ? assessment : item) : [assessment, ...assessments];
    setAssessments(next);
    setQuestions((current) => [...current.filter((question) => question.assessmentId !== assessment.id), ...savedQuestions]);
    setDashboard((current) => current ? { ...current, counts: { ...current.counts, assessments: next.length }, recentAssessments: next.slice(0, 4) } : current);
    setNotice(id ? 'Ulangan dan soal berhasil diperbarui.' : 'Ulangan dan soal berhasil disimpan.');
    return assessment;
  }

  async function deleteAssessment(id) {
    setNotice('');
    await materialRequest(`/api/assessments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const next = assessments.filter((item) => item.id !== id);
    setAssessments(next); setQuestions((current) => current.filter((question) => question.assessmentId !== id));
    setDashboard((current) => current ? { ...current, counts: { ...current.counts, assessments: next.length }, recentAssessments: next.slice(0, 4) } : current);
    setNotice('Ulangan dan seluruh soalnya berhasil dihapus.');
  }

  async function retryGrading() {
    setGradingLoading(true); setGradingError('');
    try {
      const [results, items, savedQuestions] = await Promise.all([materialRequest('/api/grading'), materialRequest('/api/assessments'), materialRequest('/api/questions')]);
      setGrading(results); setAssessments(items); setQuestions(savedQuestions); setAssessmentsError('');
      syncGradingDashboard(results);
    } catch (error) { setGradingError(error.message); }
    finally { setGradingLoading(false); }
  }

  function syncGradingDashboard(items) {
    setDashboard((current) => current ? { ...current, counts: { ...current.counts, graded: items.length }, recentResults: items.slice(0, 5), gradingSummary: gradingRules.summary(items) } : current);
  }

  async function saveGrading(id, payload) {
    setNotice('');
    const item = await materialRequest(`/api/grading${id ? '/' + encodeURIComponent(id) : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    // Functional update: scan batch menyimpan beberapa hasil berturut-turut.
    setGrading((current) => { const next = id ? current.map((existing) => existing.id === id ? item : existing) : [item, ...current.filter((existing) => existing.id !== item.id)]; syncGradingDashboard(next); return next; });
    setNotice(id ? 'Hasil penilaian berhasil diperbarui.' : 'Hasil penilaian berhasil disimpan.');
    return item;
  }

  async function deleteGrading(id) {
    setNotice('');
    await materialRequest(`/api/grading/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const next = grading.filter((item) => item.id !== id);
    setGrading(next); syncGradingDashboard(next); setNotice('Hasil penilaian berhasil dihapus.');
  }

  async function loadGradingAssessment(id) { return materialRequest(`/api/assessments/${encodeURIComponent(id)}`); }

  const displayAssessments = assessments.map((item) => ({ ...item, questionCount: assessmentRules.orderedQuestions(questions, item.id).length }));

  async function saveGeneratedMaterial({ config, sections, sources = [], books = [] }) {
    const cited = sources.filter((source) => sections.some((section) => String(section.body).includes(`[${source.n}]`)));
    const references = cited.length ? `\n\nSumber:\n${cited.map((source) => `[${source.n}] ${source.title}, hal. ${source.pageStart}${source.pageEnd !== source.pageStart ? `–${source.pageEnd}` : ''}`).join('\n')}` : '';
    const content = sections.map((section) => `${section.title}\n${section.body}`).join('\n\n') + references;
    const item = await saveMaterial(null, { title: `${config.subject} · ${config.topic}`, subject: config.subject, grade: config.grade, summary: String(sections[0]?.body || `Materi ${config.topic}`).slice(0, 2000), content, sections, sources: cited, referenceBooks: books.map((book) => ({ id: book.id, title: book.title })), status: 'Draft' });
    if (item) setNotice('Materi AI disimpan sebagai draft. Periksa sebelum digunakan.');
    return item;
  }

  return <Layout active={active} setActive={setActive} user={user} userLoading={userLoading}>{notice && <div className="teacher-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}{active === 'assistant' && <TeacherAssistant initialBooks={assistantBooks} onConsumeInitial={() => setAssistantBooks([])} onSaveMaterial={(payload) => saveMaterial(null, payload)} />}{active === 'library' && <BookLibrary onAsk={(book) => { setAssistantBooks([book]); setActive('assistant'); }} />}{active === 'dashboard' && <TeacherDashboard dashboard={dashboard} materials={materials} assessments={displayAssessments} grading={grading} user={user} userLoading={userLoading} dashboardLoading={dashboardLoading} dashboardError={dashboardError} setActive={setActive} />}{active === 'materials' && <TeacherMaterials materials={materials} loading={materialsLoading} loadError={materialsError} onRetry={retryMaterials} onSave={saveMaterial} onDelete={deleteMaterial} renderGenerator={(close) => <MaterialGenerator onCancel={close} onSave={async (payload) => { const item = await saveGeneratedMaterial(payload); if (item) close(); }} />} />}{active === 'assessments' && <TeacherAssessments assessments={assessments} questions={questions} loading={assessmentsLoading} loadError={assessmentsError} onRetry={retryAssessments} onSave={saveAssessment} onDelete={deleteAssessment} />}{active === 'grading' && <TeacherGrading grading={grading} assessments={displayAssessments} loading={gradingLoading || assessmentsLoading} loadError={gradingError || assessmentsError} onRetry={retryGrading} onLoadAssessment={loadGradingAssessment} onSave={saveGrading} onDelete={deleteGrading} onAssessments={() => setActive('assessments')} />}{active === 'history' && <TeacherHistory materials={materials} assessments={displayAssessments} grading={grading} />}</Layout>;
}

function TeacherHeader({ eyebrow, title, description, action }) { return <header className="teacher-page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>; }
function TeacherDashboard({ dashboard, materials, assessments, grading, user, userLoading, dashboardLoading, dashboardError, setActive }) { return <div className="teacher-page"><TeacherHeader eyebrow="Workspace guru · SDN Bangah" title={userLoading ? "Memuat profil guru..." : user?.name ? `Selamat datang, ${user.name}.` : "Selamat datang di Workspace Guru."} description="Siap menyiapkan pembelajaran hari ini? Kelola materi, susun ulangan, dan lihat hasil kelas dari satu tempat." action={<span className="teacher-badge">{userLoading ? "Memuat kelas..." : (user?.className || user?.class?.name || user?.kelas?.name || user?.kelas || "Kelas belum ditentukan")}</span>} /><section className="teacher-welcome"><div><span className="section-label">Bukan pengganti guru</span><h2>Siapkan. Periksa. Gunakan.</h2><p>Asisten AI membantu menyusun materi, soal, dan kunci jawaban berdasarkan buku teks resmi SIBI Kemendikdasmen. Hasil AI selalu berupa draf yang Anda periksa.</p></div><div className="teacher-welcome__mark"><Icon name="book" size={62} strokeWidth={1.25} /></div></section><div className="teacher-quick-grid"><button onClick={() => setActive('assistant')}><span><Icon name="spark" size={18} /></span><strong>Tanya asisten AI</strong><small>Materi & soal dari buku SIBI</small></button><button onClick={() => setActive('materials')}><span><Icon name="plus" size={18} /></span><strong>Kelola materi</strong><small>Tambah dan edit materi kelas</small></button><button onClick={() => setActive('assessments')}><span><Icon name="plus" size={18} /></span><strong>Susun ulangan</strong><small>Manual atau dengan AI</small></button><button onClick={() => setActive('grading')}><span><Icon name="chart" size={18} /></span><strong>Lihat penilaian</strong><small>Input manual atau scan OCR</small></button></div><div className="teacher-stats" aria-label="Statistik dari backend"><Stat label="Materi" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.materials ?? "—")} /><Stat label="Ulangan" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.assessments ?? "—")} /><Stat label="Jawaban dinilai" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.graded ?? "—")} /><Stat label="Rata-rata nilai" value={dashboardLoading ? "…" : dashboardError || !dashboard?.counts?.graded ? "—" : (dashboard?.gradingSummary?.average ?? "—")} /></div><div className="teacher-two-column"><section className="teacher-panel"><PanelHead title="Materi terbaru" link="Lihat semua" onClick={() => setActive('materials')} />{materials.slice(0, 3).map((material) => <ListRow key={material.id} title={material.title} meta={`${material.subject} · ${material.grade}`} status={material.status} />)}</section><section className="teacher-panel"><PanelHead title="Ulangan aktif" link="Lihat semua" onClick={() => setActive('assessments')} />{assessments.slice(0, 3).map((assessment) => <ListRow key={assessment.id} title={assessment.title} meta={`${assessment.questionCount} soal · ${assessment.grade}`} status={assessment.status} />)}</section></div></div>; }
function Stat({ label, value }) { return <div className="teacher-stat"><span>{label}</span><strong>{value}</strong><small>dari API dashboard</small></div>; }
function PanelHead({ title, link, onClick }) { return <div className="teacher-panel__head"><h2>{title}</h2>{link && <button onClick={onClick}>{link} <Icon name="arrow" size={13} /></button>}</div>; }
function ListRow({ title, meta, status }) { return <article className="teacher-list-row"><div><strong>{title}</strong><small>{meta}</small></div><span className="teacher-badge teacher-badge--soft">{status}</span></article>; }

const SUBJECT_OPTIONS = ['IPAS', 'Matematika', 'Bahasa Indonesia', 'Pendidikan Pancasila', 'Bahasa Inggris', 'PJOK', 'Seni Rupa', 'Seni Musik', 'Seni Tari', 'Seni Teater', 'Pendidikan Agama Islam', 'Pendidikan Agama Kristen', 'Pendidikan Agama Katolik', 'Pendidikan Agama Hindu', 'Pendidikan Agama Buddha', 'Pendidikan Agama Khonghucu', 'Tematik'];

function MaterialGenerator({ onCancel, onSave }) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({ subject: 'IPAS', grade: 'Kelas 4 SD', topic: '', objective: '', duration: '2 × 35 menit', depth: 'Sesuai usia' });
  const [format, setFormat] = useState('Materi + Aktivitas');
  const [books, setBooks] = useState([]);
  const [sources, setSources] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);

  function change(key, value) { setConfig((current) => ({ ...current, [key]: value })); }
  function submitContext(event) { event.preventDefault(); if (!config.topic.trim() || !config.objective.trim()) return setError('Topik dan tujuan pembelajaran wajib diisi.'); if (books.some((book) => book.index?.status !== 'ready')) return setError('Tunggu hingga semua buku referensi berstatus "Siap untuk AI", atau hapus buku yang belum siap.'); setError(''); setStep(2); }
  async function generate() {
    setError(''); setGenerating(true); setStep(3);
    try {
      const response = await fetch('/api/ai/generate-material', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...config, format, bookIds: books.map((book) => book.id), reference: books.length ? books.map((book) => book.title).join('; ') : null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Materi belum dapat dibuat.');
      setSections(data.sections || []); setSources(data.sources || []); setStep(4);
    } catch (requestError) { setError(requestError.message); setStep(2); }
    finally { setGenerating(false); }
  }
  function updateSection(index, body) { setSections((current) => current.map((section, currentIndex) => currentIndex === index ? { ...section, body } : section)); }
  async function save() { setSaving(true); try { await onSave({ config, sections, sources, books, format }); } catch (failure) { setError(failure.message); } finally { setSaving(false); } }
  const formats = ['Ringkasan Materi', 'Materi Lengkap', 'Modul Pembelajaran', 'RPP / Lesson Plan', 'Materi + Aktivitas', 'Materi + Contoh Soal'];

  return <section className="material-generator"><div className="material-generator__head"><div><span className="section-label">AI Learning Generator · {step === 1 ? 'konteks' : step === 2 ? 'format' : step === 3 ? 'proses' : 'review'}</span><h2>{step === 1 ? 'Mulai dari konteks belajar.' : step === 2 ? 'Pilih format materi.' : step === 3 ? 'AI sedang menyusun materi.' : 'Periksa draf sebelum disimpan.'}</h2></div><button className="teacher-button teacher-button--quiet" type="button" onClick={onCancel}>Tutup generator</button></div><div className="material-steps"><span className={step >= 1 ? 'is-active' : ''}>01 Konteks</span><span className={step >= 2 ? 'is-active' : ''}>02 Format</span><span className={step >= 3 ? 'is-active' : ''}>03 Susun</span><span className={step >= 4 ? 'is-active' : ''}>04 Periksa</span></div>{error && <p className="material-generator__error" role="alert">{error}</p>}
    {step === 1 && <form className="material-generator__body" onSubmit={submitContext}><div className="teacher-form-grid"><label>Mata pelajaran<select value={config.subject} onChange={(event) => change('subject', event.target.value)}>{SUBJECT_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Kelas<select value={config.grade} onChange={(event) => change('grade', event.target.value)}>{[1, 2, 3, 4, 5, 6].map((grade) => <option key={grade}>{`Kelas ${grade} SD`}</option>)}</select></label><label className="field-full">Topik / materi<input required value={config.topic} onChange={(event) => change('topic', event.target.value)} placeholder="Contoh: Sistem pernapasan manusia" /></label><label className="field-full">Tujuan pembelajaran<textarea required rows="3" value={config.objective} onChange={(event) => change('objective', event.target.value)} placeholder="Siswa mampu ..." /></label><label>Durasi<select value={config.duration} onChange={(event) => change('duration', event.target.value)}><option>1 × 35 menit</option><option>2 × 35 menit</option><option>3 × 35 menit</option></select></label><label>Tingkat kedalaman<select value={config.depth} onChange={(event) => change('depth', event.target.value)}><option>Ringkas</option><option>Sesuai usia</option><option>Mendalam</option></select></label></div><BookPicker books={books} onChange={setBooks} max={3} defaultGrade={gradeNumber(config.grade)} title="Referensi buku SIBI" hint="Pilih Buku Siswa/Buku Guru yang sesuai. Materi akan disusun dari isi buku tersebut beserta nomor halamannya." /><div className="material-generator__actions"><button className="teacher-button teacher-button--dark" type="submit">Lanjut pilih format <Icon name="arrow" size={15} /></button></div></form>}
    {step === 2 && <div className="material-generator__body"><div className="material-format-grid">{formats.map((item) => <label className={format === item ? 'is-selected' : ''} key={item}><input type="radio" name="material-format" checked={format === item} onChange={() => setFormat(item)} /><span><strong>{item}</strong><small>{item === 'Materi + Aktivitas' ? 'Konsep, kegiatan, dan latihan' : 'Draf yang disesuaikan dengan kebutuhan kelas'}</small></span></label>)}</div><div className="material-generator__actions"><button className="teacher-button teacher-button--quiet" type="button" onClick={() => setStep(1)}>Kembali</button><button className="teacher-button teacher-button--dark" type="button" onClick={generate}>Susun dengan AI <Icon name="spark" size={15} /></button></div></div>}
    {step === 3 && <div className="material-generator__loading" aria-live="polite"><Icon name="spark" size={32} /><strong>{generating ? 'Memahami konteks dan menyusun materi...' : 'Menyiapkan hasil...'}</strong><p>{books.length ? 'AI membaca kutipan buku referensi lalu menyesuaikannya' : 'AI menyesuaikan materi'} dengan {config.grade} dan tujuan pembelajaran yang kamu berikan.</p></div>}
    {step === 4 && <div className="material-generator__body"><div className="material-review-note"><strong>Draf siap ditinjau.</strong><span>{config.subject} · {config.topic}{books.length ? ` · Referensi: ${books.map((book) => book.title).join('; ')}` : ' · Tanpa buku referensi'}</span></div><div className="material-sections">{sections.map((section, index) => <label key={`${section.id}-${index}`}><span>{section.title}</span><textarea rows="5" value={section.body} onChange={(event) => updateSection(index, event.target.value)} /></label>)}</div>{sources.length > 0 && <div className="ai-sources"><span className="section-label">Kutipan buku yang dipakai AI</span><ol>{sources.map((source) => <li key={source.n} value={source.n}><a href={source.url} target="_blank" rel="noopener noreferrer"><strong>{source.title}</strong> · hal. {source.pageStart} ↗</a><small>{source.excerpt}…</small></li>)}</ol></div>}<div className="material-generator__actions"><button className="teacher-button teacher-button--quiet" type="button" onClick={() => setStep(2)}>Buat ulang</button><button className="teacher-button teacher-button--dark" type="button" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan sebagai draft'} <Icon name="check" size={15} /></button></div></div>}
  </section>;
}
function TeacherHistory({ materials, assessments, grading }) { const items = [...materials.map((item) => ({ type: 'Materi', title: item.title, meta: `${item.subject} · ${item.grade}`, date: item.updatedAt })), ...assessments.map((item) => ({ type: 'Ulangan', title: item.title, meta: `${item.questionCount} soal · ${item.grade}`, date: item.updatedAt })), ...grading.map((item) => ({ type: 'Nilai', title: `Hasil ${item.studentName}`, meta: `Nilai ${item.score}${item.assessmentSnapshot?.title ? ' - ' + item.assessmentSnapshot.title : ''}`, date: item.updatedAt || item.createdAt || 'Waktu belum dicatat' }))]; return <div className="teacher-page"><TeacherHeader eyebrow="Workspace Guru · arsip" title="Riwayat aktivitas." description="Materi, ulangan, dan hasil penilaian yang sudah tercatat di workspace." /><div className="teacher-history-list">{items.map((item, index) => <article key={`${item.type}-${index}`}><span>{item.type}</span><div><strong>{item.title}</strong><small>{item.meta}</small></div><time>{item.date}</time></article>)}</div></div>; }
