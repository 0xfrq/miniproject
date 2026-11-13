'use client';

import './assessment-print.css';

export default function AssessmentPrint({ document: doc }) {
  const key = doc.kind === 'kunci';
  return <main className="assessment-print">
    <nav className="assessment-print-toolbar" aria-label="Kontrol cetak"><a href="/guru">← Workspace guru</a><div><p>{key ? 'Kunci jawaban dan pembahasan untuk guru.' : 'Lembar soal dengan ruang jawaban siswa.'}</p><p>Pilih Cetak, lalu printer atau Save as PDF. Gunakan kertas A4 dan skala 100%; nonaktifkan header/footer browser jika diperlukan.</p></div><button type="button" disabled={!doc.questions.length} onClick={() => window.print()}>Cetak / Simpan PDF</button></nav>
    {!doc.questions.length && <p className="assessment-print-empty" role="status">Belum ada soal untuk dicetak. Tambahkan dan simpan soal di menu Ulangan.</p>}
    <article className={`assessment-print-paper${key ? ' assessment-print-key' : ''}`} aria-label={key ? 'Dokumen kunci jawaban' : 'Dokumen lembar soal'}>
      <header className="assessment-print-header"><p className="assessment-print-school">{doc.schoolName}</p>{doc.address && <p className="assessment-print-address">{doc.address}</p>}<h1>{key ? 'KUNCI JAWABAN & PEMBAHASAN' : 'LEMBAR ULANGAN'}</h1><h2>{doc.title}</h2>{doc.draft && <p className="assessment-print-draft">DRAFT — UNTUK DITINJAU</p>}<dl><dt>Mata pelajaran</dt><dd>{doc.subject || 'Belum diisi'}</dd><dt>Kelas</dt><dd>{doc.grade || 'Belum diisi'}</dd><dt>Durasi</dt><dd>{doc.duration || 'Belum diisi'}</dd><dt>Jumlah soal</dt><dd>{doc.questions.length}</dd></dl></header>
      {key ? <p className="assessment-print-instructions">Dokumen guru. Nomor kunci mengikuti urutan soal pada lembar ulangan.</p> : <><div className="assessment-print-identity"><p>Nama: <span /></p><p>Kelas: <span /></p><p>Tanggal: <span /></p></div><p className="assessment-print-instructions">Bacalah setiap soal dengan teliti. Pilih satu jawaban untuk pilihan ganda dan tuliskan jawaban pada ruang yang tersedia.</p></>}
      <ol className="assessment-print-questions">{doc.questions.map((question) => <li key={question.number}>
        <p className="assessment-print-type">{question.type}</p><div className="assessment-print-text">{question.text}</div>
        {key ? <div className="assessment-print-solution"><p className="assessment-print-answer"><strong>Kunci / acuan jawaban:</strong> {question.answer}</p><p className="assessment-print-explanation"><strong>Pembahasan:</strong> {question.explanation}</p></div>
          : <>{question.type === 'Pilihan Ganda' && <ol type="A" className="assessment-print-options">{question.options.map((option, index) => <li key={index}>{option}</li>)}</ol>}
            {question.type === 'Pilihan Ganda' ? <p className="assessment-print-mc-space">Jawaban: __________</p> : <div className="assessment-print-answer-lines" aria-label={`Ruang jawaban soal ${question.number}`}>{Array.from({ length: question.type === 'Essay' ? 6 : 2 }, (_, index) => <div key={index} />)}</div>}
          </>}
      </li>)}</ol>
    </article>
  </main>;
}
