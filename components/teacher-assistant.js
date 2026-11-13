'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui-icon';
import MarkdownLite from './markdown-lite';
import { BookPicker, BookSearch, apiRequest } from './book-tools';
import './teacher-ai.css';

const PROMPTS = [
  'Buatkan ringkasan materi bab ini untuk siswa, lengkap dengan contoh sehari-hari.',
  'Susun modul ajar 2 × 35 menit: tujuan, kegiatan pembuka, inti, penutup, dan asesmen.',
  'Buatkan 10 soal pilihan ganda dan 3 soal essay beserta kunci jawaban dan pembahasannya.',
  'Bagaimana cara menjelaskan konsep ini kepada siswa yang masih kesulitan?',
  'Buatkan rubrik penilaian proyek untuk materi ini.',
];

function timeText(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date);
}

function SourceList({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  const cited = sources.filter((source) => source.cited);
  const shown = open ? sources : (cited.length ? cited : sources.slice(0, 3));
  return <div className="ai-sources"><span className="section-label">Sumber dari buku</span><ol>{shown.map((source) => <li key={`${source.bookId}-${source.n}`} value={source.n}>
    <a href={source.url} target="_blank" rel="noopener noreferrer"><strong>{source.title}</strong> · hal. {source.pageStart}{source.pageEnd !== source.pageStart ? `–${source.pageEnd}` : ''} ↗</a>
    <small>{source.excerpt}…</small></li>)}</ol>
    {sources.length > shown.length && <button type="button" className="ai-link-button" onClick={() => setOpen(true)}>Tampilkan semua {sources.length} kutipan</button>}</div>;
}

export function BookLibrary({ onAsk }) {
  return <div className="teacher-page book-library-page">
    <header className="teacher-page-header"><div><p className="eyebrow">Workspace Guru · perpustakaan</p><h1>Buku teks SIBI.</h1><p>Seluruh buku teks SD kelas 1–6 (Kurikulum Merdeka & K13) dari platform resmi Kemendikdasmen. Unduh PDF-nya, atau siapkan untuk asisten AI agar materi dan soal disusun dari isi buku.</p></div></header>
    <BookSearch mode="library" onAsk={onAsk} />
  </div>;
}

export default function TeacherAssistant({ initialBooks = [], onSaveMaterial, onConsumeInitial }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [books, setBooks] = useState(initialBooks);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef(null);
  const consumed = useRef(onConsumeInitial); consumed.current = onConsumeInitial;

  useEffect(() => { apiRequest('/api/ai/conversations').then(setConversations).catch(() => {}); }, []);
  useEffect(() => {
    if (!initialBooks.length) return;
    setActiveId(null); setMessages([]); setBooks(initialBooks); consumed.current?.();
  }, [initialBooks]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);

  async function openConversation(id) {
    setLoadingConversation(true); setError(''); setShowHistory(false);
    try { const data = await apiRequest(`/api/ai/conversations/${id}`); setActiveId(id); setMessages(data.messages); setBooks(data.books); }
    catch (failure) { setError(failure.message); }
    finally { setLoadingConversation(false); }
  }
  function newConversation() { setActiveId(null); setMessages([]); setError(''); setShowHistory(false); }
  async function removeConversation(id) {
    try { await apiRequest(`/api/ai/conversations/${id}`, { method: 'DELETE' }); setConversations((items) => items.filter((item) => item.id !== id)); if (id === activeId) newConversation(); }
    catch (failure) { setError(failure.message); }
  }

  async function send(text) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setError(''); setNotice(''); setSending(true); setInput('');
    const optimistic = { id: `local-${Date.now()}`, role: 'user', content: message };
    setMessages((items) => [...items, optimistic]);
    try {
      const data = await apiRequest('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: activeId, message, bookIds: books.map((book) => book.id) }) });
      setActiveId(data.conversation.id);
      setMessages((items) => [...items, data.message]);
      setConversations((items) => [data.conversation, ...items.filter((item) => item.id !== data.conversation.id)]);
    } catch (failure) {
      setError(failure.message); setInput(message);
      setMessages((items) => items.filter((item) => item.id !== optimistic.id));
    } finally { setSending(false); }
  }

  async function saveAsMaterial(message, index) {
    const question = [...messages.slice(0, index)].reverse().find((item) => item.role === 'user')?.content || 'Materi dari asisten AI';
    const book = books[0];
    const sourcesText = message.sources?.filter((source) => source.cited).map((source) => `[${source.n}] ${source.title}, hal. ${source.pageStart}`).join('\n');
    try {
      await onSaveMaterial({
        title: question.replace(/\s+/g, ' ').slice(0, 120), subject: book?.subject || 'Umum', grade: book ? `Kelas ${book.grade} SD` : 'SD',
        summary: message.content.replace(/[#*`|]/g, '').replace(/\s+/g, ' ').slice(0, 300), content: `${message.content}${sourcesText ? `\n\nSumber:\n${sourcesText}` : ''}`,
        status: 'Draft', sources: message.sources?.filter((source) => source.cited) || [],
      });
      setNotice('Disimpan ke menu Materi sebagai draft.');
    } catch (failure) { setError(failure.message); }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setNotice('Jawaban disalin.'); } catch { setError('Tidak dapat menyalin otomatis. Blok teks lalu salin manual.'); }
  }

  const readyCount = books.filter((book) => book.index?.status === 'ready').length;
  return <div className="teacher-page assistant-page">
    <header className="teacher-page-header assistant-header"><div><p className="eyebrow">Workspace Guru · asisten AI</p><h1>Asisten guru.</h1><p>Tanyakan apa saja tentang pembelajaran. Pilih buku SIBI sebagai referensi agar jawaban berdasarkan isi buku dan menyertakan halaman sumber.</p></div>
      <div className="assistant-header__actions"><button type="button" className="teacher-button" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}><Icon name="clock" size={14} />Riwayat ({conversations.length})</button><button type="button" className="teacher-button teacher-button--dark" onClick={newConversation}><Icon name="plus" size={14} />Percakapan baru</button></div></header>
    {showHistory && <section className="teacher-panel assistant-history"><h2>Riwayat percakapan</h2>{conversations.length ? <ul>{conversations.map((item) => <li key={item.id} className={item.id === activeId ? 'is-active' : ''}><button type="button" onClick={() => openConversation(item.id)}><strong>{item.title}</strong><small>{timeText(item.updatedAt)}</small></button><button type="button" className="ai-link-button" aria-label={`Hapus percakapan ${item.title}`} onClick={() => removeConversation(item.id)}>Hapus</button></li>)}</ul> : <p>Belum ada percakapan.</p>}</section>}
    <BookPicker books={books} onChange={setBooks} max={5} />
    <section className="assistant-chat" aria-label="Percakapan dengan asisten">
      <div className="assistant-messages" aria-live="polite">
        {loadingConversation && <p role="status">Memuat percakapan…</p>}
        {!messages.length && !loadingConversation && <div className="assistant-empty"><Icon name="spark" size={30} /><h2>Mulai dari pertanyaan.</h2><p>{readyCount ? `${readyCount} buku siap dipakai sebagai referensi.` : 'Belum ada buku referensi yang siap. Asisten akan menjawab dari pengetahuan umum.'}</p><div className="assistant-prompts">{PROMPTS.map((prompt) => <button type="button" key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}</div></div>}
        {messages.map((message, index) => <article key={message.id} className={`assistant-message assistant-message--${message.role}`}>
          <span className="assistant-message__who">{message.role === 'user' ? 'Anda' : 'Asisten'}</span>
          {message.role === 'user' ? <p className="assistant-message__text">{message.content}</p> : <>
            <MarkdownLite text={message.content} sources={message.sources} />
            <SourceList sources={message.sources} />
            <div className="assistant-message__actions"><button type="button" className="teacher-button teacher-button--quiet" onClick={() => copy(message.content)}>Salin</button>{onSaveMaterial && <button type="button" className="teacher-button teacher-button--quiet" onClick={() => saveAsMaterial(message, index)}><Icon name="book" size={14} />Simpan sebagai materi</button>}</div>
          </>}
        </article>)}
        {sending && <article className="assistant-message assistant-message--assistant is-thinking"><span className="assistant-message__who">Asisten</span><p>{readyCount ? 'Membaca buku referensi dan menyusun jawaban…' : 'Menyusun jawaban…'}</p></article>}
        <div ref={endRef} />
      </div>
      {notice && <p className="ai-notice" role="status">{notice}</p>}
      {error && <p className="ai-error" role="alert">{error}</p>}
      <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <label className="ai-sr-only" htmlFor="assistant-input">Pertanyaan untuk asisten</label>
        <textarea id="assistant-input" rows={3} maxLength={6000} value={input} placeholder="Contoh: Buatkan materi tentang perubahan wujud benda untuk kelas 4 beserta aktivitas kelompok." onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
        <div><small>Enter untuk kirim · Shift+Enter baris baru. Periksa kembali hasil AI sebelum dipakai di kelas.</small><button type="submit" className="teacher-button teacher-button--dark" disabled={sending || !input.trim()}>{sending ? 'Menyusun…' : <>Kirim <Icon name="arrow" size={14} /></>}</button></div>
      </form>
    </section>
  </div>;
}
