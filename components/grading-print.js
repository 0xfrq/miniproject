'use client';

import RecordPrintFrame, { RecordPrintHeader } from './record-print-frame';

export default function GradingPrint({ document: doc }) {
  return <RecordPrintFrame label="Laporan hasil penilaian individual tersimpan.">
    <RecordPrintHeader document={doc} label="LAPORAN HASIL PENILAIAN" rows={[["Nama siswa", doc.studentName], ...(doc.studentNumber ? [['No. absen', doc.studentNumber]] : []),['Mata pelajaran', doc.subject], ['Kelas', doc.grade], ['Diperbarui', doc.updatedAt], ['Jenis hasil', doc.detailed ? 'Rincian jawaban' : 'Ringkasan lama']]} />
    <section className="record-print-section grading-print-summary"><div><h3>Nilai akhir</h3><p><strong>{doc.score}</strong> / 100</p></div>{doc.detailed && <><div><h3>Total poin</h3><p>{doc.earnedPoints} / {doc.maxPoints}</p></div><div><h3>Rincian soal</h3><p>{doc.correct} penuh · {doc.partial} sebagian · {doc.wrong} nol poin</p><p>{doc.unanswered} tidak dijawab</p></div></>}</section>
    {doc.notes && <section className="record-print-section"><h3>Catatan hasil</h3><div className="record-print-prose">{doc.notes}</div></section>}
    {doc.detailed ? <section className="record-print-section grading-print-details"><h3>Rincian jawaban dan penilaian</h3><p className="grading-print-notice">Soal dan acuan jawaban berikut berasal dari salinan yang tersimpan bersama hasil penilaian ini.</p><ol>{doc.questions.map((question) => <li key={question.number} className="grading-print-question"><p className="assessment-print-type">{question.type}</p><div className="record-print-prose">{question.text}</div><dl><dt>Jawaban siswa</dt><dd>{question.response}</dd><dt>Kunci / acuan</dt><dd>{question.reference}</dd><dt>Poin diperoleh</dt><dd>{question.points} / 10</dd></dl>{question.feedback && <p className="record-print-prose"><strong>Catatan guru:</strong> {question.feedback}</p>}{question.explanation && <p className="record-print-prose"><strong>Pembahasan:</strong> {question.explanation}</p>}</li>)}</ol></section>
      : <section className="record-print-section"><h3>Ringkasan lama</h3><p className="record-print-prose">Rincian jawaban per soal tidak tersimpan pada hasil lama ini. Laporan menampilkan nilai ringkasan yang tersimpan.</p></section>}
  </RecordPrintFrame>;
}
