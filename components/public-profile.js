'use client';

import { useEffect, useState } from 'react';
import content from '../lib/public-content';
import './public-profile.css';
import './cms-public.css';

function GalleryPhoto({ src, alt, className = 'gallery-photo' }) {
  const [failedUrl, setFailedUrl] = useState('');
  const url = content.safeUrl(src, true);
  return <div className={className}>{url && failedUrl !== url
    ? <img src={url} alt={alt || 'Dokumentasi sekolah'} loading="lazy" onError={() => setFailedUrl(url)} />
    : <div className="gallery-photo-empty"><span>{alt || 'Foto belum tersedia'}</span></div>}
  </div>;
}

function AcademicCalendar({ agenda, year, initialMonth }) {
  const [month, setMonth] = useState(initialMonth || content.today().slice(0, 7));
  const calendar = content.calendar(month, agenda);
  const ordered = [...agenda].sort((a, b) => (content.parseDate(a.date)?.iso || '9999').localeCompare(content.parseDate(b.date)?.iso || '9999'));
  return <div className="information-grid">
    <article className="panel">
      <div className="panel-head"><h3>Kalender Akademik</h3>{year && <p>Tahun Ajaran {year}</p>}</div>
      <div className="calendar-controls">
        <button type="button" aria-label="Bulan sebelumnya" onClick={() => setMonth(content.shiftMonth(month, -1))}>←</button>
        <label htmlFor="calendar-month">Bulan agenda<input id="calendar-month" type="month" min="1000-01" max="9999-12" value={month} onChange={(event) => { if (content.parseDate(`${event.target.value}-01`)) setMonth(event.target.value); }} /></label>
        <button type="button" aria-label="Bulan berikutnya" onClick={() => setMonth(content.shiftMonth(month, 1))}>→</button>
        <button type="button" onClick={() => setMonth(content.today().slice(0, 7))}>Bulan ini</button>
      </div>
      <div className="calendar">
        <h4 className="month" aria-live="polite">{calendar.label}</h4>
        <div className="days-header">{['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="days-grid">{calendar.days.map((cell, index) => <div key={index} className={`day${cell.weekend ? ' weekend' : ''}${cell.events.length ? ' has-events' : ''}`} title={cell.day ? `${cell.day} ${calendar.label}${cell.events.length ? ': ' + cell.events.map((event) => event.title).join(', ') : ''}` : undefined}>
          <span className="num">{cell.day || ''}</span>{cell.events.map((event) => <span className="event" key={event.id}>{event.title}</span>)}
        </div>)}</div>
        {!calendar.days.some((cell) => cell.events.length) && <p className="info-note">Belum ada agenda pada bulan ini.</p>}
      </div>
    </article>
    <article className="panel"><div className="panel-head"><h3>Daftar Kegiatan</h3><p>Agenda yang dijadwalkan sekolah.</p></div>
      {ordered.length ? <ul className="activity-list">{ordered.map((event) => <li key={event.id}>
        <strong>{content.formatDate(event.date)}</strong><div><span>{event.title}</span>{event.time && <small>{event.time}</small>}{event.description && <p>{event.description}</p>}</div>
      </li>)}</ul> : <p className="cms-empty">Belum ada agenda yang dijadwalkan.</p>}
    </article>
  </div>;
}

