import { notFound } from 'next/navigation';
import { requirePageUser } from '../../../../../../lib/page-auth';
import store from '../../../../../../lib/store';
import printing from '../../../../../../lib/assessment-print';
import AssessmentPrint from '../../../../../../components/assessment-print';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { kind } = await params;
  return { title: kind === 'kunci' ? 'Kunci jawaban — Cetak ulangan' : 'Lembar soal — Cetak ulangan', robots: { index: false, follow: false } };
}

export default async function PrintAssessmentPage({ params }) {
  const { id, kind } = await params;
  const path = `/guru/ulangan/${encodeURIComponent(id)}/cetak/${encodeURIComponent(kind)}`;
  const user = await requirePageUser(path);
  if (!['soal', 'kunci'].includes(kind)) notFound();
  const assessment = await store.get('assessments', id, user);
  if (!assessment) notFound();
  const meta = await store.getSiteMeta();
  return <AssessmentPrint document={printing.printDocument(assessment, meta, kind)} />;
}
