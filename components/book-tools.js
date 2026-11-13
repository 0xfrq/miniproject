'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui-icon';
import './teacher-ai.css';

const GRADES = [1, 2, 3, 4, 5, 6];

export async function apiRequest(url, options = {}) {
  let response;
  try { response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options }); }
  catch { throw new Error('Koneksi terputus. Coba lagi.'); }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 401 ? 'Sesi berakhir. Silakan masuk kembali.' : data?.error || 'Permintaan belum berhasil. Coba lagi.');
  return data;
}

export function gradeNumber(value) {
  const match = /(\d)/.exec(String(value || ''));
  const grade = match ? Number(match[1]) : NaN;
  return grade >= 1 && grade <= 6 ? grade : '';
}

export function BookStatus({ book }) {
  const status = book?.index?.status;
  if (status === 'ready') return <span className="teacher-badge book-status book-status--ready"><Icon name="check" size={11} /> Siap untuk AI</span>;
  if (status === 'indexing') return <span className="teacher-badge teacher-badge--yellow book-status">Menyiapkan {book.index.progress || 0}%</span>;
  if (status === 'failed') return <span className="teacher-badge book-status book-status--failed" title={book.index.error}>Gagal disiapkan</span>;
  return <span className="teacher-badge teacher-badge--soft book-status">Belum disiapkan</span>;
}

