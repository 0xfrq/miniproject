'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui-icon';
import rules from '../lib/grading';
import examRules from '../lib/assessments';
import './teacher-grading.css';
import GradeCsvExport from './grade-csv-export';
import OcrScanner from './ocr-scanner';
import OcrBatch from './ocr-batch';

const detailed = (item) => item?.schemaVersion === 1 && !!item.assessmentSnapshot?.questions?.length;
const scoreText = (value) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
function dateText(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Waktu belum dicatat' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date) + ' WIB'; }
function resultExam(item, assessments) { return item.assessmentSnapshot?.title || assessments.find((exam) => exam.id === item.assessmentId)?.title || 'Ulangan lama'; }
function responseText(question, response) {
  if (!response) return 'Tidak dijawab';
  if (question.type !== 'Pilihan Ganda') return response;
  const index = response.charCodeAt(0) - 65;
  return `${response}. ${examRules.optionText(question.options[index], index)}`;
}

export default function TeacherGrading({ grading, assessments, loading, loadError, onRetry, onLoadAssessment, onSave, onDelete, onAssessments }) {
  const [mode, setMode] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmHeading = useRef(null);
  useEffect(() => { if (deleting) confirmHeading.current?.focus(); }, [deleting]);
  const selected = grading.find((item) => item.id === selectedId);
  const available = assessments.filter((item) => item.status === 'Siap digunakan' && item.questionCount > 0);
  function open(next, id = null) { setMode(next); setSelectedId(id); setError(''); setDeleting(null); }
  async function save(payload) { const item = await onSave(mode === 'edit' ? selectedId : null, payload); setSelectedId(item.id); setMode('view'); }
  async function remove() {
    setBusy(true); setError('');
    try { await onDelete(deleting.id); open('list'); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <div className="teacher-page manual-grading-page">
    <header className="teacher-page-header"><div><p className="eyebrow">Workspace Guru · penilaian</p><h1>Hasil penilaian.</h1><p>Masukkan jawaban manual, scan satu siswa, atau scan batch seluruh kelas sekaligus dengan OCR. Periksa, lalu simpan.</p></div>{mode === 'list' && <div className="manual-grade-actions"><button className="teacher-button" type="button" disabled={loading || !!loadError || !available.length} onClick={() => open('batch')}><Icon name="scan" size={15} />Scan batch (OCR)</button><button className="teacher-button teacher-button--dark" type="button" disabled={loading || !!loadError || !available.length} onClick={() => open('create')}><Icon name="plus" size={15} />Tambah penilaian</button></div>}</header>
    {loading ? <p role="status">Memuat hasil penilaian…</p> : loadError ? <section className="teacher-panel"><p role="alert">{loadError}</p><button className="teacher-button" type="button" onClick={onRetry}>Coba lagi</button></section> : <>
      {mode === 'batch' ? <OcrBatch assessments={available} grading={grading} onLoadAssessment={onLoadAssessment} onClose={() => open('list')}
          onSaveResult={(payload) => onSave(null, payload)}
          renderReview={(prefill, done, cancel) => <GradingForm key={`batch-${prefill.studentName}-${prefill.studentNumber}`} prefill={prefill} assessments={available} onLoadAssessment={onLoadAssessment} onSave={async (payload) => done(await onSave(null, payload))} onCancel={cancel} />} />
        : mode === 'create' || mode === 'edit' ? <GradingForm key={`${mode}-${selectedId || 'new'}`} saved={mode === 'edit' ? selected : null} assessments={available} onLoadAssessment={onLoadAssessment} onSave={save} onCancel={() => open(mode === 'edit' ? 'view' : 'list', selectedId)} />
        : mode === 'view' && selected ? <>
          <section className="teacher-panel manual-grade-detail"><div className="manual-grade-actions"><button className="teacher-button" type="button" onClick={() => open('list')}>← Daftar penilaian</button><span className="teacher-badge teacher-badge--soft">{detailed(selected) ? 'Selesai' : 'Ringkasan lama'}</span></div><h2>{selected.studentName}</h2><p>{selected.studentNumber ? `No. absen ${selected.studentNumber} · ` : ''}{resultExam(selected, assessments)}</p><small>{dateText(selected.updatedAt || selected.createdAt)}</small>
            <GradeSummary result={selected} />
            {!detailed(selected) && <p className="manual-grade-note">Hasil lama ini belum memiliki rincian jawaban. Nilai ringkasan tetap tersimpan; edit ringkasan tidak menambahkan jawaban atau menghitung ulang jumlah benar/salah.</p>}
            {selected.notes && <section><h3>Catatan hasil</h3><p className="manual-grade-prose">{selected.notes}</p></section>}
            <div className="manual-grade-actions"><button className="teacher-button teacher-button--dark" type="button" disabled={busy} onClick={() => open('edit', selected.id)}>Edit hasil</button><button className="teacher-button manual-grade-delete" type="button" disabled={busy} onClick={() => { setError(''); setDeleting(selected); }}>Hapus hasil</button><a className="teacher-button" href={`/guru/penilaian/${encodeURIComponent(selected.id)}/cetak`} target="_blank" rel="noopener noreferrer">Cetak laporan / PDF ↗</a></div>
          </section>
          {detailed(selected) && <section className="teacher-panel manual-grade-answers"><h2>Rincian jawaban</h2><p className="manual-grade-note">Soal dan kunci disimpan bersama hasil ini. Perubahan ulangan berikutnya tidak mengubah nilai tersimpan.</p><ol>{selected.assessmentSnapshot.questions.map((question, index) => { const answer = selected.answers.find((item) => item.questionId === question.id); return <li key={question.id}><span className="section-label">{question.type}</span><p className="manual-grade-prose">{question.text}</p><dl><dt>Jawaban siswa</dt><dd>{responseText(question, answer.response)}</dd><dt>Kunci / acuan jawaban</dt><dd>{responseText(question, question.correct)}</dd><dt>Poin</dt><dd>{scoreText(answer.points)} / {rules.pointsPerQuestion}</dd></dl>{answer.feedback && <p className="manual-grade-prose">Catatan guru: {answer.feedback}</p>}{question.explanation && <p className="manual-grade-prose">Pembahasan: {question.explanation}</p>}</li>; })}</ol></section>}
        </> : <>
          {!available.length && <section className="teacher-panel manual-grade-guidance"><h2>Siapkan ulangan untuk dinilai.</h2><p>Tambahkan soal dan kunci lengkap, lalu ubah status ulangan menjadi Siap digunakan.</p><button className="teacher-button" type="button" onClick={onAssessments}>Buka Ulangan</button></section>}
          <GradeCsvExport assessments={assessments} grading={grading} />
          <div className="teacher-list manual-grade-list">{grading.length ? grading.map((item) => <article className="teacher-content-card" key={item.id}><div className="teacher-content-card__icon"><Icon name="chart" size={22} /></div><div className="manual-grade-card-copy"><span className="section-label">{resultExam(item, assessments)}</span><h2>{item.studentNumber ? <small className="manual-grade-absen">{item.studentNumber}</small> : null}{item.studentName}</h2><p>{dateText(item.updatedAt || item.createdAt)}</p><small>{detailed(item) ? `${item.answers.length} jawaban · Selesai` : 'Ringkasan lama · rincian jawaban belum tersedia'}</small></div><div className="teacher-content-card__actions"><strong className="manual-grade-score">{scoreText(item.score)} <small>/ 100</small></strong><div className="manual-grade-actions"><button className="teacher-button" type="button" disabled={busy} onClick={() => open('view', item.id)}>Lihat</button><button className="teacher-button" type="button" disabled={busy} onClick={() => open('edit', item.id)}>Edit</button><button className="teacher-button manual-grade-delete" type="button" disabled={busy} onClick={() => { setError(''); setDeleting(item); }}>Hapus</button></div></div></article>) : <section className="teacher-panel manual-grade-empty"><Icon name="chart" size={30} /><h2>Belum ada hasil penilaian.</h2><p>Pilih Tambah penilaian untuk memasukkan jawaban siswa.</p></section>}</div>
        </>}
      {deleting && <section className="teacher-panel manual-grade-confirm" aria-labelledby="manual-grade-delete-title"><h2 ref={confirmHeading} tabIndex={-1} id="manual-grade-delete-title">Hapus hasil penilaian?</h2><p>Hasil “{deleting.studentName}” dan rincian jawabannya akan dihapus permanen. Soal ulangan tetap tersimpan.</p>{error && <p role="alert">{error}</p>}<div className="manual-grade-actions"><button className="teacher-button" type="button" disabled={busy} onClick={() => { setDeleting(null); setError(''); }}>Batal</button><button className="teacher-button manual-grade-delete" type="button" disabled={busy} onClick={remove}>{busy ? 'Menghapus…' : 'Ya, hapus hasil'}</button></div></section>}
    </>}
  </div>;
}

function GradeSummary({ result }) {
  return <div className="manual-grade-summary"><div><span>Nilai akhir</span><strong>{scoreText(result.score)}</strong><small>dari 100</small></div>{result.maxPoints && <><div><span>Total poin</span><strong>{scoreText(result.earnedPoints)} / {result.maxPoints}</strong><small>Setiap soal maksimal {rules.pointsPerQuestion} poin</small></div><div><span>Rincian soal</span><p>{result.correct} penuh · {result.partial} sebagian · {result.wrong} nol poin</p><small>{result.unanswered} tidak dijawab</small></div></>}</div>;
}

function ocrAnswers(snapshot, result, current) {
  const byId = new Map(result.answers.map((answer) => [answer.questionId, answer]));
  return current.map((answer) => { const read = byId.get(answer.questionId); return read ? { ...answer, response: read.response, points: read.points, feedback: read.feedback || answer.feedback || '' } : answer; });
}
function ocrMeta(result) { return { meta: Object.fromEntries(result.answers.map((answer) => [answer.questionId, { confidence: answer.confidence, reason: answer.reason }])), notes: result.notes }; }

function GradingForm({ saved, prefill, assessments, onLoadAssessment, onSave, onCancel }) {
  const legacy = !!saved && !detailed(saved);
  const [studentName, setStudentName] = useState(saved?.studentName || prefill?.studentName || '');
  const [studentNumber, setStudentNumber] = useState(saved?.studentNumber || prefill?.studentNumber || '');
  const [notes, setNotes] = useState(saved?.notes || prefill?.notes || '');
  const [legacyScore, setLegacyScore] = useState(saved?.score ?? '');
  const [assessmentId, setAssessmentId] = useState(saved?.assessmentId || prefill?.assessmentId || '');
  const [exam, setExam] = useState(saved?.assessmentSnapshot || null);
  const [answers, setAnswers] = useState(saved?.answers || []);
  const [revision, setRevision] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ocr, setOcr] = useState(null);
  const loader = useRef(onLoadAssessment); loader.current = onLoadAssessment;
  const prefillRef = useRef(prefill?.ocrResult || null);
  useEffect(() => {
    if (saved || !assessmentId) return;
    let disposed = false;
    setExam(null); setAnswers([]); setOcr(null); setFetching(true); setLoadError(''); setError('');
    loader.current(assessmentId).then((item) => {
      const snapshot = rules.snapshot(item);
      if (disposed) return;
      const empty = snapshot.questions.map((question) => ({ questionId: question.id, response: '', points: null, feedback: '' }));
      const pending = prefillRef.current;
      prefillRef.current = null;
      setExam(snapshot);
      // Hasil OCR batch diterapkan sekali saat soal pertama kali dimuat.
      if (pending && pending.assessmentId === snapshot.id && pending.assessmentVersion === snapshot.updatedAt) { setAnswers(ocrAnswers(snapshot, pending, empty)); setOcr(ocrMeta(pending)); }
      else { setAnswers(empty); if (pending) setError('Ulangan berubah setelah foto dibaca. Scan ulang atau isi manual.'); }
    }).catch((failure) => { if (!disposed) setLoadError(failure.message); }).finally(() => { if (!disposed) setFetching(false); });
    return () => { disposed = true; };
  }, [assessmentId, revision, saved]);
  function applyOcr(result) {
    if (!exam || result.assessmentId !== exam.id) return;
    if (result.assessmentVersion !== exam.updatedAt) setError('Ulangan berubah setelah dimuat. Klik "Muat ulang soal" lalu scan ulang.');
    setAnswers((current) => ocrAnswers(exam, result, current));
    setOcr(ocrMeta(result));
    if (!studentName.trim() && result.studentName) setStudentName(result.studentName);
    if (!String(studentNumber).trim() && result.studentNumber) setStudentNumber(result.studentNumber);
    if (result.notes) setNotes((current) => current || `Diisi dari scan OCR (${result.model}). ${result.notes}`.slice(0, 2000));
  }
  function changeAnswer(index, key, value) { setAnswers((current) => current.map((answer, i) => i === index ? { ...answer, [key]: value } : answer)); }
  function submittedAnswers() { return answers.map((answer) => ({ ...answer, points: answer.points === '' || answer.points === null || answer.points === undefined ? null : Number(answer.points) })); }
  let preview;
  let previewError = '';
  if (exam) { try { preview = rules.scoreAnswers(exam, submittedAnswers(), { preview: true }); } catch (failure) { previewError = failure.message; } }
  async function submit(event) {
    event.preventDefault(); setError('');
    let payload;
    try {
      const fields = rules.resultFields({ studentName, studentNumber, notes });
      if (legacy) {
        const score = legacyScore === '' ? NaN : Number(legacyScore);
        if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('Nilai ringkasan harus berupa angka 0–100.');
        payload = { ...fields, score };
      } else {
        if (!exam || fetching || loadError) throw new Error('Pilih dan muat ulangan sebelum menyimpan hasil.');
        rules.scoreAnswers(exam, submittedAnswers());
        payload = { ...fields, assessmentId: exam.id, assessmentVersion: exam.updatedAt, answers: submittedAnswers() };
      }
      if (saved?.updatedAt) payload.expectedUpdatedAt = saved.updatedAt;
    } catch (failure) { setError(failure.message); return; }
    setBusy(true);
    try { await onSave(payload); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="teacher-edit-card manual-grade-editor"><h2>{saved ? 'Edit hasil penilaian' : 'Penilaian baru'}</h2>
    <form onSubmit={submit} noValidate><fieldset disabled={busy}><legend className="manual-grade-sr-only">Jawaban dan nilai siswa</legend><div className="teacher-form-grid">
      <label>Nama siswa<input name="studentName" autoFocus required maxLength={150} value={studentName} onChange={(event) => setStudentName(event.target.value)} /></label>
      <label>No. absen (opsional)<input name="studentNumber" inputMode="numeric" maxLength={10} value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} placeholder="Contoh: 12" /></label>
      {!saved && <label className="field-full">Ulangan<select name="assessmentId" value={assessmentId} disabled={!!prefill} onChange={(event) => { setAssessmentId(event.target.value); setExam(null); setAnswers([]); setLoadError(''); setError(''); }}><option value="">Pilih ulangan</option>{assessments.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.subject} · {item.grade}</option>)}</select></label>}
      {legacy ? <><p className="field-full manual-grade-note">Ringkasan lama tidak memiliki jawaban per soal. Nama, nilai ringkasan, dan catatan dapat diedit; rincian benar/salah lama tidak dihitung ulang.</p><label>Nilai ringkasan (0–100)<input name="legacyScore" type="number" min="0" max="100" step="0.01" value={legacyScore} onChange={(event) => setLegacyScore(event.target.value)} /></label></> : <p className="field-full manual-grade-note">Setiap soal bernilai maksimal 10 poin. Pilihan ganda dihitung otomatis. Isian singkat dan essay dinilai guru pada rentang 0–10. Nilai akhir = total poin ÷ poin maksimal × 100.</p>}
    </div>
    {!saved && assessmentId && <div className="manual-grade-refresh"><small>Mengganti atau memuat ulang ulangan mengosongkan jawaban yang belum disimpan.</small><button className="teacher-button" type="button" disabled={fetching} onClick={() => setRevision((current) => current + 1)}>Muat ulang soal</button></div>}
    {fetching && <p role="status">Memuat soal dan kunci jawaban…</p>}{loadError && <p role="alert">{loadError}</p>}
    {exam && !legacy && !saved && !prefill && <OcrScanner assessmentId={exam.id} disabled={busy || fetching} onResult={applyOcr} />}{prefill && ocr && <p className="ai-notice">Diisi dari scan OCR batch. Bandingkan dengan foto di atas, perbaiki bila perlu, lalu simpan.</p>}
    {exam && !legacy && <><h3>{exam.title}</h3><p className="section-label">{exam.subject} · {exam.grade}</p><div className="manual-grade-question-list">{exam.questions.map((question, index) => { const answer = answers[index]; const scanned = ocr?.meta?.[question.id]; return <article className={`manual-grade-question ${scanned ? `ocr-confidence--${scanned.confidence}` : ''}`} key={question.id}><h3>Soal {index + 1} · {question.type}</h3>{scanned && <p className={`ocr-flag ocr-flag--${scanned.confidence}`}><Icon name={scanned.confidence === 'rendah' ? 'warning' : 'scan'} size={13} />Hasil OCR · keyakinan {scanned.confidence}{scanned.reason ? ` — ${scanned.reason}` : ''}{question.type !== 'Pilihan Ganda' ? ' · nilai adalah usulan AI' : ''}</p>}<p className="manual-grade-prose">{question.text}</p><p className="manual-grade-key">Kunci / acuan: {responseText(question, question.correct)}</p><div className="teacher-form-grid"><label className="field-full">Jawaban siswa{question.type === 'Pilihan Ganda' ? <select name="response" value={answer.response} onChange={(event) => changeAnswer(index, 'response', event.target.value)}><option value="">Tidak dijawab</option>{question.options.map((option, i) => <option key={i} value={String.fromCharCode(65 + i)}>{String.fromCharCode(65 + i)}. {option}</option>)}</select> : <textarea name="response" maxLength={10000} rows={3} value={answer.response} onChange={(event) => changeAnswer(index, 'response', event.target.value)} />}</label>
      {question.type === 'Pilihan Ganda' ? <p className="manual-grade-auto" aria-live="polite">Poin otomatis: {answer.response === question.correct ? 10 : 0} / 10</p> : <label>Nilai soal (0–10)<input name="points" type="number" min="0" max="10" step="0.01" required value={answer.points ?? ''} onChange={(event) => changeAnswer(index, 'points', event.target.value)} /></label>}
      <label className="field-full">Catatan guru (opsional)<textarea name="feedback" maxLength={2000} rows={2} value={answer.feedback || ''} onChange={(event) => changeAnswer(index, 'feedback', event.target.value)} /></label></div></article>; })}</div>
      <div className="manual-grade-preview" aria-live="polite">{previewError ? <p>{previewError}</p> : preview?.pending ? <p>Menunggu penilaian guru untuk {preview.pending} soal.</p> : preview && <GradeSummary result={preview} />}</div></>}
    <label className="manual-grade-notes">Catatan hasil (opsional)<textarea name="notes" rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </fieldset>{error && <p className="manual-grade-error" role="alert">{error}</p>}<div className="manual-grade-actions"><button className="teacher-button teacher-button--dark" type="submit" disabled={busy || fetching || (!legacy && !exam)}>{busy ? 'Menyimpan…' : 'Simpan hasil'}</button><button className="teacher-button" type="button" disabled={busy} onClick={onCancel}>Batal</button></div></form>
  </section>;
}
