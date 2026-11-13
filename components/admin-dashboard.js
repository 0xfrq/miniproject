'use client';

import { useEffect, useState } from 'react';
import { Icon } from './ui-icon';
import TeacherAccounts from './teacher-accounts';
import LogoutButton from './logout-button';
import { ProfileEditor, CollectionEditor } from './cms-editors';

const emptySite = { meta: {}, values: [], activities: [], posts: [], agenda: [] };
const collections = [
  { key: 'activities', label: 'Galeri', singular: 'foto galeri', fields: [['title', 'Judul'], ['description', 'Deskripsi'], ['label', 'Label'], ['imageUrl', 'URL foto'], ['imageLabel', 'Teks alternatif foto']] },
  { key: 'posts', label: 'Informasi & blog', singular: 'informasi', fields: [['title', 'Judul'], ['excerpt', 'Ringkasan'], ['content', 'Isi berita'], ['category', 'Kategori'], ['date', 'Tanggal'], ['imageUrl', 'URL foto'], ['imageLabel', 'Teks alternatif foto']] },
  { key: 'agenda', label: 'Agenda', singular: 'agenda', fields: [['title', 'Judul acara'], ['description', 'Deskripsi'], ['date', 'Tanggal'], ['time', 'Waktu']] },
];

function Placeholder({ label = 'IMAGE · PLACEHOLDER', imageUrl = '' }) { return <div className="admin-image-placeholder" style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><span>{label}</span></div>; }
function Shell({ active, children, onNavigate, user, userLoading, siteName, saving }) {
  const links = [['overview', 'Ikhtisar', 'home'], ['profile', 'Profil sekolah', 'edit'], ['activities', 'Galeri', 'activity'], ['posts', 'Informasi & blog', 'posts'], ['agenda', 'Agenda', 'calendar'], ['teachers', 'Akun guru', 'book']];
  const displayName = user?.name || user?.fullName || user?.nama || '';
  const initials = displayName ? displayName.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() : 'AD';
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/" aria-label="Kembali ke beranda SDN Bangah">
        <span className="admin-brand__logo"><img src="/assets/logo-sekolah.png" alt="Logo SDN Bangah" onError={(event) => { event.currentTarget.style.display = 'none'; }} /></span>
        <span><strong>SDN Bangah</strong><small>WORKSPACE ADMIN</small></span>
      </a>
      <div className="admin-context"><span>B</span><div><strong>{siteName || 'SDN Bangah'}</strong><small>Pengelolaan konten sekolah</small></div></div>
      <nav aria-label="Navigasi admin"><div>{links.map(([key, label, icon]) => <button type="button" key={key} className={active === key ? 'is-active' : ''} onClick={() => onNavigate(key)}><i aria-hidden="true"><Icon name={icon} size={17} /></i><span>{label}</span></button>)}</div></nav>
      <div className="admin-sidebar__bottom"><p>Perubahan konten disimpan melalui API sekolah.</p><a href="/"><Icon name="arrow" size={13} /> Lihat profil publik</a></div>
    </aside>
    <main className="admin-main"><header className="admin-topbar"><div><span className="admin-mobile-label">SDN Bangah</span><span className="admin-breadcrumb">Admin / <strong>{links.find(([key]) => key === active)?.[1]}</strong></span></div><div className="admin-topbar__actions"><span className="save-indicator">{saving ? 'Menyimpan perubahan…' : 'Konten terhubung ke API'}</span><span className="admin-user-name">{userLoading ? 'Memuat profil…' : (displayName || 'Profil admin belum terhubung')}</span><span className="admin-avatar" title={displayName || 'Admin'}>{initials}</span><LogoutButton className="admin-button admin-button--quiet" /></div></header>{children}</main>
  </div>;
}

