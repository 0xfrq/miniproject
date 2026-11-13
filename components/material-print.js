'use client';

import RecordPrintFrame, { RecordPrintHeader } from './record-print-frame';

export default function MaterialPrint({ document: doc }) {
  return <RecordPrintFrame label="Materi pembelajaran tersimpan." enabled={!!doc.content.trim()}>
    <RecordPrintHeader document={doc} label="MATERI PEMBELAJARAN" rows={[["Mata pelajaran", doc.subject], ['Kelas', doc.grade], ['Diperbarui', doc.updatedAt]]} />
    {doc.summary && <section className="record-print-section"><h3>Ringkasan</h3><div className="record-print-prose">{doc.summary}</div></section>}
    <section className="record-print-section material-print-content"><h3>Isi materi</h3><div className="record-print-prose">{doc.content || 'Isi materi belum ditambahkan.'}</div></section>
  </RecordPrintFrame>;
}
