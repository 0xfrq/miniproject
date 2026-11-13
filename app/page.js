import PublicProfile from '../components/public-profile';
import store from '../lib/store';
import content from '../lib/public-content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  return <>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" />
    <PublicProfile initialSite={process.env.DATABASE_URL ? await store.getSite() : null} initialMonth={content.today().slice(0, 7)} />
  </>;
}
