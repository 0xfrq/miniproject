'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui-icon';
import materialRules from '../lib/materials';
import './teacher-materials.css';

const blank = { title: '', subject: '', grade: '', summary: '', content: '', status: 'Draft' };

function updated(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || 'Belum tersedia' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date);
}

function Status({ value }) { return <span className={`teacher-badge ${value === 'Siap digunakan' ? 'material-ready' : 'teacher-badge--soft'}`}>{value || 'Draft'}</span>; }

export default function TeacherMaterials({ materials, loading, loadError, onRetry, onSave, onDelete, renderGenerator }) {
  const [mode, setMode] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deleteHeading = useRef(null);
  useEffect(() => { if (deleting) deleteHeading.current?.focus(); }, [deleting]);
  const selected = materials.find((item) => item.id === selectedId);
  function open(next, id = null) { setError(''); setDeleting(null); setSelectedId(id); setMode(next); }

  async function save(payload) {
    const item = await onSave(mode === 'edit' ? selectedId : null, payload);
    setSelectedId(item.id); setMode('view');
  }

  async function remove() {
    setBusy(true); setError('');
    try { await onDelete(deleting.id); setDeleting(null); setSelectedId(null); setMode('list'); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return <div className="teacher-page materials-page">
    <header className="teacher-page-header"><div><p className="eyebrow">Workspace Guru · materi</p><h1>Materi pembelajaran.</h1><p>Siapkan materi kelas, simpan sebagai draft, lalu tandai saat siap digunakan.</p></div>
      {mode === 'list' && <button type="button" className="teacher-button teacher-button--dark" disabled={loading || !!loadError} onClick={() => open('create')}><Icon name="plus" size={15} />Tambah materi</button>}
    </header>
    {loading ? <p role="status">Memuat materi…</p> : loadError ? <section className="teacher-panel"><p role="alert">{loadError}</p><button className="teacher-button" type="button" onClick={onRetry}>Coba lagi</button></section> : <>
      {mode === 'create' || mode === 'edit' ? <MaterialForm key={`${mode}-${selectedId || 'new'}`} item={mode === 'edit' ? selected : blank} onSave={save} onCancel={() => open(mode === 'edit' ? 'view' : 'list', selectedId)} />
        : mode === 'generator' ? renderGenerator(() => open('list'))
          : mode === 'view' && selected ? <article className="teacher-panel material-detail">
            <div className="material-actions"><button type="button" className="teacher-button teacher-button--quiet" onClick={() => open('list')}>← Daftar materi</button><Status value={selected.status} /></div>
            <p className="section-label">{selected.subject} · {selected.grade}</p><h2>{selected.title}</h2>
            <p className="material-updated">Diperbarui {updated(selected.updatedAt)} WIB</p>
            {selected.summary && <section className="material-summary"><h3>Ringkasan</h3><p>{selected.summary}</p></section>}
            <section><h3>Isi materi</h3><div className="material-lesson">{selected.content || 'Isi materi belum ditambahkan.'}</div></section>
            <div className="material-actions"><button type="button" className="teacher-button teacher-button--dark" disabled={busy} onClick={() => open('edit', selected.id)}>Edit materi</button><button type="button" className="teacher-button material-delete" disabled={busy} onClick={() => { setError(''); setDeleting(selected); }}>Hapus materi</button><a className="teacher-button" href={`/guru/materi/${encodeURIComponent(selected.id)}/cetak`} target="_blank" rel="noopener noreferrer">Cetak materi / PDF ↗</a></div>
          </article> : <>
            {renderGenerator && <div className="manual-ai-banner"><span><Icon name="spark" size={19} /></span><div><strong>Generate materi dengan AI.</strong><p>Periksa hasil generator sebelum menyimpannya sebagai draft.</p><button className="teacher-button teacher-button--quiet" type="button" onClick={() => open('generator')}>Mulai dengan AI <Icon name="spark" size={15} /></button></div></div>}
            <div className="teacher-list">{materials.length ? materials.map((item) => <article className="teacher-content-card" key={item.id}>
              <div className="teacher-content-card__icon"><Icon name="book" size={22} /></div><div className="material-card-copy"><span className="section-label">{item.subject} · {item.grade}</span><h2>{item.title}</h2><p className="material-excerpt">{item.summary || item.content || 'Belum ada ringkasan.'}</p><small>Diperbarui {updated(item.updatedAt)}</small></div>
              <div className="teacher-content-card__actions"><Status value={item.status} /><div className="material-actions"><button className="teacher-button teacher-button--quiet" type="button" disabled={busy} onClick={() => open('view', item.id)}>Lihat</button><button className="teacher-button teacher-button--quiet" type="button" disabled={busy} onClick={() => open('edit', item.id)}>Edit</button><button className="teacher-button material-delete" type="button" disabled={busy} onClick={() => { setError(''); setDeleting(item); }}>Hapus</button></div></div>
            </article>) : <section className="teacher-panel material-empty"><Icon name="book" size={30} /><h2>Belum ada materi.</h2><p>Klik Tambah materi untuk menulis materi pembelajaran pertama Anda.</p></section>}</div>
          </>}
      {deleting && <section className="teacher-panel material-confirm" aria-labelledby="material-delete-title">
        <h2 id="material-delete-title" ref={deleteHeading} tabIndex={-1}>Hapus materi?</h2><p>Materi “{deleting.title}” akan dihapus permanen.</p>{error && <p role="alert">{error}</p>}
        <div className="material-actions"><button className="teacher-button" type="button" disabled={busy} onClick={() => { setDeleting(null); setError(''); }}>Batal</button><button className="teacher-button material-delete" type="button" disabled={busy} onClick={remove}>{busy ? 'Menghapus…' : 'Ya, hapus materi'}</button></div>
      </section>}
    </>}
  </div>;
}

function MaterialForm({ item, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...blank, ...item });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault(); setError('');
    let payload;
    try { payload = materialRules.normalizeMaterial(draft); }
    catch (failure) { setError(failure.message); return; }
    setBusy(true);
    try { await onSave(payload); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="teacher-edit-card material-editor">
    <h2>{item?.id ? 'Edit materi' : 'Materi baru'}</h2><p>Judul, mata pelajaran, kelas, dan isi materi wajib diisi. Ringkasan bersifat opsional.</p>
    <form onSubmit={submit} noValidate>
      <fieldset disabled={busy}><legend className="material-sr-only">Informasi materi pembelajaran</legend><div className="teacher-form-grid">
        {[['title', 'Judul materi', 'Contoh: Sistem Pernapasan Manusia'], ['subject', 'Mata pelajaran', 'Contoh: IPA'], ['grade', 'Kelas', 'Contoh: Kelas 5 SD']].map(([key, label, placeholder]) => <label key={key} className={key === 'title' ? 'field-full' : ''}>{label}<input autoFocus={key === 'title'} name={key} value={draft[key] || ''} required maxLength={materialRules.limits[key]} placeholder={placeholder} onChange={(event) => change(key, event.target.value)} /></label>)}
        <label className="field-full">Ringkasan (opsional)<textarea name="summary" rows={3} maxLength={materialRules.limits.summary} value={draft.summary || ''} onChange={(event) => change('summary', event.target.value)} /></label>
        <label className="field-full">Isi materi<textarea name="content" rows={14} required maxLength={materialRules.limits.content} value={draft.content || ''} onChange={(event) => change('content', event.target.value)} /></label>
        <label>Status<select name="status" value={draft.status} onChange={(event) => change('status', event.target.value)}>{materialRules.statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      </div></fieldset>
      {error && <p className="material-error" role="alert">{error}</p>}
      <div className="material-actions"><button className="teacher-button teacher-button--dark" type="submit" disabled={busy}><Icon name="check" size={15} />{busy ? 'Menyimpan…' : 'Simpan materi'}</button><button className="teacher-button teacher-button--quiet" type="button" disabled={busy} onClick={onCancel}>Batal</button></div>
    </form>
  </section>;
}
