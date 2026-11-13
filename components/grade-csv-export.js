'use client';

import { useState } from 'react';

export default function GradeCsvExport({ assessments, grading }) {
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const selected = assessments.find((item) => item.id === id);
  const count = grading.filter((item) => item.assessmentId === id).length;
  async function download(event) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/assessments/${encodeURIComponent(id)}/grades.csv`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(response.status === 401 ? 'Sesi berakhir. Silakan masuk kembali.' : data?.error || 'CSV belum dapat diunduh. Coba lagi.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'nilai-ulangan.csv';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`CSV siap diunduh (${response.headers.get('X-Export-Row-Count') || 0} hasil).`);
    } catch (failure) { setError(failure instanceof TypeError ? 'Koneksi terputus. Coba unduh CSV lagi.' : failure.message); }
    finally { setBusy(false); }
  }
  return <section className="teacher-panel grade-csv-export"><h2>Ekspor nilai ke CSV</h2><p>Pilih ulangan untuk mengunduh nilai tersimpan. Format UTF-8 dengan pemisah titik koma dan desimal koma cocok untuk Excel berbahasa Indonesia.</p>
    <form onSubmit={download}><label>Ulangan untuk ekspor<select name="csvAssessmentId" value={id} disabled={busy} onChange={(event) => { setId(event.target.value); setError(''); setMessage(''); }}><option value="">Pilih ulangan</option>{assessments.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.grade}</option>)}</select></label><button className="teacher-button" type="submit" disabled={busy || !selected}>{busy ? 'Menyiapkan CSV…' : 'Unduh CSV'}</button></form>
    {selected && <p>{count} hasil pada daftar saat ini.{!count && ' Jika belum ada nilai tersimpan, CSV hanya berisi judul kolom.'}</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
