import { notFound } from 'next/navigation';
import { requirePageUser } from '../../../../../lib/page-auth';
import store from '../../../../../lib/store';
import printing from '../../../../../lib/record-print';
import MaterialPrint from '../../../../../components/material-print';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Materi pembelajaran — Cetak', robots: { index: false, follow: false } };

export default async function MaterialPrintPage({ params }) {
  const { id } = await params;
  const user = await requirePageUser(`/guru/materi/${encodeURIComponent(id)}/cetak`);
  const item = await store.get('materials', id, user);
  if (!item) notFound();
  return <MaterialPrint document={printing.materialDocument(item, await store.getSiteMeta())} />;
}
