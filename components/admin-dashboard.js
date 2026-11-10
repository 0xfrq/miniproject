'use client';

import { useEffect, useState } from 'react';
import { Icon } from './ui-icon';

const emptySite = { meta: {}, values: [], activities: [], posts: [], agenda: [] };
const collections = [
  { key: 'activities', label: 'Kegiatan', singular: 'kegiatan', fields: [['title', 'Judul'], ['description', 'Deskripsi'], ['label', 'Label'], ['imageLabel', 'Tanda placeholder gambar']] },
  { key: 'posts', label: 'Berita & catatan', singular: 'berita', fields: [['title', 'Judul'], ['excerpt', 'Ringkasan'], ['category', 'Kategori'], ['date', 'Tanggal'], ['imageLabel', 'Tanda placeholder gambar']] },
  { key: 'agenda', label: 'Agenda', singular: 'agenda', fields: [['title', 'Judul acara'], ['description', 'Deskripsi'], ['date', 'Tanggal'], ['time', 'Waktu']] },
];

function Placeholder({ label = 'IMAGE · PLACEHOLDER' }) { return <div className="admin-image-placeholder"><span>{label}</span></div>; }
function Shell({ active, children, onNavigate, user, userLoading, siteName, saving }) {
  const links = [['overview', 'Ikhtisar', 'home'], ['profile', 'Profil sekolah', 'edit'], ['activities', 'Kegiatan', 'activity'], ['posts', 'Berita & catatan', 'posts'], ['agenda', 'Agenda', 'calendar']];
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
    <main className="admin-main"><header className="admin-topbar"><div><span className="admin-mobile-label">SDN Bangah</span><span className="admin-breadcrumb">Admin / <strong>{links.find(([key]) => key === active)?.[1]}</strong></span></div><div className="admin-topbar__actions"><span className="save-indicator">{saving ? 'Menyimpan perubahan…' : 'Konten terhubung ke API'}</span><span className="admin-user-name">{userLoading ? 'Memuat profil…' : (displayName || 'Profil admin belum terhubung')}</span><span className="admin-avatar" title={displayName || 'Admin'}>{initials}</span></div></header>{children}</main>
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
    if (!response.ok) throw new Error(`Permintaan ${url} gagal (HTTP ${response.status}).`);
    return response.status === 204 ? null : response.json();
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
  async function createCollection(key) {
    const template = key === 'activities'
      ? { title: 'Kegiatan baru', description: '', label: '', imageLabel: '' }
      : key === 'posts'
        ? { title: 'Berita baru', excerpt: '', category: '', date: new Date().toISOString().slice(0, 10), featured: false, imageLabel: '' }
        : { title: 'Agenda baru', description: '', date: new Date().toISOString().slice(0, 10), time: '' };
    return mutate(() => requestJson(`/api/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(template) }), 'Item baru ditambahkan.');
  }

  return <Shell active={active} onNavigate={setActive} user={user} userLoading={userLoading} siteName={site.meta?.schoolName} saving={saving}>
    {notice && <div className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Tutup pesan">×</button></div>}
    {contentError && <div className="admin-notice" role="alert">Data konten belum dapat dimuat: {contentError}</div>}
    {active === 'overview' && <Overview dashboard={dashboard} dashboardLoading={dashboardLoading} dashboardError={dashboardError} user={user} userLoading={userLoading} onNavigate={setActive} />}
    {active === 'profile' && (contentLoading ? <div className="admin-page">Memuat profil sekolah…</div> : contentError ? <div className="admin-page">Profil belum tersedia.</div> : <ProfileEditor site={site} updateMeta={updateMeta} saveSite={saveSite} />)}
    {['activities', 'posts', 'agenda'].includes(active) && (contentLoading ? <div className="admin-page">Memuat konten…</div> : contentError ? <div className="admin-page">Konten belum tersedia.</div> : <CollectionEditor collection={collections.find((item) => item.key === active)} items={site[active] || []} saveCollection={saveCollection} deleteCollection={deleteCollection} createCollection={createCollection} />)}
  </Shell>;
}

function Overview({ dashboard, dashboardLoading, dashboardError, user, userLoading, onNavigate }) { return <div className="admin-page"><header className="admin-page__header"><div><p className="eyebrow">Admin editor · SDN Bangah</p><h1>Konten sekolah, tetap dalam kendali.</h1><p>Kelola profil publik, berita, kegiatan, dan agenda dari satu workspace sederhana.</p></div><a className="admin-button admin-button--dark" href="/">Lihat profil publik <Icon name="arrow" size={14} /></a></header><section className="admin-welcome"><div><span className="section-label">Ringkasan pengelolaan sekolah</span><h2>{userLoading ? "Memuat profil admin…" : user?.name || user?.fullName || user?.nama ? `Selamat datang, ${user.name || user.fullName || user.nama}.` : "Selamat datang di Dashboard Admin."}</h2><p>Periksa konten yang tampil ke masyarakat, lalu perbarui bagian yang perlu.</p></div><Placeholder label="IMAGE · ADMIN MOMENT" /></section>{dashboardError && <p className="admin-api-warning" role="alert">Statistik belum dapat dimuat: {dashboardError}</p>}<div className="admin-stat-grid"><Stat label="Total kegiatan" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.activities ?? "—")} tone="green" /><Stat label="Berita tersimpan" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.posts ?? "—")} tone="yellow" /><Stat label="Total agenda" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.agenda ?? "—")} tone="coral" /><Stat label="Materi tersimpan" value={dashboardLoading ? "…" : dashboardError ? "—" : (dashboard?.counts?.materials ?? "—")} tone="blue" /></div><div className="admin-overview-grid"><section className="admin-panel"><div className="admin-panel__head"><div><span className="section-label">Shortcut editor</span><h2>Mulai dari bagian yang ingin diubah.</h2></div></div><div className="admin-shortcuts"><button onClick={() => onNavigate('profile')}><strong>Edit profil</strong><small>Judul, deskripsi, kontak, placeholder</small><b>↗</b></button><button onClick={() => onNavigate('activities')}><strong>Atur kegiatan</strong><small>Kelola carousel kegiatan sekolah</small><b>↗</b></button><button onClick={() => onNavigate('posts')}><strong>Tulis catatan</strong><small>Berita dan cerita dari sekolah</small><b>↗</b></button></div></section><section className="admin-panel"><div className="admin-panel__head"><div><span className="section-label">Perlu perhatian</span><h2>Status konten</h2></div></div><ul className="admin-check-list"><li><span>✓</span><div><strong>Profil sekolah melalui API</strong><small>Data ditampilkan dari API `/api/site`.</small></div></li><li><span>✓</span><div><strong>Aset gambar sekolah</strong><small>Gambar dapat dikelola saat fitur upload tersedia di backend.</small></div></li><li><span>—</span><div><strong>API identitas admin</strong><small>Nama admin akan ditampilkan dari /api/me setelah autentikasi terhubung.</small></div></li></ul></section></div></div>; }
function Stat({ label, value, tone }) { return <div className={`admin-stat admin-stat--${tone}`}><span>{label}</span><strong>{value}</strong><small>data dari backend</small></div>; }

function ProfileEditor({ site, updateMeta, saveSite }) { const meta = site.meta || {}; const fields = [['schoolName', 'Nama sekolah'], ['eyebrow', 'Keterangan singkat'], ['heroTitle', 'Judul utama'], ['heroDescription', 'Deskripsi utama'], ['aboutTitle', 'Judul tentang sekolah'], ['aboutDescription', 'Deskripsi tentang sekolah'], ['aboutBody', 'Isi profil'], ['contactEmail', 'Email'], ['phone', 'Telepon'], ['address', 'Alamat']]; return <div className="admin-page"><header className="admin-page__header"><div><p className="eyebrow">Editor profil</p><h1>Profil sekolah.</h1><p>Perubahan di sini akan terlihat di halaman publik setelah disimpan.</p></div><button className="admin-button admin-button--dark" onClick={saveSite}><Icon name="check" size={15} /> Simpan perubahan</button></header><div className="profile-editor-layout"><section className="admin-panel admin-form-panel"><div className="admin-panel__head"><div><span className="section-label">Konten utama</span><h2>Kalimat yang menyambut keluarga.</h2></div></div><div className="admin-form-grid">{fields.map(([key, label]) => <label key={key} className={['heroDescription', 'aboutDescription', 'aboutBody'].includes(key) ? 'admin-field--full' : ''}>{label}{['heroDescription', 'aboutDescription', 'aboutBody'].includes(key) ? <textarea rows={key === 'aboutBody' ? 6 : 3} value={meta[key] || ''} onChange={(event) => updateMeta(key, event.target.value)} /> : <input value={meta[key] || ''} onChange={(event) => updateMeta(key, event.target.value)} />}</label>)}</div><div className="admin-form-actions"><button className="admin-button admin-button--dark" onClick={saveSite}><Icon name="check" size={15} /> Simpan profil</button></div></section><aside className="admin-preview"><span className="section-label">Preview aset</span><h2>Semua image punya tempat yang jelas.</h2><Placeholder label={meta.imageLabels?.hero || 'IMAGE · HERO UTAMA'} /><small>Gunakan label ini untuk mencari bagian yang perlu diganti saat aset asli tersedia.</small><div className="admin-preview__meta"><span>{meta.schoolName || 'SDN Bangah No. 383'}</span><a href="/">Buka halaman publik ↗</a></div></aside></div></div>; }

function CollectionEditor({ collection, items, saveCollection, deleteCollection, createCollection }) { const [editing, setEditing] = useState(null); return <div className="admin-page"><header className="admin-page__header"><div><p className="eyebrow">Editor konten · {collection.label}</p><h1>{collection.label}.</h1><p>Tambah, edit, atau hapus konten yang tampil di profil publik SDN Bangah.</p></div><button className="admin-button admin-button--dark" onClick={() => createCollection(collection.key)}><Icon name="plus" size={15} /> Tambah {collection.singular}</button></header><div className="admin-collection-list">{items.length ? items.map((item) => editing === item.id ? <EditItem key={item.id} item={item} collection={collection} onSave={async (next) => { const ok = await saveCollection(collection.key, next); if (ok) setEditing(null); }} onCancel={() => setEditing(null)} /> : <article className="admin-content-row" key={item.id}><div className="admin-content-row__visual"><Placeholder label={item.imageLabel || 'IMAGE · CONTENT'} /></div><div className="admin-content-row__body"><span className="section-label">{item.category || collection.singular} · {item.date || 'Konten sekolah'}</span><h2>{item.title}</h2><p>{item.description || item.excerpt || 'Belum ada deskripsi.'}</p></div><div className="admin-content-row__actions"><button className="admin-button admin-button--quiet" onClick={() => setEditing(item.id)}>Edit</button><button className="admin-delete" onClick={() => deleteCollection(collection.key, item.id)}>Hapus</button></div></article>) : <div className="admin-empty"><strong>Belum ada {collection.singular}.</strong><p>Tambahkan konten pertama untuk mulai mengisi halaman publik.</p><button className="admin-button admin-button--dark" onClick={() => createCollection(collection.key)}><Icon name="plus" size={15} /> Tambah {collection.singular}</button></div>}</div></div>; }
function EditItem({ item, collection, onSave, onCancel }) { const [draft, setDraft] = useState(item); function change(key, value) { setDraft((current) => ({ ...current, [key]: value })); } return <article className="admin-edit-card"><div className="admin-edit-card__head"><div><span className="section-label">Sedang mengedit</span><h2>{item.title}</h2></div><button className="admin-delete" onClick={onCancel}>Batal</button></div><div className="admin-form-grid">{collection.fields.map(([key, label]) => <label key={key} className={['description', 'excerpt'].includes(key) ? 'admin-field--full' : ''}>{label}{['description', 'excerpt'].includes(key) ? <textarea rows="3" value={draft[key] || ''} onChange={(event) => change(key, event.target.value)} /> : <input value={draft[key] || ''} onChange={(event) => change(key, event.target.value)} />}</label>)}</div><div className="admin-form-actions"><button className="admin-button admin-button--dark" onClick={() => onSave(draft)}><Icon name="check" size={15} /> Simpan</button></div></article>; }
