'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton({ className = 'teacher-button teacher-button--quiet' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Gagal keluar. Coba kembali.');
      router.replace('/login');
      router.refresh();
    } catch (problem) { setError(problem.message); setBusy(false); }
  }
  return <><button type="button" className={className} onClick={logout} disabled={busy}>{busy ? 'Keluar…' : 'Keluar'}</button>{error && <span role="alert">{error}</span>}</>;
}
