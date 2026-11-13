'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui-icon';
import rules from '../lib/assessments';
import './teacher-assessments.css';
import AssessmentGenerator from './assessment-generator';

const blank = { title: '', subject: '', grade: '', duration: '30', status: 'Draft' };
const letter = (index) => String.fromCharCode(65 + index);
function newQuestion() { return { _key: crypto.randomUUID(), type: 'Pilihan Ganda', text: '', options: ['', '', '', ''], correct: '', explanation: '' }; }
function Status({ value }) { return <span className={`teacher-badge ${value === 'Siap digunakan' ? 'exam-ready' : 'teacher-badge--soft'}`}>{value || 'Draft'}</span>; }
function answerText(question) {
  const answer = question.correct || question.answer || '';
  if (question.type !== 'Pilihan Ganda') return answer || 'Belum diisi';
  const key = rules.answerLetter(answer, question.options || []);
  return key ? `${key}. ${rules.optionText(question.options[key.charCodeAt(0) - 65], key.charCodeAt(0) - 65)}` : answer || 'Belum diisi';
}

export default function TeacherAssessments({ assessments, questions, loading, loadError, onRetry, onSave, onDelete }) {
  const [mode, setMode] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(null);
  const confirmHeading = useRef(null);
  useEffect(() => { if (deleting) confirmHeading.current?.focus(); }, [deleting]);
  const selected = assessments.find((item) => item.id === selectedId);
  const selectedQuestions = rules.orderedQuestions(questions, selectedId);
  function open(next, id = null) { setMode(next); setSelectedId(id); setDeleting(null); setError(''); if (next !== 'create') setGenerated(null); }
  async function save(payload) { const item = await onSave(mode === 'edit' ? selectedId : null, payload); setSelectedId(item.id); setMode('questions'); }
  async function remove() {
    setBusy(true); setError('');
    try { await onDelete(deleting.id); open('list'); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <div className="teacher-page exams-page">
    <header className="teacher-page-header"><div><p className="eyebrow">Workspace Guru · asesmen</p><h1>Ulangan harian.</h1><p>Susun soal, periksa kunci jawaban, lalu simpan saat siap digunakan.</p></div>{mode === 'list' && <div className="exam-actions"><button type="button" className="teacher-button" disabled={loading || !!loadError} onClick={() => open('generate')}><Icon name="spark" size={15} />Buat dengan AI</button><button type="button" className="teacher-button teacher-button--dark" disabled={loading || !!loadError} onClick={() => open('create')}><Icon name="plus" size={15} />Tambah ulangan</button></div>}</header>
    {loading ? <p role="status">Memuat ulangan dan soal…</p> : loadError ? <section className="teacher-panel"><p role="alert">{loadError}</p><button className="teacher-button" type="button" onClick={onRetry}>Coba lagi</button></section> : <>
      {mode === 'generate' ? <AssessmentGenerator onCancel={() => open('list')} onDone={(draft) => { setGenerated(draft); setMode('create'); }} />
        : mode === 'create' || mode === 'edit' ? <>{mode === 'create' && generated && <p className="exam-generator__banner"><Icon name="spark" size={15} />Draf dari AI: periksa setiap soal, kunci, dan pembahasan sebelum mengubah status menjadi Siap digunakan.</p>}<AssessmentForm key={`${mode}-${selectedId || 'new'}-${generated ? 'ai' : 'manual'}`} item={mode === 'edit' ? selected : generated?.item || blank} questions={mode === 'edit' ? selectedQuestions : generated?.questions || []} onSave={save} onCancel={() => open(mode === 'edit' ? 'questions' : 'list', selectedId)} /></>
        : (mode === 'questions' || mode === 'answers') && selected ? <>
          <section className="teacher-panel exam-detail">
            <div className="exam-actions"><button type="button" className="teacher-button" disabled={busy} onClick={() => open('list')}>← Daftar ulangan</button><Status value={selected.status} /></div>
            <p className="section-label">{selected.subject} · {selected.grade}</p><h2>{selected.title}</h2><p>{selectedQuestions.length} soal · {selected.duration}</p>
            <div className="exam-actions"><button type="button" className="teacher-button teacher-button--dark" disabled={busy} onClick={() => open('edit', selected.id)}>Edit ulangan</button><button type="button" className="teacher-button exam-delete" disabled={busy} onClick={() => { setError(''); setDeleting(selected); }}>Hapus ulangan</button></div>
            <div className="exam-tabs" aria-label="Tampilan ulangan"><button type="button" className="teacher-button" aria-pressed={mode === 'questions'} disabled={busy} onClick={() => setMode('questions')}>Lembar soal</button><button type="button" className="teacher-button" aria-pressed={mode === 'answers'} disabled={busy} onClick={() => setMode('answers')}>Kunci jawaban</button></div>
            {selectedQuestions.length > 0 ? <div className="exam-actions exam-print-actions"><a className="teacher-button" href={`/guru/ulangan/${encodeURIComponent(selected.id)}/cetak/soal`} target="_blank" rel="noopener noreferrer">Cetak lembar soal ↗</a><a className="teacher-button" href={`/guru/ulangan/${encodeURIComponent(selected.id)}/cetak/kunci`} target="_blank" rel="noopener noreferrer">Cetak kunci jawaban ↗</a><p>Cetak memakai data terakhir yang disimpan. Kedua dokumen dibuka secara terpisah.</p></div> : <p className="exam-print-hint">Tambahkan dan simpan minimal satu soal untuk mencetak ulangan.</p>}
          </section>
          {mode === 'questions' ? <section className="teacher-panel exam-sheet" aria-label="Lembar soal"><h2>Lembar soal</h2><p>Soal tanpa kunci jawaban dan pembahasan.</p>{selectedQuestions.length ? <ol className="exam-question-list">{selectedQuestions.map((question) => <li key={question.id}><div className="exam-question-text">{question.text}</div>{question.type === 'Pilihan Ganda' && <ol type="A" className="exam-options">{question.options?.map((option, index) => <li key={index}>{rules.optionText(option, index)}</li>)}</ol>}{question.type !== 'Pilihan Ganda' && <p className="exam-answer-space">Jawaban: ................................................................</p>}</li>)}</ol> : <p>Belum ada soal. Klik Edit ulangan untuk menambahkan soal.</p>}</section>
            : <section className="teacher-panel exam-answer-key" aria-label="Kunci jawaban"><div className="exam-actions"><h2>Kunci jawaban</h2><span className="teacher-badge teacher-badge--yellow">Dokumen guru</span></div><p>Periksa kunci dan pembahasan sebelum ulangan digunakan.</p>{selectedQuestions.length ? <ol className="exam-question-list">{selectedQuestions.map((question) => <li key={question.id}><p className="exam-question-text">{question.text}</p><strong className="exam-answer">{answerText(question)}</strong><p className="exam-explanation">{question.explanation || 'Pembahasan belum ditambahkan.'}</p></li>)}</ol> : <p>Belum ada kunci jawaban.</p>}</section>}
        </> : <>
          <div className="teacher-list exam-list">{assessments.length ? assessments.map((item) => <article className="teacher-content-card" key={item.id}>
            <div className="teacher-content-card__icon"><Icon name="clipboard" size={22} /></div><div className="exam-card-copy"><span className="section-label">{item.subject} · {item.grade}</span><h2>{item.title}</h2><p>{rules.orderedQuestions(questions, item.id).length} soal · {item.duration}</p></div><div className="teacher-content-card__actions"><Status value={item.status} /><div className="exam-actions"><button className="teacher-button" type="button" disabled={busy} onClick={() => open('questions', item.id)}>Buka</button><button className="teacher-button" type="button" disabled={busy} onClick={() => open('edit', item.id)}>Edit</button><button className="teacher-button exam-delete" type="button" disabled={busy} onClick={() => { setError(''); setDeleting(item); }}>Hapus</button></div></div>
          </article>) : <section className="teacher-panel exam-empty"><Icon name="clipboard" size={30} /><h2>Belum ada ulangan.</h2><p>Klik Tambah ulangan untuk menyusun ulangan pertama Anda.</p></section>}</div>
        </>}
      {deleting && <section className="teacher-panel exam-confirm" aria-labelledby="exam-delete-title"><h2 id="exam-delete-title" ref={confirmHeading} tabIndex={-1}>Hapus ulangan?</h2><p>Ulangan “{deleting.title}” dan seluruh soalnya akan dihapus permanen. Ulangan yang memiliki hasil penilaian tetap disimpan.</p>{error && <p role="alert">{error}</p>}<div className="exam-actions"><button type="button" className="teacher-button" disabled={busy} onClick={() => { setDeleting(null); setError(''); }}>Batal</button><button type="button" className="teacher-button exam-delete" disabled={busy} onClick={remove}>{busy ? 'Menghapus…' : 'Ya, hapus ulangan'}</button></div></section>}
    </>}
  </div>;
}

function AssessmentForm({ item, questions, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => ({ ...blank, ...item, duration: String(rules.minutes(item?.duration) || ''), questions: questions.map((question) => ({ ...question, _key: question.id, options: question.options?.map(rules.optionText) || [], correct: question.type === 'Pilihan Ganda' ? rules.answerLetter(question.correct || question.answer, question.options || []) || '' : question.correct || question.answer || '' })) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  function changeQuestion(index, changes) { setDraft((current) => ({ ...current, questions: current.questions.map((question, i) => i === index ? { ...question, ...changes } : question) })); }
  function move(index, delta) { setDraft((current) => { const next = [...current.questions]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return { ...current, questions: next }; }); }
  function removeOption(question, qIndex, index) {
    const chosen = question.correct?.charCodeAt(0) - 65;
    changeQuestion(qIndex, { options: question.options.filter((_, i) => i !== index), correct: chosen === index ? '' : chosen > index ? letter(chosen - 1) : question.correct });
  }
  async function submit(event) {
    event.preventDefault(); setError('');
    let payload;
    try {
      const normalized = rules.normalizeAssessment(draft, draft.questions);
      payload = { ...normalized.assessment, ...(item?.id ? { expectedUpdatedAt: item.updatedAt } : {}), questions: draft.questions.map(({ _key, ...question }, index) => ({ ...question, ...normalized.questions[index] })) };
    } catch (failure) { setError(failure.message); return; }
    setBusy(true);
    try { await onSave(payload); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="teacher-edit-card exam-editor"><h2>{item?.id ? 'Edit ulangan' : 'Ulangan baru'}</h2><p>Perubahan soal disimpan bersama ulangan saat Anda memilih Simpan ulangan.</p>
    <form onSubmit={submit} noValidate><fieldset disabled={busy}><legend className="exam-sr-only">Informasi ulangan dan daftar soal</legend><div className="teacher-form-grid">
      {[['title', 'Judul ulangan', 200], ['subject', 'Mata pelajaran', 100], ['grade', 'Kelas', 100]].map(([key, label, max]) => <label key={key} className={key === 'title' ? 'field-full' : ''}>{label}<input name={key} autoFocus={key === 'title'} required maxLength={max} value={draft[key] || ''} onChange={(event) => change(key, event.target.value)} /></label>)}
      <label>Durasi (menit)<input type="number" name="duration" min="1" max="600" required value={draft.duration} onChange={(event) => change('duration', event.target.value)} /></label><label>Status<select name="status" value={draft.status} onChange={(event) => change('status', event.target.value)}>{rules.statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div><div className="exam-question-heading"><h3>Daftar soal ({draft.questions.length})</h3><p>Draft dapat disimpan tanpa soal atau kunci. Status Siap digunakan memerlukan minimal satu soal dan semua kunci terisi.</p></div>
    <div className="exam-question-editors">{draft.questions.map((question, index) => <article className="exam-question-editor" key={question._key}>
      <div className="exam-question-header"><h3>Soal {index + 1}</h3><div className="exam-actions"><button type="button" className="teacher-button" aria-label={`Naikkan soal ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" className="teacher-button" aria-label={`Turunkan soal ${index + 1}`} disabled={index === draft.questions.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" className="teacher-button exam-delete" onClick={() => change('questions', draft.questions.filter((_, i) => i !== index))}>Hapus soal</button></div></div>
      <div className="teacher-form-grid"><label>Jenis soal<select name="type" value={question.type} onChange={(event) => changeQuestion(index, { type: event.target.value, options: event.target.value === 'Pilihan Ganda' ? ['', '', '', ''] : [], correct: '', answer: '' })}>{rules.types.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="field-full">Pertanyaan<textarea name="text" required rows={3} maxLength={10000} value={question.text} onChange={(event) => changeQuestion(index, { text: event.target.value })} /></label>
        {question.type === 'Pilihan Ganda' && <div className="field-full exam-option-editor">{question.options.map((option, i) => <div className="exam-option-row" key={i}><label>Pilihan {letter(i)}<input name={`option-${i}`} maxLength={2000} value={option} onChange={(event) => changeQuestion(index, { options: question.options.map((value, n) => n === i ? event.target.value : value) })} /></label><button type="button" className="teacher-button" aria-label={`Hapus pilihan ${letter(i)} soal ${index + 1}`} disabled={question.options.length <= 2} onClick={() => removeOption(question, index, i)}>Hapus</button></div>)}<button type="button" className="teacher-button" disabled={question.options.length >= 6} onClick={() => changeQuestion(index, { options: [...question.options, ''] })}>Tambah pilihan</button></div>}
        <label className="field-full">Kunci jawaban{question.type === 'Pilihan Ganda' ? <select name="correct" value={question.correct} onChange={(event) => changeQuestion(index, { correct: event.target.value })}><option value="">Belum diisi</option>{question.options.map((option, i) => <option key={i} value={letter(i)}>{letter(i)}. {option || 'Pilihan belum diisi'}</option>)}</select> : <textarea name="correct" maxLength={10000} rows={2} value={question.correct} onChange={(event) => changeQuestion(index, { correct: event.target.value })} />}</label>
        <label className="field-full">Pembahasan (opsional)<textarea name="explanation" maxLength={10000} rows={3} value={question.explanation || ''} onChange={(event) => changeQuestion(index, { explanation: event.target.value })} /></label>
      </div>
    </article>)}</div><button type="button" className="teacher-button" disabled={draft.questions.length >= rules.maxQuestions} onClick={() => change('questions', [...draft.questions, newQuestion()])}><Icon name="plus" size={15} />Tambah soal</button>
    </fieldset>{error && <p className="exam-error" role="alert">{error}</p>}<div className="exam-actions exam-save-actions"><button className="teacher-button teacher-button--dark" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan ulangan'}</button><button className="teacher-button" type="button" disabled={busy} onClick={onCancel}>Batal</button></div></form>
  </section>;
}
