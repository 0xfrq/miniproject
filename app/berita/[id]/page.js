import { notFound } from 'next/navigation';
import PublicProfile from '../../../components/public-profile';
import store from '../../../lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const posts = await store.list('posts');
  const post = posts.find((item) => item.id === id);
  return { title: post ? `${post.title} | Berita sekolah` : 'Berita tidak ditemukan' };
}

export default async function NewsPage({ params }) {
  const { id } = await params;
  const site = await store.getSite();
  if (!site.posts.some((post) => post.id === id)) notFound();
  return <>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" />
    <PublicProfile initialSite={site} articleId={id} />
  </>;
}