// Memantau buku yang sedang diindeks dan memperbarui statusnya.
export function useBookPolling(books, onUpdate) {
  const update = useRef(onUpdate); update.current = onUpdate;
  const pending = books.filter((book) => book.index?.status === 'indexing').map((book) => book.id).join(',');
  useEffect(() => {
    if (!pending) return undefined;
    let active = true;
    const timer = setInterval(async () => {
      for (const id of pending.split(',')) {
        try { const book = await apiRequest(`/api/books/${encodeURIComponent(id)}`); if (active) update.current(book); } catch {}
      }
    }, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [pending]);
}

export async function prepareBook(id) {
  return apiRequest(`/api/books/${encodeURIComponent(id)}/index`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
}

function BookCover({ book }) {
  const [failed, setFailed] = useState(false);
  return <div className="book-cover" aria-hidden="true">{book.coverUrl && !failed ? <img src={book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <Icon name="book" size={26} />}</div>;
}

export function BookActions({ book, onPrepare, busy }) {
  return <div className="book-actions">
    <a className="teacher-button teacher-button--quiet" href={`${book.pdfUrl}?download=1`}><Icon name="upload" size={14} className="icon-flip" />Unduh PDF</a>
    <a className="teacher-button teacher-button--quiet" href={book.pdfUrl} target="_blank" rel="noopener noreferrer">Baca ↗</a>
    {book.index?.status !== 'ready' && <button type="button" className="teacher-button" disabled={busy || book.index?.status === 'indexing'} onClick={() => onPrepare(book)}>{book.index?.status === 'indexing' ? 'Menyiapkan…' : book.index?.status === 'failed' ? 'Coba siapkan lagi' : 'Siapkan untuk AI'}</button>}
  </div>;
}

// Search bar katalog SIBI. mode="library" menampilkan aksi unduh/baca; mode="picker" untuk memilih referensi.
export function BookSearch({ mode = 'library', selectedIds = [], onToggle, onAsk, defaultGrade = '', defaultSubject = '', maxSelected = 5, compact = false }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ grade: defaultGrade ? String(defaultGrade) : '', curriculum: '', type: '', subject: defaultSubject || '', indexed: false });
  const [result, setResult] = useState({ items: [], total: 0, subjects: [], catalog: null });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState('');
  const [submitted, setSubmitted] = useState('');
  const limit = compact ? 8 : 24;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (submitted) params.set('q', submitted);
    for (const key of ['grade', 'curriculum', 'type', 'subject']) if (filters[key]) params.set(key, filters[key]);
    if (filters.indexed) params.set('indexed', 'true');
    setLoading(true); setError('');
    fetch(`/api/books?${params}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async (response) => { const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || 'Katalog belum dapat dimuat.'); return data; })
      .then((data) => setResult(data))
      .catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [submitted, filters, offset, limit]);

  function updateBook(book) { setResult((current) => ({ ...current, items: current.items.map((item) => item.id === book.id ? book : item) })); }
  useBookPolling(result.items, updateBook);

  async function prepare(book) {
    setPreparing(book.id); setError('');
    try { updateBook(await prepareBook(book.id)); }
    catch (failure) { setError(failure.message); }
    finally { setPreparing(''); }
  }
  function changeFilter(key, value) { setOffset(0); setFilters((current) => ({ ...current, [key]: value })); }
  function submit(event) { event.preventDefault(); setOffset(0); setSubmitted(query.trim()); }

  return <section className={`book-search ${compact ? 'book-search--compact' : ''}`} aria-label="Cari buku teks SIBI">
    {/* Bukan <form>: komponen ini juga dipakai di dalam form generator (form bersarang tidak valid). */}
    <div className="book-search__bar" role="search">
      <label className="book-search__input"><Icon name="search" size={17} /><span className="ai-sr-only">Kata kunci buku</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit(event); }} placeholder="Cari judul, mapel, tema, atau ISBN — mis. IPAS kelas 4, Tema 3, Matematika" /></label>
      <button className="teacher-button teacher-button--dark" type="button" onClick={submit}>Cari</button>
    </div>
    <div className="book-search__filters">
      <label>Kelas<select value={filters.grade} onChange={(event) => changeFilter('grade', event.target.value)}><option value="">Semua kelas</option>{GRADES.map((grade) => <option key={grade} value={grade}>Kelas {grade}</option>)}</select></label>
      <label>Kurikulum<select value={filters.curriculum} onChange={(event) => changeFilter('curriculum', event.target.value)}><option value="">Semua</option><option value="merdeka">Kurikulum Merdeka</option><option value="k13">Kurikulum 2013</option></select></label>
      <label>Jenis<select value={filters.type} onChange={(event) => changeFilter('type', event.target.value)}><option value="">Semua</option><option value="siswa">Buku Siswa</option><option value="guru">Buku Guru</option></select></label>
      <label>Mapel<select value={filters.subject} onChange={(event) => changeFilter('subject', event.target.value)}><option value="">Semua mapel</option>{result.subjects.map((item) => <option key={item.subject} value={item.subject}>{item.subject} ({item.count})</option>)}{filters.subject && !result.subjects.some((item) => item.subject === filters.subject) && <option value={filters.subject}>{filters.subject}</option>}</select></label>
      <label className="book-search__check"><input type="checkbox" checked={filters.indexed} onChange={(event) => changeFilter('indexed', event.target.checked)} />Hanya yang siap AI</label>
    </div>
    <p className="book-search__meta" aria-live="polite">{loading ? 'Memuat katalog…' : `${result.total} buku ditemukan${result.catalog ? ` · ${result.catalog.ready} dari ${result.catalog.total} buku SD siap untuk AI` : ''}`}</p>
    {error && <p className="ai-error" role="alert">{error}</p>}
    <div className="book-results">{result.items.map((book) => {
      const selected = selectedIds.includes(book.id);
      return <article className={`book-card ${selected ? 'is-selected' : ''}`} key={book.id}>
        <BookCover book={book} />
        <div className="book-card__body">
          <span className="section-label">{book.gradeLabel} · {book.bookTypeLabel} · {book.curriculumLabel}</span>
          <h3>{book.title}</h3>
          <p>{book.subject}{book.writer ? ` · ${book.writer.slice(0, 90)}${book.writer.length > 90 ? '…' : ''}` : ''}</p>
          <div className="book-card__status"><BookStatus book={book} />{book.index?.status === 'indexing' && <span className="book-progress"><span style={{ width: `${book.index.progress || 0}%` }} /></span>}{book.index?.status === 'failed' && <small className="book-error">{book.index.error}</small>}</div>
          {mode === 'library'
            ? <div className="book-card__actions"><BookActions book={book} onPrepare={prepare} busy={preparing === book.id} />{onAsk && <button type="button" className="teacher-button teacher-button--dark" onClick={() => onAsk(book)}><Icon name="spark" size={14} />Tanya asisten</button>}</div>
            : <div className="book-card__actions"><button type="button" className={`teacher-button ${selected ? 'teacher-button--dark' : ''}`} aria-pressed={selected} disabled={!selected && selectedIds.length >= maxSelected} onClick={() => onToggle?.(book)}>{selected ? <><Icon name="check" size={14} />Dipilih</> : 'Pilih buku'}</button><a className="teacher-button teacher-button--quiet" href={book.pdfUrl} target="_blank" rel="noopener noreferrer">Lihat PDF ↗</a></div>}
        </div>
      </article>;
    })}</div>
    {!loading && !result.items.length && !error && <p className="book-empty">Tidak ada buku yang cocok. Coba kata kunci lain atau hapus filter.</p>}
    {result.total > limit && <div className="book-pager"><button type="button" className="teacher-button" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>← Sebelumnya</button><span>{offset + 1}–{Math.min(result.total, offset + limit)} dari {result.total}</span><button type="button" className="teacher-button" disabled={offset + limit >= result.total || loading} onClick={() => setOffset(offset + limit)}>Berikutnya →</button></div>}
  </section>;
}

// Daftar buku referensi terpilih + tombol menyiapkan buku untuk AI (indexing).
export function BookPicker({ books, onChange, max = 5, defaultGrade = '', defaultSubject = '', title = 'Buku referensi (SIBI Kemendikdasmen)', hint }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(books); current.current = books;
  function update(book) { onChange(current.current.map((item) => item.id === book.id ? book : item)); }
  useBookPolling(books, update);
  async function prepare(book) {
    setError('');
    try { update(await prepareBook(book.id)); } catch (failure) { setError(failure.message); }
  }
  function toggle(book) {
    const exists = books.some((item) => item.id === book.id);
    const next = exists ? books.filter((item) => item.id !== book.id) : [...books, book].slice(0, max);
    onChange(next);
    if (!exists && book.index?.status !== 'ready' && book.index?.status !== 'indexing') prepareBook(book.id).then((fresh) => onChange([...next.filter((item) => item.id !== fresh.id), fresh])).catch((failure) => setError(failure.message));
  }
  const pending = books.filter((book) => book.index?.status !== 'ready');
  return <section className="book-picker">
    <div className="book-picker__head"><div><span className="section-label">Opsional · RAG</span><h3>{title}</h3><p>{hint || 'AI akan menjawab berdasarkan isi buku yang dipilih dan mencantumkan halaman sumbernya.'}</p></div><button type="button" className="teacher-button" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Tutup pencarian' : <><Icon name="search" size={14} />Cari buku</>}</button></div>
    {books.length > 0 && <ul className="book-chips">{books.map((book) => <li key={book.id} className={`book-chip book-chip--${book.index?.status || 'none'}`}>
      <div><strong>{book.title}</strong><small>{book.gradeLabel} · {book.bookTypeLabel}</small></div>
      <BookStatus book={book} />{book.index?.status === 'indexing' && <span className="book-progress"><span style={{ width: `${book.index.progress || 0}%` }} /></span>}
      {(book.index?.status === 'none' || book.index?.status === 'failed') && <button type="button" className="teacher-button" onClick={() => prepare(book)}>{book.index?.status === 'failed' ? 'Coba lagi' : 'Siapkan'}</button>}
      <button type="button" className="book-chip__remove" aria-label={`Hapus ${book.title}`} onClick={() => toggle(book)}><Icon name="close" size={14} /></button>
      {book.index?.status === 'failed' && <small className="book-error">{book.index.error}</small>}
    </li>)}</ul>}
    {pending.length > 0 && <p className="book-picker__note">Buku sedang disiapkan: PDF diunduh, teks dibaca, lalu dibuat indeks pencarian. Biasanya 2–6 menit per buku karena mengikuti kuota gratis. Halaman boleh ditinggal; prosesnya tetap berjalan.</p>}
    {error && <p className="ai-error" role="alert">{error}</p>}
    {open && <BookSearch mode="picker" compact selectedIds={books.map((book) => book.id)} onToggle={toggle} defaultGrade={defaultGrade} defaultSubject={defaultSubject} maxSelected={max} />}
  </section>;
}
