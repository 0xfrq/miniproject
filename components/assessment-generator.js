'use client';

import { useState } from 'react';
import { Icon } from './ui-icon';
import { BookPicker, apiRequest, gradeNumber } from './book-tools';
import rules from '../lib/assessments';
import generated from '../lib/generated-questions';
import './teacher-ai.css';

const SUBJECTS = ['IPAS', 'Matematika', 'Bahasa Indonesia', 'Pendidikan Pancasila', 'Bahasa Inggris', 'PJOK', 'Seni Rupa', 'Seni Musik', 'Seni Tari', 'Seni Teater', 'Pendidikan Agama Islam', 'Pendidikan Agama Kristen', 'Pendidikan Agama Katolik', 'Pendidikan Agama Hindu', 'Pendidikan Agama Buddha', 'Pendidikan Agama Khonghucu', 'Tematik'];
const EXAM_TYPES = ['Ulangan Harian', 'Sumatif Lingkup Materi', 'Penilaian Tengah Semester', 'Penilaian Akhir Semester', 'Latihan Soal'];

export default function AssessmentGenerator({ onCancel, onDone }) {
  const [config, setConfig] = useState({ examType: 'Ulangan Harian', subject: 'IPAS', grade: 'Kelas 4 SD', topic: '', objective: '', multiple: 10, short: 5, essay: 3, difficulty: 'Campuran (mudah–sedang–sulit)', duration: 60 });
  const [books, setBooks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const change = (key, value) => setConfig((current) => ({ ...current, [key]: value }));
  const total = Number(config.multiple || 0) + Number(config.short || 0) + Number(config.essay || 0);

  async function generate(event) {
    event?.preventDefault(); setError('');
    if (!config.topic.trim() || !config.objective.trim()) return setError('Topik dan tujuan pembelajaran wajib diisi.');
    if (total < 1 || total > 50) return setError('Jumlah soal harus 1–50.');
    if (books.some((book) => book.index?.status !== 'ready')) return setError('Tunggu hingga semua buku referensi berstatus "Siap untuk AI", atau hapus buku yang belum siap.');
    setBusy(true);
    try {
      const data = await apiRequest('/api/ai/generate-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        subject: config.subject, grade: config.grade, topic: config.topic, objective: config.objective, total, duration: `${config.duration} menit`,
        multiple: Number(config.multiple), short: Number(config.short), essay: Number(config.essay), difficulty: config.difficulty,
        distribution: `${config.examType}; urutkan dari mudah ke sulit`, bookIds: books.map((book) => book.id),
      }) });
      const questions = generated.normalizeGenerated(data.questions || []);
      if (!questions.length) throw new Error('AI tidak menghasilkan soal. Coba ulangi.');
      setResult({ questions, sources: data.sources || [] });
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  function openEditor() {
    onDone({
      item: { title: `${config.examType} ${config.subject} · ${config.topic}`.slice(0, 200), subject: config.subject, grade: config.grade, duration: String(config.duration), status: 'Draft', referenceBooks: books.map((book) => ({ id: book.id, title: book.title })) },
      questions: result.questions, sources: result.sources,
    });
  }

  const counts = result ? rules.types.map((type) => [type, result.questions.filter((question) => question.type === type).length]).filter(([, count]) => count) : [];
  return <section className="material-generator exam-generator">
    <div className="material-generator__head"><div><span className="section-label">AI · soal ujian + kunci jawaban</span><h2>{result ? 'Soal siap ditinjau.' : 'Generate soal ujian.'}</h2></div><button className="teacher-button teacher-button--quiet" type="button" onClick={onCancel}>Tutup generator</button></div>
    {error && <p className="material-generator__error" role="alert">{error}</p>}
    {!result ? <form className="material-generator__body" onSubmit={generate}><fieldset disabled={busy} className="ai-fieldset"><legend className="ai-sr-only">Pengaturan soal</legend>
      <div className="teacher-form-grid">
        <label>Jenis penilaian<select value={config.examType} onChange={(event) => change('examType', event.target.value)}>{EXAM_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Mata pelajaran<select value={config.subject} onChange={(event) => change('subject', event.target.value)}>{SUBJECTS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Kelas<select value={config.grade} onChange={(event) => change('grade', event.target.value)}>{[1, 2, 3, 4, 5, 6].map((grade) => <option key={grade}>{`Kelas ${grade} SD`}</option>)}</select></label>
        <label>Durasi (menit)<input type="number" min="5" max="600" value={config.duration} onChange={(event) => change('duration', event.target.value)} /></label>
        <label className="field-full">Topik / bab<input value={config.topic} onChange={(event) => change('topic', event.target.value)} placeholder="Contoh: Bab 1 Mengubah Bentuk Energi" /></label>
        <label className="field-full">Tujuan pembelajaran / kompetensi<textarea rows="2" value={config.objective} onChange={(event) => change('objective', event.target.value)} placeholder="Siswa mampu menjelaskan proses fotosintesis dan perubahan energi" /></label>
        <label>Pilihan ganda<input type="number" min="0" max="50" value={config.multiple} onChange={(event) => change('multiple', event.target.value)} /></label>
        <label>Isian singkat<input type="number" min="0" max="50" value={config.short} onChange={(event) => change('short', event.target.value)} /></label>
        <label>Essay / uraian<input type="number" min="0" max="20" value={config.essay} onChange={(event) => change('essay', event.target.value)} /></label>
        <label>Tingkat kesulitan<select value={config.difficulty} onChange={(event) => change('difficulty', event.target.value)}><option>Campuran (mudah–sedang–sulit)</option><option>Mudah</option><option>Sedang</option><option>Sulit (HOTS)</option></select></label>
      </div>
      <BookPicker books={books} onChange={setBooks} max={3} defaultGrade={gradeNumber(config.grade)} title="Referensi buku SIBI" hint="Soal, kunci, dan pembahasan disusun dari isi buku yang dipilih. Tanpa buku, AI memakai pengetahuan umum." />
      </fieldset>
      <div className="material-generator__actions"><span className="exam-generator__total">{total} soal</span><button className="teacher-button teacher-button--dark" type="submit" disabled={busy}>{busy ? 'AI sedang menyusun soal…' : <>Generate soal & kunci <Icon name="spark" size={15} /></>}</button></div>
    </form> : <div className="material-generator__body">
      <div className="material-review-note"><strong>{result.questions.length} soal dibuat: {counts.map(([type, count]) => `${count} ${type}`).join(', ')}.</strong><span>Kunci jawaban dan pembahasan/rubrik sudah terisi. Buka editor untuk memeriksa, mengubah, lalu menyimpan sebagai ulangan.</span></div>
      <ol className="exam-generator__preview">{result.questions.slice(0, 5).map((question) => <li key={question.id}><span className="section-label">{question.type}</span><p>{question.text}</p><small>Kunci: {question.type === 'Pilihan Ganda' ? `${question.correct}. ${question.options[question.correct.charCodeAt(0) - 65] || ''}` : question.correct}</small></li>)}</ol>
      {result.questions.length > 5 && <p className="book-picker__note">…dan {result.questions.length - 5} soal lainnya di editor.</p>}
      {result.sources.length > 0 && <div className="ai-sources"><span className="section-label">Kutipan buku yang dipakai AI</span><ol>{result.sources.map((source) => <li key={source.n} value={source.n}><a href={source.url} target="_blank" rel="noopener noreferrer"><strong>{source.title}</strong> · hal. {source.pageStart} ↗</a></li>)}</ol></div>}
      <div className="material-generator__actions"><button className="teacher-button teacher-button--quiet" type="button" onClick={() => setResult(null)}>Ubah pengaturan</button><button className="teacher-button" type="button" disabled={busy} onClick={generate}>{busy ? 'Menyusun ulang…' : 'Generate ulang'}</button><button className="teacher-button teacher-button--dark" type="button" onClick={openEditor}>Buka di editor ulangan <Icon name="arrow" size={15} /></button></div>
    </div>}
  </section>;
}
