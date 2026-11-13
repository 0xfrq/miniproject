'use client';

import './assessment-print.css';
import './record-print.css';

export default function RecordPrintFrame({ label, enabled = true, children }) {
  return <main className="assessment-print record-print">
    <nav className="assessment-print-toolbar" aria-label="Kontrol cetak"><a href="/guru">← Workspace guru</a><div><p>{label}</p><p>Pilih printer atau Save as PDF. Gunakan A4, skala 100%, dan nonaktifkan header/footer browser jika diperlukan.</p></div><button type="button" disabled={!enabled} onClick={() => window.print()}>Cetak / Simpan PDF</button></nav>
    {!enabled && <p className="assessment-print-empty" role="status">Belum ada isi materi untuk dicetak. Tambahkan dan simpan isi materi terlebih dahulu.</p>}
    <article className="assessment-print-paper record-print-paper">{children}</article>
  </main>;
}

export function RecordPrintHeader({ document: doc, label, rows }) {
  return <header className="assessment-print-header"><p className="assessment-print-school">{doc.schoolName}</p>{doc.address && <p className="assessment-print-address">{doc.address}</p>}<h1>{label}</h1><h2>{doc.title}</h2>{doc.draft && <p className="assessment-print-draft">DRAFT — UNTUK DITINJAU</p>}<dl>{rows.map(([label, value]) => <div className="record-print-meta-row" key={label}><dt>{label}</dt><dd>{value || 'Belum diisi'}</dd></div>)}</dl></header>;
}
