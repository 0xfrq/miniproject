'use client';

import { useEffect, useState } from 'react';
import { Icon } from './ui-icon';

const empty = { name: '', email: '', password: '', className: '', academicYear: '' };

export default function TeacherAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  async function request(url, options) {
    const response = await fetch(url, options);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Permintaan gagal.');
    return body;
  }
  async function reload() { setAccounts(await request('/api/admin/users')); }
  useEffect(() => {
    reload().catch((error) => setNotice(error.message)).finally(() => setLoading(false));
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true); setNotice('');
    try {
      const payload = { ...draft };
      if (editing && !payload.password) delete payload.password;
      await request(`/api/admin/users${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      await reload();
      setDraft(empty); setEditing(null);
      setNotice(editing ? 'Akun guru diperbarui.' : 'Akun guru dibuat. Sampaikan kredensial kepada guru tersebut.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function toggle(account) {
    setBusy(true); setNotice('');
    try {
      await request(`/api/admin/users/${account.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !account.active }) });
      await reload(); setNotice(account.active ? 'Akun dinonaktifkan dan seluruh sesinya diakhiri.' : 'Akun diaktifkan.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  function edit(account) {
    setEditing(account.id);
    setDraft({ name: account.name, email: account.email, className: account.className, academicYear: account.academicYear, password: '' });
    setNotice('');
  }

  return <div className="admin-page">
    <header className="admin-page__header"><div><p className="eyebrow">Pengelolaan akses</p><h1>Akun guru.</h1><p>Buat akun, atur kelas, dan kelola akses workspace guru.</p></div></header>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <section className="admin-panel admin-form-panel">
      <div className="admin-panel__head"><h2>{editing ? 'Edit akun guru' : 'Tambah akun guru'}</h2></div>
      <form onSubmit={save}>
        <div className="admin-form-grid">
          <label>Nama lengkap<input required value={draft.name} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoComplete="name" /></label>
          <label>Email<input required type="email" value={draft.email} maxLength={254} onChange={(event) => setDraft({ ...draft, email: event.target.value })} autoComplete="email" /></label>
          <label>{editing ? 'Kata sandi baru (kosongkan bila tetap)' : 'Kata sandi awal'}<input required={!editing} type="password" minLength={12} maxLength={128} value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} autoComplete="new-password" /></label>
          <label>Kelas<input value={draft.className} maxLength={120} onChange={(event) => setDraft({ ...draft, className: event.target.value })} placeholder="Contoh: Kelas 5A" /></label>
          <label>Tahun ajaran<input value={draft.academicYear} maxLength={120} onChange={(event) => setDraft({ ...draft, academicYear: event.target.value })} placeholder="2026/2027" /></label>
        </div>
        <div className="admin-form-actions"><button className="admin-button admin-button--dark" type="submit" disabled={busy}><Icon name="check" size={15} />{busy ? 'Menyimpan…' : 'Simpan akun'}</button>{editing && <button type="button" className="admin-button admin-button--quiet" onClick={() => { setEditing(null); setDraft(empty); }}>Batal</button>}</div>
      </form>
    </section>
    <section className="admin-collection-list" aria-label="Daftar akun guru">
      {loading ? <p>Memuat akun…</p> : accounts.length ? accounts.map((account) => <article className="admin-content-row" key={account.id}>
        <div className="admin-content-row__body"><h2>{account.name}</h2><p>{account.email} · {account.className || 'Kelas belum ditentukan'} · {account.active ? 'Aktif' : 'Nonaktif'}</p></div>
        <div className="admin-content-row__actions"><button type="button" className="admin-button admin-button--quiet" disabled={busy} onClick={() => edit(account)}>Edit / reset kata sandi</button><button type="button" className="admin-delete" disabled={busy} onClick={() => toggle(account)}>{account.active ? 'Nonaktifkan' : 'Aktifkan'}</button></div>
      </article>) : <p>Belum ada akun guru.</p>}
    </section>
  </div>;
}