export default function PublicProfile({ initialSite = null, articleId = null, initialMonth }) {
  const [site, setSite] = useState(initialSite);
  const [menuOpen, setMenuOpen] = useState(false);
  const [failedLogo, setFailedLogo] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(!initialSite);

  useEffect(() => {
    let controller;
    let disposed = false;
    const reload = async () => {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      try {
        const response = await fetch('/api/site', { cache: 'no-store', signal: requestController.signal });
        if (!response.ok) throw new Error('Informasi sekolah belum tersedia.');
        const next = await response.json();
        if (!disposed && !requestController.signal.aborted) { setSite(next); setLoadError(false); setLoading(false); }
      } catch (error) {
        if (!disposed && error.name !== 'AbortError') { setLoadError(true); setLoading(false); }
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    reload();
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', onVisible);
    return () => { disposed = true; controller?.abort(); window.removeEventListener('focus', reload); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  useEffect(() => {
    const legacyLink = () => {
      if (window.location.hash.startsWith('#artikel/')) window.location.replace(`/berita/${encodeURIComponent(window.location.hash.slice(9))}`);
    };
    legacyLink(); window.addEventListener('hashchange', legacyLink);
    return () => window.removeEventListener('hashchange', legacyLink);
  }, []);

  const meta = site?.meta || {};
  const schoolName = content.text(meta, 'schoolName') || content.defaults.schoolName;
  const logoUrl = content.safeUrl(meta.logoUrl, true) || content.defaults.logoUrl;
  const heroUrl = content.safeUrl(meta.heroImageUrl, true) || content.defaults.heroImageUrl;
  const activities = site?.activities || [];
  const posts = site?.posts || [];
  const agenda = site?.agenda || [];
  const article = posts.find((post) => post.id === articleId);
  const instagram = content.safeUrl(content.text(meta, 'instagramUrl'));
  const mission = content.missionItems(meta.mission);
  const anchor = (id) => `${articleId ? '/' : ''}#${id}`;
  const closeMenu = () => setMenuOpen(false);

  return <div className="static-public-profile" id="home">
    <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
    <header className="header"><div className="site-shell header-inner">
      <a className="brand" href={anchor('home')} onClick={closeMenu}>
        {failedLogo === logoUrl ? <span className="brand-logo brand-logo--fallback" aria-hidden="true">SD</span> : <img className="brand-logo" src={logoUrl} alt={`Logo ${schoolName}`} onError={() => setFailedLogo(logoUrl)} />}
        <span className="brand-name">{content.text(meta, 'shortName') || schoolName}<small>{content.text(meta, 'schoolType')}</small></span>
      </a>
      <button className="menu-toggle" type="button" aria-controls="public-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? 'Tutup' : 'Menu'}</button>
      <nav className={`nav${menuOpen ? ' is-open' : ''}`} id="public-navigation" aria-label="Navigasi utama">
        <a href={anchor('home')} onClick={closeMenu}>Beranda</a><a href={anchor('profil')} onClick={closeMenu}>Profil</a><a href={anchor('berita')} onClick={closeMenu}>Kegiatan & Berita</a><a href={anchor('informasi')} onClick={closeMenu}>Informasi</a>
      </nav>
      <a className="btn-login" href="/login">Portal Guru</a>
    </div></header>
    <main id="main-content">
      {loadError && <p className="site-shell cms-load-notice" role="status">Informasi terbaru belum dapat dimuat. Coba muat ulang halaman.</p>}
      {articleId ? <section className="section"><div className="site-shell cms-article">
        <a className="cms-back" href="/#berita">← Kembali ke berita sekolah</a>
        {article ? <article>
          <p className="section-label">{article.category || 'Berita Sekolah'}</p><h1>{article.title}</h1><p className="cms-article-date">{content.formatDate(article.date)}</p>
          {article.imageUrl && <GalleryPhoto src={article.imageUrl} alt={article.imageLabel || article.title} className="cms-article-image" />}
          <div className="cms-article-body">{article.content || article.excerpt || 'Isi berita belum ditambahkan.'}</div>
        </article> : <h1>Berita tidak ditemukan.</h1>}
      </div></section> : <>
        <section className="hero" aria-labelledby="hero-title" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 25, 51, 0.76) 0%, rgba(12, 34, 70, 0.56) 48%, rgba(12, 38, 76, 0.40) 100%), url(${JSON.stringify(heroUrl)})`, backgroundPosition: 'center center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }}>
          <div className="hero-content"><p className="hero-school">{content.text(meta, 'eyebrow')}</p><h1 className="hero-title" id="hero-title">{content.text(meta, 'heroTitle')}</h1>
            {content.text(meta, 'heroDescription') && <p className="hero-desc">{content.text(meta, 'heroDescription')}</p>}
            <div className="hero-actions"><a className="button-primary" href="#profil">Mengenal Sekolah <span aria-hidden="true">↗</span></a><a className="button-outline" href="#informasi">Informasi Akademik</a></div>
            <div className="hero-bottom">Belajar, bertumbuh, dan berprestasi bersama.</div>
          </div>
        </section>
        <section className="section" id="profil"><div className="site-shell">
          <div className="section-heading"><p className="section-label">Tentang Kami</p><h2>{content.text(meta, 'aboutTitle')}</h2>{content.text(meta, 'aboutDescription') && <p>{content.text(meta, 'aboutDescription')}</p>}</div>
          <div className="profile-grid"><div className="profile-copy cms-paragraphs">{content.text(meta, 'aboutBody').split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            <div className="info-card"><div className="info-card-title">Identitas Sekolah</div><dl className="info-body"><dt>Nama Sekolah</dt><dd>{schoolName}</dd><dt>NPSN</dt><dd>{content.text(meta, 'npsn')}</dd><dt>Jenjang</dt><dd>{content.text(meta, 'schoolType')}</dd><dt>Status</dt><dd>{content.text(meta, 'schoolStatus')}</dd><dt>Alamat</dt><dd>{content.text(meta, 'address')}</dd></dl></div>
          </div>
          <div className="principles"><article className="vision-card"><p className="section-label">Arah Kami</p><h3>Visi Sekolah</h3><p>{content.text(meta, 'vision')}</p></article><article className="mission-card"><p className="section-label">Langkah Kami</p><h3>Misi Sekolah</h3>{mission.length ? <ol>{mission.map((item, index) => <li key={index}>{item}</li>)}</ol> : <p>Misi sekolah belum ditambahkan.</p>}</article></div>
        </div></section>
        <section className="section section--light" id="berita"><div className="site-shell">
          <div className="section-heading"><p className="section-label">Kehidupan Sekolah</p><h2>Momen yang tumbuh bersama.</h2><p>Dokumentasi kegiatan dan cerita keseharian {schoolName}.</p></div>
          <div className="gallery-grid"><article className="gallery-card">
            <div className="gallery-card-head"><div><p className="section-label">Galeri</p><h3>Kegiatan Sekolah</h3></div><span className="gallery-chip">Dokumentasi</span></div>
            {activities.length ? <div className="photo-grid">{activities.map((activity) => <figure className="cms-gallery-item" key={activity.id}>
              <GalleryPhoto src={activity.imageUrl} alt={activity.imageLabel || activity.title} /><figcaption><h4>{activity.title}</h4>{activity.description && <p>{activity.description}</p>}{activity.label && <small>{activity.label}</small>}</figcaption>
            </figure>)}</div> : <p className="cms-empty">{loading ? 'Memuat kegiatan…' : 'Belum ada kegiatan yang dibagikan.'}</p>}
          </article><article className="gallery-card">
            <div className="gallery-card-head"><div><p className="section-label">Media Sosial</p><h3>Instagram Sekolah</h3></div></div>
            <p className="gallery-caption">Ikuti cerita dan kegiatan sekolah melalui laman Instagram resmi.</p>
            {instagram ? <a className="instagram-link" href={instagram} target="_blank" rel="noopener noreferrer">Kunjungi Instagram sekolah <span aria-hidden="true">↗</span></a> : <p className="cms-empty">Laman Instagram belum ditambahkan.</p>}
          </article></div>
          <div className="cms-news-heading"><p className="section-label">Berita Sekolah</p><h3>Kabar terbaru sekolah</h3></div>
          {posts.length ? <div className="cms-news-list">{posts.map((post) => <article className="news-card" key={post.id}>
            {post.imageUrl && <GalleryPhoto src={post.imageUrl} alt={post.imageLabel || post.title} className="cms-news-image" />}
            <div><p className="section-label">{post.category || 'Berita Sekolah'}</p><h3><a href={`/berita/${encodeURIComponent(post.id)}`}>{post.title}</a></h3><p className="cms-news-date">{content.formatDate(post.date)}</p><p>{post.excerpt}</p><a className="cms-read-more" href={`/berita/${encodeURIComponent(post.id)}`}>Baca selengkapnya ↗</a></div>
          </article>)}</div> : <p className="cms-empty">{loading ? 'Memuat berita…' : 'Belum ada berita yang dibagikan.'}</p>}
        </div></section>
        <section className="section" id="informasi"><div className="site-shell"><div className="section-heading"><p className="section-label">Informasi Akademik</p><h2>Kalender & Agenda Sekolah</h2><p>Jadwal dan kegiatan yang disiapkan sekolah.</p></div><AcademicCalendar agenda={agenda} year={content.text(meta, 'year')} initialMonth={initialMonth} /></div></section>
      </>}
    </main>
    <footer className="footer"><div className="site-shell footer-inner"><div><strong>{schoolName}</strong><p>{content.text(meta, 'address')}</p></div><div className="cms-contact-links">
      {content.text(meta, 'phone') && <a href={`tel:${content.text(meta, 'phone')}`}>{content.text(meta, 'phone')}</a>}
      {content.text(meta, 'contactEmail') && <a href={`mailto:${content.text(meta, 'contactEmail')}`}>{content.text(meta, 'contactEmail')}</a>}
    </div></div></footer>
  </div>;
}
