import PublicProfile from '../components/public-profile';
import store from '../lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" />
    <PublicProfile initialSite={store.getSite()} />
  </>;
}
