import AdminDashboard from '../../components/admin-dashboard';
import { requirePageUser } from '../../lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requirePageUser('/admin', ['admin']);
  return <AdminDashboard />;
}
