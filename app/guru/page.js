import TeacherWorkspace from '../../components/teacher-workspace';
import { requirePageUser } from '../../lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function GuruPage() {
  await requirePageUser('/guru');
  return <TeacherWorkspace />;
}
