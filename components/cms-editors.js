'use client';

import { useState } from 'react';
import { Icon } from './ui-icon';
import CmsImageField from './cms-image-field';
import content from '../lib/public-content';

const profileFields = [
  ['schoolName', 'Nama sekolah'], ['shortName', 'Nama singkat'], ['npsn', 'NPSN'], ['schoolType', 'Jenjang pendidikan'], ['schoolStatus', 'Status sekolah'],
  ['eyebrow', 'Keterangan singkat'], ['heroTitle', 'Judul utama'], ['heroDescription', 'Deskripsi utama'], ['aboutTitle', 'Judul tentang sekolah'],
  ['aboutDescription', 'Deskripsi tentang sekolah'], ['aboutBody', 'Isi profil'], ['vision', 'Visi sekolah'], ['mission', 'Misi sekolah (satu poin per baris)'],
  ['year', 'Tahun ajaran'], ['contactEmail', 'Email'], ['phone', 'Telepon'], ['address', 'Alamat'], ['instagramUrl', 'Alamat Instagram'],
];
const multiline = new Set(['heroDescription', 'aboutDescription', 'aboutBody', 'vision', 'mission', 'address']);

export function ProfileEditor({ site, updateMeta, saveSite }) {
  const meta = site.meta || {};
  const [saving, setSaving] = useState(false);
  async function save(event) { event.preventDefault(); setSaving(true); try { await saveSite(); } finally { setSaving(false); } }
  return <div className="admin-page">
    <header className="admin-page__header"><div><p className="eyebrow">Editor profil</p><h1>Profil sekolah.</h1><p>Perubahan yang disimpan akan terlihat di halaman publik.</p></div><a className="admin-button admin-button--quiet" href="/" target="_blank" rel="noopener noreferrer">Lihat profil publik ↗</a></header>
    <div className="profile-editor-layout"><section className="admin-panel admin-form-panel"><div className="admin-panel__head"><div><span className="section-label">Konten utama</span><h2>Informasi yang menyambut keluarga.</h2></div></div>
      <form onSubmit={save}><div className="admin-form-grid">{profileFields.map(([key, label]) => {
        const value = key === 'mission' && Array.isArray(meta[key]) ? meta[key].join('\n') : content.text(meta, key);
        return <label key={key} className={multiline.has(key) ? 'admin-field--full' : ''}>{label}{multiline.has(key)
          ? <textarea name={key} rows={['aboutBody', 'mission'].includes(key) ? 6 : 3} value={value} onChange={(event) => updateMeta(key, event.target.value)} />
          : <input name={key} type={key === 'contactEmail' ? 'email' : key === 'instagramUrl' ? 'url' : 'text'} value={value} onChange={(event) => updateMeta(key, event.target.value)} />}
        </label>;
      })}</div><div className="admin-form-actions"><button className="admin-button admin-button--dark" type="submit" disabled={saving}><Icon name="check" size={15} />{saving ? 'Menyimpan…' : 'Simpan profil'}</button></div></form>
    </section><aside className="admin-preview"><span className="section-label">Gambar sekolah</span><h2>Logo dan foto utama.</h2>
      <CmsImageField label="Logo sekolah" value={meta.logoUrl || ''} defaultSrc={content.defaults.logoUrl} onChange={(value) => updateMeta('logoUrl', value)} />
      <CmsImageField label="Foto utama" value={meta.heroImageUrl || ''} defaultSrc={content.defaults.heroImageUrl} onChange={(value) => updateMeta('heroImageUrl', value)} />
      <p className="cms-image-hint">Klik Simpan profil setelah mengganti gambar.</p>
    </aside></div>
  </div>;
}

