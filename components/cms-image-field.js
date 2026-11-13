'use client';

import { useState } from 'react';
import content from '../lib/public-content';

export default function CmsImageField({ label, value = '', onChange, defaultSrc = '' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [failedUrl, setFailedUrl] = useState('');
  const preview = content.safeUrl(value || defaultSrc, true);

  function readImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError('Pilih gambar JPG, PNG, GIF, WebP, atau AVIF dengan ukuran maksimal 4 MB.');
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => { onChange(String(reader.result)); setBusy(false); };
    reader.onerror = () => { setError('Foto tidak dapat dibaca. Coba pilih ulang.'); setBusy(false); };
    reader.readAsDataURL(file);
  }

  return <div className="admin-field--full cms-image-field">
    <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={defaultSrc || 'https://… atau /assets/foto.jpg'} /></label>
    <label>Upload {label.toLowerCase()}<input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" onChange={readImage} disabled={busy} /></label>
    <small>JPG, PNG, GIF, WebP, atau AVIF · maksimal 4 MB.</small>
    {busy && <p role="status">Membaca foto…</p>}{error && <p role="alert">{error}</p>}
    {preview && failedUrl !== preview && <img className="admin-upload-preview" src={preview} alt={`Preview ${label.toLowerCase()}`} onError={() => setFailedUrl(preview)} />}
    {preview && failedUrl === preview && <p>Gambar belum dapat ditampilkan.</p>}
    {value && <button className="admin-button admin-button--quiet" type="button" onClick={() => { onChange(''); setError(''); }}>{defaultSrc ? 'Gunakan gambar bawaan' : 'Hapus foto'}</button>}
  </div>;
}
