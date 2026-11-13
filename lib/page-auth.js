import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import auth from './auth';

export async function pageUser() {
  const cookieStore = await cookies();
  return auth.userFromToken(cookieStore.get(auth.COOKIE_NAME)?.value);
}

export async function requirePageUser(path, roles = ['admin', 'guru']) {
  const user = await pageUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!roles.includes(user.role)) redirect('/guru');
  return user;
}
