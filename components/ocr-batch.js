'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui-icon';
import { apiRequest } from './book-tools';
import { toDataUrl } from './ocr-scanner';
import rules from '../lib/grading';
import pages from '../lib/ocr-pages';
import './teacher-ai.css';

const CONCURRENCY = 3;
const MAX_PHOTOS = 80;
const scoreText = (value) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export default function OcrBatch({ assessments, grading, onLoadAssessment, onSaveResult, renderReview, onClose }) {
  const [assessmentId, setAssessmentId] = useState('');
  const [exam, setExam] = useState(null);
  const [loadingExam, setLoadingExam] = useState(false);
  const [rows, setRows] = useState([]);
  const [mergePages, setMergePages] = useState(true);
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewKey, setReviewKey] = useState(null);
  const rowsRef = useRef(rows); rowsRef.current = rows;
  const startedAt = useRef(0);
  const loader = useRef(onLoadAssessment); loader.current = onLoadAssessment;

  useEffect(() => {
    if (!assessmentId) { setExam(null); return undefined; }
    let disposed = false;
    setLoadingExam(true); setError('');
    loader.current(assessmentId).then((item) => { if (!disposed) setExam(rules.snapshot(item)); })
      .catch((failure) => { if (!disposed) setError(failure.message); })
      .finally(() => { if (!disposed) setLoadingExam(false); });
    return () => { disposed = true; };
  }, [assessmentId]);

  function update(key, changes) { setRows((current) => current.map((row) => row.key === key ? { ...row, ...(typeof changes === 'function' ? changes(row) : changes) } : row)); }

  async function addFiles(fileList) {
    const files = [...fileList].sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true })).slice(0, MAX_PHOTOS - rows.length);
    if (!files.length) return;
    setPreparing(true); setError('');
    const added = [];
    for (const file of files) {
      try { added.push({ key: crypto.randomUUID(), name: file.name, url: await toDataUrl(file), status: 'antre' }); }
      catch (failure) { setError(failure.message); }
    }
    setRows((current) => [...current, ...added]);
    setPreparing(false);
  }

  async function readOne(row) {
    update(row.key, { status: 'membaca', error: '' });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await apiRequest('/api/ai/ocr-grading', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assessmentId: exam.id, images: [row.url] }) });
        update(row.key, { status: 'selesai', result });
        return;
      } catch (failure) {
        if (attempt === 0 && /kuota|quota|429|sibuk|demand|batas waktu/i.test(failure.message)) { await new Promise((resolve) => setTimeout(resolve, 15_000)); continue; }
        update(row.key, { status: 'gagal', error: failure.message });
        return;
      }
    }
  }

  async function run(onlyFailed = false) {
    if (!exam) return setError('Pilih ulangan terlebih dahulu.');
    const queue = rowsRef.current.filter((row) => onlyFailed ? row.status === 'gagal' : row.status === 'antre');
    if (!queue.length) return;
    setRunning(true); setError(''); setNotice(''); startedAt.current = Date.now();
    let index = 0;
    const worker = async () => { while (index < queue.length) { const row = queue[index++]; await readOne(row); } };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setRunning(false);
    setNotice(`${queue.length} foto selesai dibaca dalam ${Math.round((Date.now() - startedAt.current) / 1000)} detik. Periksa tabel, lalu simpan.`);
  }

  const students = exam ? pages.groupPages(rows, { mergePages }) : [];
  const existing = grading.filter((item) => item.assessmentId === exam?.id);
  function duplicateOf(student) {
    return existing.find((item) => (student.studentNumber && item.studentNumber && String(item.studentNumber) === String(student.studentNumber)) || (student.studentName && normalizeName(item.studentName) === normalizeName(student.studentName)));
  }
  function answersOf(student) {
    return exam.questions.map((question) => { const read = student.answers.get(question.id); return { questionId: question.id, response: read?.response || '', points: question.type === 'Pilihan Ganda' ? null : read?.points ?? 0, feedback: read?.feedback || '' }; });
  }
  function previewOf(student) { try { return rules.scoreAnswers(exam, answersOf(student)); } catch { return null; } }
  function flagsOf(student) { return exam.questions.filter((question) => (student.answers.get(question.id)?.confidence || 'rendah') === 'rendah').length; }
  function payloadOf(student) {
    return { studentName: student.studentName.trim(), studentNumber: String(student.studentNumber || '').trim(), notes: `Dinilai dari scan OCR batch (${student.model || 'AI'}), ${student.rows.length} halaman.${student.notes ? ` ${student.notes}` : ''}`.slice(0, 2000), assessmentId: exam.id, assessmentVersion: exam.updatedAt, answers: answersOf(student) };
  }
  function markSaved(student, item) { update(student.key, { savedId: item.id, saveError: '' }); }

  async function saveStudent(student) {
    try {
      if (!student.studentName.trim()) throw new Error('Isi nama siswa terlebih dahulu.');
      markSaved(student, await onSaveResult(payloadOf(student)));
    } catch (failure) { update(student.key, { saveError: failure.message }); }
  }
  const ready = students.filter((student) => student.status === 'selesai' && student.studentName.trim() && !flagsOf(student) && !duplicateOf(student));
  async function saveAllReady() {
    setSaving(true); setNotice('');
    for (const student of ready) await saveStudent(student); // berurutan agar tidak bentrok versi ulangan
    setSaving(false); setNotice(`${ready.length} hasil disimpan. Siswa bertanda kuning/merah perlu ditinjau dulu.`);
  }

  const reviewing = students.find((student) => student.key === reviewKey);
  if (reviewing && exam) {
    const result = { assessmentId: exam.id, assessmentVersion: exam.updatedAt, model: reviewing.model, notes: reviewing.notes, answers: exam.questions.map((question) => ({ ...(reviewing.answers.get(question.id) || { response: '', points: question.type === 'Pilihan Ganda' ? null : 0, feedback: '', confidence: 'rendah', reason: 'Tidak ditemukan pada foto.' }), questionId: question.id })) };
    return <div className="ocr-batch-review">
      <div className="ocr-batch-review__photos">{reviewing.rows.map((row, index) => <a key={row.key} href={row.url} target="_blank" rel="noopener noreferrer"><img src={row.url} alt={`Halaman ${index + 1} lembar jawaban ${reviewing.studentName || ''}`} /></a>)}</div>
      {renderReview({ assessmentId: exam.id, studentName: reviewing.studentName, studentNumber: reviewing.studentNumber, notes: payloadOf(reviewing).notes, ocrResult: result },
        (item) => { markSaved(reviewing, item); setReviewKey(null); }, () => setReviewKey(null))}
    </div>;
  }

  const counts = { total: rows.length, done: rows.filter((row) => row.status === 'selesai').length, failed: rows.filter((row) => row.status === 'gagal').length, queued: rows.filter((row) => row.status === 'antre').length };
  return <section className="teacher-panel ocr-batch">
    <div className="ocr-batch__head"><div><span className="section-label">OCR · banyak siswa sekaligus</span><h2>Scan batch lembar jawaban.</h2><p>Unggah foto lembar jawaban seluruh kelas. AI membaca nama, no. absen, dan jawaban tiap foto ({CONCURRENCY} foto sekaligus), lalu Anda meninjau dan menyimpan.</p></div><button type="button" className="teacher-button" onClick={onClose}>← Daftar penilaian</button></div>
    <div className="teacher-form-grid">
      <label className="field-full">Ulangan<select value={assessmentId} disabled={running || rows.some((row) => row.result)} onChange={(event) => setAssessmentId(event.target.value)}><option value="">Pilih ulangan</option>{assessments.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.subject} · {item.grade}</option>)}</select></label>
    </div>
    {loadingExam && <p role="status">Memuat soal dan kunci…</p>}
    {exam && <>
      <div className="ocr-scanner__inputs">
        <label className={`teacher-button ${running || preparing ? 'is-disabled' : ''}`}><Icon name="upload" size={15} />Pilih foto ({rows.length}/{MAX_PHOTOS})<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={running || preparing} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} /></label>
        <label className={`teacher-button ${running || preparing ? 'is-disabled' : ''}`}><Icon name="camera" size={15} />Ambil foto<input type="file" accept="image/*" capture="environment" disabled={running || preparing} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} /></label>
        <button type="button" className="teacher-button teacher-button--dark" disabled={running || preparing || !counts.queued} onClick={() => run(false)}>{running ? `Membaca… ${counts.done + counts.failed}/${counts.total}` : <>Baca {counts.queued} foto dengan AI <Icon name="spark" size={14} /></>}</button>
        {counts.failed > 0 && !running && <button type="button" className="teacher-button" onClick={() => run(true)}>Ulangi {counts.failed} yang gagal</button>}
      </div>
      <label className="book-search__check ocr-batch__merge"><input type="checkbox" checked={mergePages} onChange={(event) => setMergePages(event.target.checked)} />Gabungkan otomatis: foto tanpa nama/no. absen dianggap halaman lanjutan siswa sebelumnya (urut nama file/urutan foto)</label>
      {preparing && <p role="status">Menyiapkan foto…</p>}
      {running && <div className="ocr-batch__progress" aria-hidden="true"><span style={{ width: `${Math.round(((counts.done + counts.failed) / Math.max(1, counts.total)) * 100)}%` }} /></div>}
      {notice && <p className="ai-notice" role="status">{notice}</p>}
      {error && <p className="ai-error" role="alert">{error}</p>}
      {students.length > 0 && <>
        <div className="ocr-batch__summary"><span>{students.length} siswa · {rows.length} foto</span><span>{ready.length} siap disimpan</span><button type="button" className="teacher-button teacher-button--dark" disabled={saving || running || !ready.length} onClick={saveAllReady}>{saving ? 'Menyimpan…' : `Simpan semua yang siap (${ready.length})`}</button></div>
        <div className="ocr-batch__table-wrap"><table className="ocr-batch__table">
          <thead><tr><th>Foto</th><th>No. absen</th><th>Nama siswa</th><th>Nilai</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{students.map((student) => {
            const preview = student.status === 'selesai' || student.status === 'tersimpan' ? previewOf(student) : null;
            const flags = student.status === 'selesai' || student.status === 'tersimpan' ? flagsOf(student) : 0;
            const duplicate = !student.savedId && student.status === 'selesai' ? duplicateOf(student) : null;
            const failed = student.rows.find((row) => row.status === 'gagal');
            const saveError = student.rows[0].saveError;
            return <tr key={student.key} className={student.savedId ? 'is-saved' : flags || duplicate ? 'is-flagged' : ''}>
              <td><div className="ocr-batch__thumbs">{student.rows.map((row, index) => <span key={row.key} className="ocr-batch__thumb"><img src={row.url} alt={`Foto ${row.name}`} />{index > 0 && <button type="button" title="Pisahkan jadi siswa baru" aria-label={`Pisahkan ${row.name} menjadi siswa baru`} onClick={() => update(row.key, { split: true })}>↥</button>}</span>)}</div><small>{student.rows.length > 1 ? `${student.rows.length} halaman` : student.rows[0].name}</small></td>
              <td><input aria-label="No. absen" className="ocr-batch__absen" value={student.studentNumber} maxLength={10} disabled={!!student.savedId} onChange={(event) => update(student.key, { numberEdit: event.target.value })} /></td>
              <td><input aria-label="Nama siswa" value={student.studentName} maxLength={150} placeholder={student.status === 'proses' ? 'Membaca…' : 'Isi nama'} disabled={!!student.savedId} onChange={(event) => update(student.key, { nameEdit: event.target.value })} /></td>
              <td>{preview ? <strong>{scoreText(preview.score)}</strong> : '—'}</td>
              <td>{student.savedId ? <span className="teacher-badge book-status--ready">Tersimpan</span>
                : student.status === 'proses' ? <span className="teacher-badge teacher-badge--yellow">{student.rows.some((row) => row.status === 'membaca') ? 'Membaca…' : 'Antre'}</span>
                : failed ? <span className="teacher-badge book-status--failed" title={failed.error}>Gagal</span>
                : <>{flags > 0 && <span className="ocr-flag ocr-flag--rendah">{flags} soal perlu dicek</span>}{duplicate && <span className="ocr-flag ocr-flag--sedang">Sudah ada nilai: {duplicate.studentName}</span>}{!student.studentName.trim() && <span className="ocr-flag ocr-flag--sedang">Nama belum terbaca</span>}{!flags && !duplicate && student.studentName.trim() && <span className="ocr-flag">Siap</span>}</>}
                {failed && <small className="book-error">{failed.error}</small>}{saveError && <small className="book-error">{saveError}</small>}</td>
              <td><div className="ocr-batch__actions">{!student.savedId && student.status === 'selesai' && <><button type="button" className="teacher-button" onClick={() => setReviewKey(student.key)}>Tinjau</button><button type="button" className="teacher-button teacher-button--quiet" disabled={saving} onClick={() => saveStudent(student)}>Simpan</button></>}{!running && !student.savedId && <button type="button" className="ai-link-button" onClick={() => setRows((current) => current.filter((row) => !student.rows.some((item) => item.key === row.key)))}>Hapus</button>}</div></td>
            </tr>;
          })}</tbody>
        </table></div>
      </>}
      {!rows.length && <p className="book-picker__note">Tips: foto satu halaman per foto, tegak dan terang. Urutkan foto per siswa (halaman 1, 2, …). Nama dan no. absen cukup ditulis di halaman pertama.</p>}
    </>}
  </section>;
}
