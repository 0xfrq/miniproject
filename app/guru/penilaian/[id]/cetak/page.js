import { notFound } from 'next/navigation';
import { requirePageUser } from '../../../../../lib/page-auth';
import store from '../../../../../lib/store';
import printing from '../../../../../lib/record-print';
import GradingPrint from '../../../../../components/grading-print';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Laporan hasil penilaian — Cetak', robots: { index: false, follow: false } };

export default async function GradingPrintPage({ params }) {
  const { id } = await params;
  const user = await requirePageUser(`/guru/penilaian/${encodeURIComponent(id)}/cetak`);
  const item = await store.get('grading', id, user);
  if (!item) notFound();
  const detailed = item.schemaVersion === 1 && !!item.assessmentSnapshot;
  const assessment = !detailed && item.assessmentId ? await store.get('assessments', item.assessmentId, user) : null;
  return <GradingPrint document={printing.gradingDocument(item, assessment, await store.getSiteMeta())} />;
}