export function CollectionEditor({ collection, items, saveCollection, deleteCollection, createCollection }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const newItem = collection.key === 'activities' ? { title: '', description: '', label: '', imageLabel: '' }
    : collection.key === 'posts' ? { title: '', excerpt: '', content: '', category: '', date: content.today(), imageLabel: '' }
      : { title: '', description: '', date: content.today(), time: '' };
  return <div className="admin-page">
    <header className="admin-page__header"><div><p className="eyebrow">Editor konten · {collection.label}</p><h1>{collection.label}.</h1><p>Konten tampil di halaman publik setelah disimpan.</p></div><button type="button" className="admin-button admin-button--dark" onClick={() => setCreating(true)} disabled={creating}><Icon name="plus" size={15} />Tambah {collection.singular}</button></header>
    {creating && <EditItem item={newItem} collection={collection} creating onCancel={() => setCreating(false)} onSave={async (next) => { if (await createCollection(collection.key, next)) setCreating(false); }} />}
    <div className="admin-collection-list">{items.length ? items.map((item) => editing === item.id
      ? <EditItem key={item.id} item={item} collection={collection} onCancel={() => setEditing(null)} onSave={async (next) => { if (await saveCollection(collection.key, next)) setEditing(null); }} />
      : <article className="admin-content-row" key={item.id}>
        {collection.key !== 'agenda' && <div className="admin-content-row__visual">{content.safeUrl(item.imageUrl, true) ? <img className="cms-admin-thumb" src={item.imageUrl} alt={item.imageLabel || item.title} /> : <div className="admin-image-placeholder"><span>Belum ada foto</span></div>}</div>}
        <div className="admin-content-row__body"><span className="section-label">{item.category || collection.singular}{item.date ? ` · ${content.formatDate(item.date)}` : ''}</span><h2>{item.title}</h2><p>{item.description || item.excerpt || 'Belum ada deskripsi.'}</p>{collection.key === 'posts' && <a href={`/berita/${encodeURIComponent(item.id)}`} target="_blank" rel="noopener noreferrer">Lihat berita ↗</a>}</div>
        <div className="admin-content-row__actions"><button type="button" className="admin-button admin-button--quiet" onClick={() => setEditing(item.id)}>Edit</button><button type="button" className="admin-delete" onClick={() => deleteCollection(collection.key, item.id)}>Hapus</button></div>
      </article>) : !creating && <div className="admin-empty"><strong>Belum ada {collection.singular}.</strong><p>Tambahkan konten pertama untuk halaman publik.</p></div>}
    </div>
  </div>;
}

function EditItem({ item, collection, onSave, onCancel, creating = false }) {
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState(false);
  const change = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  async function save(event) { event.preventDefault(); setSaving(true); try { await onSave(draft); } finally { setSaving(false); } }
  const large = new Set(['description', 'excerpt', 'content']);
  return <article className="admin-edit-card">
    <div className="admin-edit-card__head"><div><span className="section-label">{creating ? 'Konten baru' : 'Sedang mengedit'}</span><h2>{item.title || `Tambah ${collection.singular}`}</h2></div><button type="button" className="admin-delete" onClick={onCancel} disabled={saving}>Batal</button></div>
    <form onSubmit={save}><div className="admin-form-grid">{collection.fields.filter(([key]) => key !== 'imageUrl').map(([key, label]) => <label key={key} className={large.has(key) ? 'admin-field--full' : ''}>{label}{large.has(key)
      ? <textarea name={key} rows={key === 'content' ? 10 : 3} value={draft[key] || ''} onChange={(event) => change(key, event.target.value)} />
      : <input name={key} required={key === 'title' || (key === 'date' && collection.key === 'agenda')} type={key === 'date' ? 'date' : 'text'} value={key === 'date' ? content.parseDate(draft[key])?.iso || '' : draft[key] || ''} onChange={(event) => change(key, event.target.value)} />}
    </label>)}
      {collection.key !== 'agenda' && <CmsImageField label="Foto" value={draft.imageUrl || ''} onChange={(value) => change('imageUrl', value)} />}
    </div><div className="admin-form-actions"><button className="admin-button admin-button--dark" type="submit" disabled={saving}><Icon name="check" size={15} />{saving ? 'Menyimpan…' : 'Simpan'}</button></div></form>
  </article>;
}
