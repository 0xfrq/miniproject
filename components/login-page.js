'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './ui-icon';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState('guru');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setNotice('Isi email dan kata sandi terlebih dahulu.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, role }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login gagal.');
      const requested = new URLSearchParams(window.location.search).get('next') || '';
      const path = requested.split('#')[0];
      const allowed = ['/guru', '/ai-learning-generator.html', ...(data.user.role === 'admin' ? ['/admin'] : [])];
      router.replace(allowed.includes(path) ? requested : data.redirectTo);
      router.refresh();
    } catch (error) { setNotice(error.message || 'Tidak dapat menghubungi server.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="sdn-login">
      <div className="sdn-login__left">
        <a href="/" className="sdn-login__brand"><img className="sdn-login__logo" src="/assets/logo-sekolah.png" alt="Logo SDN Bangah" /><span><strong>SDN Bangah</strong><small>Sekolah Dasar Negeri</small></span></a>
        <div className="sdn-login__hero"><span className="sdn-overline">PORTAL SEKOLAH</span><h1>Satu ruang untuk mendukung pendidikan yang lebih baik.</h1><p>Kelola pembelajaran dan informasi sekolah dari workspace yang tertata, sederhana, dan mudah digunakan.</p><div className="sdn-login__quote"><span>✦</span><span>Belajar, bertumbuh, dan berprestasi bersama.</span></div></div>
        <div className="sdn-login__foot">SDN Bangah No. 383 · Gedangan, Sidoarjo</div>
      </div>
      <main className="sdn-login__right">
        <div className="sdn-login__card">
          <span className="sdn-overline">SELAMAT DATANG KEMBALI</span>
          <h2>Masuk ke portal sekolah.</h2>
          <p className="sdn-login__intro">Pilih workspace sesuai peran untuk melanjutkan.</p>
          <div className="sdn-login__roles" role="group" aria-label="Pilih peran">
            <button type="button" aria-pressed={role === 'guru'} className={role === 'guru' ? 'is-active' : ''} onClick={() => { setRole('guru'); setNotice(''); }}><Icon name="book" size={19} /><span><strong>Guru</strong><small>Materi dan penilaian</small></span></button>
            <button type="button" aria-pressed={role === 'admin'} className={role === 'admin' ? 'is-active' : ''} onClick={() => { setRole('admin'); setNotice(''); }}><Icon name="edit" size={19} /><span><strong>Admin</strong><small>Konten sekolah</small></span></button>
          </div>
          <form onSubmit={submit} className="sdn-login__form">
            <label htmlFor="sdn-email">Email</label>
            <input id="sdn-email" type="email" required autoComplete="username" placeholder="nama@sekolah.sch.id" value={email} onChange={e => setEmail(e.target.value)} />
            <label htmlFor="sdn-password">Kata sandi</label>
            <div className="sdn-login__password"><input id="sdn-password" type={visible ? 'text' : 'password'} required autoComplete="current-password" placeholder="Masukkan kata sandi" value={password} onChange={e => setPassword(e.target.value)}/><button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{visible ? 'Sembunyikan' : 'Lihat'}</button></div>
            <button className="sdn-login__submit" type="submit" disabled={busy}>{busy ? 'Memeriksa akun…' : `Masuk ke ${role === 'guru' ? 'Workspace Guru' : 'Admin Editor'}`} <Icon name="arrow" size={17} /></button>
          </form>
          {notice && <p role="status" className="sdn-login__notice">{notice}</p>}
          <div className="sdn-login__demo"><span>Akun guru dibuat oleh administrator sekolah.</span></div>
          <p className="sdn-login__back"><a href="/">← Kembali ke beranda</a></p>
        </div>
      </main>
    </div>
  );
}
