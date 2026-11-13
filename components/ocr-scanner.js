'use client';

import { useEffect, useState } from 'react';
import { Icon } from './ui-icon';
import { apiRequest } from './book-tools';
import limits from '../lib/request-limits';
import './teacher-ai.css';

const MAX_SIDE = 1600;
const MAX_FILES = 8;

// Foto diperkecil di browser (maks. 1600 px, JPEG) agar cepat dikirim; tulisan tetap terbaca jelas.
export async function toDataUrl(file) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} bukan berkas gambar.`);
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error(`${file.name} tidak dapat dibaca. Gunakan foto JPG atau PNG.`); }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.8);
}

export default function OcrScanner({ assessmentId, disabled, onResult }) {
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { setImages([]); setError(''); setStatus(''); }, [assessmentId]);

  async function addFiles(fileList) {
    const files = [...fileList].slice(0, MAX_FILES - images.length);
    if (!files.length) return;
    setPreparing(true); setError('');
    try {
      const prepared = [];
      for (const file of files) prepared.push({ name: file.name, url: await toDataUrl(file) });
      setImages((current) => [...current, ...prepared].slice(0, MAX_FILES));
    } catch (failure) { setError(failure.message); }
    finally { setPreparing(false); }
  }

  async function read() {
    if (!images.length) return setError('Tambahkan foto lembar jawaban terlebih dahulu.');
    setBusy(true); setError(''); setStatus('');
    try {
      const body = limits.ocrRequestBody(assessmentId, images.map((image) => image.url));
      const result = await apiRequest('/api/ai/ocr-grading', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      onResult(result);
      const low = result.answers.filter((answer) => answer.confidence === 'rendah').length;
      setStatus(`Terbaca dalam ${Math.round((result.durationMs || 0) / 1000)} detik dan sudah diisikan ke form (nama, no. absen, jawaban).${low ? ` ${low} soal ditandai perlu dicek karena tulisan kurang jelas.` : ''} Periksa sebelum menyimpan.`);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return <section className="ocr-scanner" aria-label="Scan lembar jawaban dengan OCR">
    <div className="ocr-scanner__head"><span><Icon name="scan" size={20} /></span><div><strong>Scan lembar jawaban (OCR)</strong><p>Foto jawaban satu siswa (boleh beberapa halaman). AI membaca nama, no. absen, dan tulisan tangan, mencocokkannya dengan nomor soal, menilai pilihan ganda, dan mengusulkan nilai isian/essay.</p></div></div>
    <div className="ocr-scanner__inputs">
      <label className={`teacher-button ${disabled || busy || images.length >= MAX_FILES ? 'is-disabled' : ''}`}><Icon name="camera" size={15} />Ambil foto<input type="file" accept="image/*" capture="environment" disabled={disabled || busy || images.length >= MAX_FILES} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} /></label>
      <label className={`teacher-button ${disabled || busy || images.length >= MAX_FILES ? 'is-disabled' : ''}`}><Icon name="upload" size={15} />Unggah foto<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || busy || images.length >= MAX_FILES} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} /></label>
      <button type="button" className="teacher-button teacher-button--dark" disabled={disabled || busy || preparing || !images.length} onClick={read}>{busy ? 'AI sedang membaca…' : <>Baca jawaban dengan AI <Icon name="spark" size={14} /></>}</button>
    </div>
    {preparing && <p role="status">Menyiapkan foto…</p>}
    {images.length > 0 && <ul className="ocr-thumbs">{images.map((image, index) => <li key={`${image.name}-${index}`}><img src={image.url} alt={`Halaman ${index + 1}: ${image.name}`} /><span>Hal. {index + 1}</span><button type="button" disabled={busy} aria-label={`Hapus foto ${index + 1}`} onClick={() => setImages((current) => current.filter((_, i) => i !== index))}><Icon name="close" size={13} /></button></li>)}</ul>}
    <small className="ocr-scanner__privacy">Tips: foto tegak lurus, terang, satu halaman per foto. Foto dikirim ke Gemini (provider AI di .env) untuk dibaca dan tidak disimpan di server sekolah.</small>
    {status && <p className="ai-notice" role="status">{status}</p>}
    {error && <p className="ai-error" role="alert">{error}</p>}
  </section>;
}