export default function AdminDashboard() {
  const [site, setSite] = useState(emptySite);
  const [dashboard, setDashboard] = useState(null);
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [contentLoading, setContentLoading] = useState(true);
  const [contentError, setContentError] = useState('');
  const [active, setActive] = useState('overview');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function requestJson(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Permintaan ${url} gagal (HTTP ${response.status}).`);
    return data;
  }

  async function reloadDashboard() {
    setDashboardLoading(true);
    setDashboardError('');
    try { setDashboard(await requestJson('/api/dashboard')); }
    catch (error) { setDashboard(null); setDashboardError(error.message); }
    finally { setDashboardLoading(false); }
  }

  async function reloadSite() {
    const data = await requestJson('/api/site');
    setSite({ ...emptySite, ...data, meta: data.meta || {} });
  }

  useEffect(() => {
    let disposed = false;
    const load = async (url, success, failure) => {
      try {
        const data = await requestJson(url);
        if (!disposed) success(data);
      } catch (error) { if (!disposed) failure(error); }
    };
    load('/api/site', (data) => { setSite({ ...emptySite, ...data, meta: data.meta || {} }); setContentLoading(false); }, (error) => { setContentError(error.message); setContentLoading(false); });
    load('/api/dashboard', (data) => { setDashboard(data); setDashboardLoading(false); }, (error) => { setDashboardError(error.message); setDashboardLoading(false); });
    // /api/me nantinya harus menggunakan sesi login yang diverifikasi backend.
    load('/api/me', (data) => { setUser(data?.user || data?.profile || null); setUserLoading(false); }, () => { setUser(null); setUserLoading(false); });
    return () => { disposed = true; };
  }, []);

  function updateMeta(key, value) { setSite((current) => ({ ...current, meta: { ...current.meta, [key]: value } })); }

  async function mutate(task, successText) {
    setSaving(true);
    setNotice('');
    try {
      await task();
      await Promise.all([reloadSite(), reloadDashboard()]);
      setContentError('');
      setNotice(successText);
      return true;
    } catch (error) {
      setNotice(`Gagal menyimpan: ${error.message}`);
      return false;
    } finally { setSaving(false); }
  }

  async function saveSite() {
    return mutate(() => requestJson('/api/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meta: site.meta, values: site.values }) }), 'Profil sekolah berhasil disimpan.');
  }
  async function saveCollection(key, item) {
    return mutate(() => requestJson(`/api/${key}/${encodeURIComponent(item.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }), 'Perubahan berhasil disimpan.');
  }
  async function deleteCollection(key, id) {
    if (!window.confirm('Hapus item ini dari konten publik?')) return false;
    return mutate(() => requestJson(`/api/${key}/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Item berhasil dihapus.');
  }
  async function createCollection(key, payload) {
    return mutate(() => requestJson(`/api/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), 'Konten disimpan dan tampil di halaman publik.');
  }

  return <Shell active={active} onNavigate={setActive} user={user} userLoading={userLoading} siteName={site.meta?.schoolName} saving={saving}>
    {notice && <div className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Tutup pesan">×</button></div>}
    {contentError && <div className="admin-notice" role="alert">Data konten belum dapat dimuat: {contentError}</div>}
    {active === 'overview' && <Overview dashboard={dashboard} dashboardLoading={dashboardLoading} dashboardError={dashboardError} user={user} userLoading={userLoading} onNavigate={setActive} />}
    {active === 'teachers' && <TeacherAccounts />}
    {active === 'profile' && (contentLoading ? <div className="admin-page">Memuat profil sekolah…</div> : contentError ? <div className="admin-page">Profil belum tersedia.</div> : <ProfileEditor site={site} updateMeta={updateMeta} saveSite={saveSite} />)}
    {['activities', 'posts', 'agenda'].includes(active) && (contentLoading ? <div className="admin-page">Memuat konten…</div> : contentError ? <div className="admin-page">Konten belum tersedia.</div> : <CollectionEditor key={active} collection={collections.find((item) => item.key === active)} items={site[active] || []} saveCollection={saveCollection} deleteCollection={deleteCollection} createCollection={createCollection} />)}
  </Shell>;
}

function Overview({ dashboard, dashboardLoading, dashboardError, user, userLoading, onNavigate }) { return <div className="admin-page"><header className="admin-page__header"><div><p className="eyebrow">Admin editor · SDN Bangah</p><h1>Konten sekolah, tetap dalam kendali.</h1><p>Kelola profil publik, berita, kegiatan, dan agenda dari satu workspace sederhana.</p></div><a className="admin-button admin-button--dark" href="/">Lihat profil publik <Icon name="arrow" size={14} /></a></header><section className="admin-welcome"><div><span className="section-label">Ringkasan pengelolaan sekolah</span><h2>{userLoading ? "Memuat profil admin…" : user?.name || user?.fullName || user?.nama ? `Selamat datang, ${user.name || user.fullName || user.nama}.` : "Selamat datang di Dashboard Admin."}</h2><p>Periksa konten yang tampil ke masyarakat, lalu perbarui bagian yang perlu.</p></div><Placeholder label="IMAGE · ADMIN MOMENT" /></section>{dashboardError && <p className="admin-api-warning" role="alert">Statistik belum dapat dimuat: {dashboardError}</p>}<div className="admin-stat-grid"><Stat label="Total kegiatan" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.activities ?? "—")} tone="green" /><Stat label="Berita tersimpan" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.posts ?? "—")} tone="yellow" /><Stat label="Total agenda" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.agenda ?? "—")} tone="coral" /><Stat label="Materi tersimpan" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.materials ?? "—")} tone="blue" /></div><div className="admin-overview-grid"><section className="admin-panel"><div className="admin-panel__head"><div><span className="section-label">Shortcut editor</span><h2>Mulai dari bagian yang ingin diubah.</h2></div></div><div className="admin-shortcuts"><button onClick={() => onNavigate('profile')}><strong>Edit profil</strong><small>Judul, deskripsi, kontak, placeholder</small><b>↗</b></button><button onClick={() => onNavigate('activities')}><strong>Atur kegiatan</strong><small>Kelola foto dan dokumentasi kegiatan</small><b>↗</b></button><button onClick={() => onNavigate('posts')}><strong>Tulis catatan</strong><small>Berita dan cerita dari sekolah</small><b>↗</b></button></div></section><section className="admin-panel"><div className="admin-panel__head"><div><span className="section-label">Perlu perhatian</span><h2>Status konten</h2></div></div><ul className="admin-check-list"><li><span>✓</span><div><strong>Profil sekolah melalui API</strong><small>Data ditampilkan dari API `/api/site`.</small></div></li><li><span>✓</span><div><strong>Aset gambar sekolah</strong><small>Foto tersimpan bersama konten dan ditampilkan di halaman publik.</small></div></li><li><span>—</span><div><strong>API identitas admin</strong><small>Nama akun dan hak akses diperiksa melalui sesi login.</small></div></li></ul></section></div></div>; }
function Stat({ label, value, tone }) { return <div className={`admin-stat admin-stat--${tone}`}><span>{label}</span><strong>{value}</strong><small>data dari backend</small></div>; }
