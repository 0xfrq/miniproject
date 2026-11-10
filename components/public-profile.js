'use client';

import { useEffect, useState } from 'react';
import './public-profile.css';

// Preserve the downloaded school layout while using the existing CMS content.
const school = {
  name: 'SD Negeri Bangah (SDN Bangah No. 383)',
  npsn: '383',
  type: 'Sekolah Dasar (SD)',
  status: 'Negeri',
  address: 'Jl. Singojoyo III No. 1, Dusun Bangah Barat, Desa Bangah, Kec. Gedangan, Kabupaten Sidoarjo, Jawa Timur 61254',
};

const mission = [
  'Menanamkan Nilai Religius & Karakter: Mengintegrasikan nilai-nilai keimanan, ketakwaan, dan Budi Pekerti Luhur dalam setiap aktivitas pembelajaran sehari-hari.',
  'Mengembangkan Potensi Akademik & Non-Akademik: Menyediakan sarana dan bimbingan belajar yang berkualitas untuk mendorong siswa meraih prestasi tinggi di bidang akademik, seni, maupun olahraga.',
  'Mewujudkan Lingkungan Belajar Kreatif & Inovatif: Menerapkan metode pembelajaran yang aktif, menyenangkan, dan berwawasan teknologi untuk melatih keterampilan berpikir kritis.',
  'Membangun Budaya Kolaboratif: Menjalin kerja sama yang erat dan harmonis antara pihak sekolah, orang tua, serta masyarakat sekitar.',
  'Membentuk Sikap Mandiri & Peduli Lingkungan: Menumbuhkan rasa tanggung jawab, kepemimpinan, serta kepedulian terhadap kebersihan dan kelestarian lingkungan sekolah.',
];

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function eventDate(value = '') {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const local = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(value);
  if (!iso && !local) return null;
  const year = Number(iso ? iso[1] : local[3]);
  const month = iso ? Number(iso[2]) - 1 : monthNames.findIndex((name) => name.toLowerCase() === local[2].toLowerCase());
  const day = Number(iso ? iso[3] : local[1]);
  const date = new Date(year, month, day);
  return month >= 0 && date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

function SchoolImage({ item, className = '' }) {
  const [failedUrl, setFailedUrl] = useState('');
  const label = item.imageLabel || item.title || 'Kegiatan sekolah';
  return item.imageUrl && item.imageUrl !== failedUrl
    ? <img className={className} src={item.imageUrl} alt={label} onError={() => setFailedUrl(item.imageUrl)} />
    : <div className={`${className} image-fallback`} role="img" aria-label={label}><span>{label}</span></div>;
}

export default function PublicProfile({ initialSite = null }) {
  const [site, setSite] = useState(initialSite);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [hash, setHash] = useState('');
  const [formStatus, setFormStatus] = useState('');

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.slice(1));
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (hash.startsWith('artikel/')) { window.scrollTo(0, 0); return; }
    const aliases = { top: 'home', galeri: 'berita', kegiatan: 'berita', catatan: 'berita', blog: 'berita', agenda: 'informasi', contact: 'pendaftaran' };
    const frame = window.requestAnimationFrame(() => document.getElementById(aliases[hash] || hash)?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/site', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Data situs tidak tersedia');
        return response.json();
      })
      .then(setSite)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const meta = site?.meta || {};
  const activities = site?.activities || [];
  const posts = site?.posts || [];
  const agenda = site?.agenda || [];
  const displayName = site?.meta?.schoolName || school.name;
  const displayAddress = meta.address || meta.schoolAddress || school.address;
  const articleId = hash.startsWith('artikel/') ? hash.slice('artikel/'.length) : '';
  const article = posts.find((post) => post.id === articleId);
  const datedEvents = agenda.map((event) => ({ ...event, calendarDate: eventDate(event.date) }));
  const calendarDate = datedEvents.find((event) => event.calendarDate)?.calendarDate || new Date(2025, 8, 1);
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const leadingDays = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const phoneDigits = (meta.phone || '').replace(/\D/g, '').replace(/^0/, '62');
  const closeMenu = () => setMenuOpen(false);

  function submitContact(event) {
    event.preventDefault();
    setFormStatus('Pesan sudah siap dicatat. Tim sekolah akan menghubungi kamu melalui email.');
    event.currentTarget.reset();
  }

  return (
    <div className="static-public-profile" id="home">
      <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
      <header className="header">
        <a href="#home" className="brand" onClick={closeMenu}>
          {!meta.logoUrl || logoUnavailable ? (
            <span className="brand-logo brand-logo--fallback" aria-hidden="true">SD</span>
          ) : (
            <img
              src={meta.logoUrl}
              alt="Logo SDN Bangah"
              className="brand-logo"
              onError={() => setLogoUnavailable(true)}
            />
          )}
          <span className="brand-name">SDN<br />Bangah</span>
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="public-primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Tutup' : 'Menu'}
        </button>
        <nav className={`nav${menuOpen ? ' is-open' : ''}`} id="public-primary-navigation" aria-label="Navigasi utama">
          <a href="#home" onClick={closeMenu}>Home</a>
          <a href="#profil" onClick={closeMenu}>Profil</a>
          <a href="#berita" onClick={closeMenu}>Berita</a>
          <a href="#informasi" onClick={closeMenu}>Informasi</a>
        </nav>
        <a href="/guru" className="btn-login">Login</a>
      </header>

      <main id="main-content">
        {articleId ? <section className="article-detail" id="artikel" aria-labelledby="article-detail-title">
          <a href="#berita" className="back-link">← Kembali ke semua informasi</a>
          {article ? <article>
            <p className="article-meta">{article.category} · {article.date}</p>
            <h1 id="article-detail-title">{article.title}</h1>
            {article.imageUrl && <SchoolImage item={article} className="article-image" />}
            <div className="article-body">{article.content || article.excerpt || 'Belum ada isi artikel.'}</div>
          </article> : <h1 id="article-detail-title">Artikel tidak ditemukan.</h1>}
        </section> : <>
        <section className="hero" aria-labelledby="hero-title" style={meta.heroImageUrl ? { backgroundImage: `linear-gradient(rgba(20, 30, 120, .55), rgba(20, 30, 120, .55)), url(${JSON.stringify(meta.heroImageUrl)})` } : undefined}>
          <div className="hero-content">
            <h2 className="hero-school">{meta.schoolName || 'SDN Bangah'}</h2>
            <h1 className="hero-title" id="hero-title">{meta.heroTitle || 'Ayo, raih masa depan cerah melalui pendidikan berkarakter'}</h1>
            {meta.heroDescription && <p className="hero-description">{meta.heroDescription}</p>}
          </div>
        </section>

        <section className="profil" id="profil">
          <div className="info-table">
            <div className="info-head"><span></span><span>Keterangan</span></div>
            <dl className="info-body">
              <dt>Nama Sekolah</dt><dd>{displayName}</dd>
              <dt>NPSN</dt><dd>{school.npsn}</dd>
              <dt>Bentuk Pendidikan</dt><dd>{school.type}</dd>
              <dt>Status Sekolah</dt><dd>{school.status}</dd>
              <dt>Alamat</dt><dd>{displayAddress}</dd>
            </dl>
          </div>
          <div className="profil-text">
            {meta.aboutTitle && <h2>{meta.aboutTitle}</h2>}
            {meta.aboutDescription && <p>{meta.aboutDescription}</p>}
            <p>{meta.aboutBody || 'SD Negeri Bangah merupakan salah satu lembaga pendidikan dasar negeri yang terletak di Kecamatan Gedangan, Kabupaten Sidoarjo. Berdiri di tengah lingkungan masyarakat yang kondusif, sekolah ini berkomitmen memberikan pelayanan pendidikan terbaik guna mencetak generasi muda yang cerdas, berkarakter, serta berdaya saing di era digital'}</p>
            <p>Sebagai sekolah dasar, SDN Bangah terus beradaptasi dengan perkembangan zaman melalui penerapan kurikulum nasional terkini, integrasi teknologi pembelajaran, serta pembentukan karakter peserta didik berlandaskan nilai-nilai keimanan, kedisiplinan, dan kreativitas</p>
          </div>
          <div className="visi">
            <h3>VISI</h3>
            <p>"Terwujudnya Generasi Unggul, Berkarakter Beriman, Kreatif, dan Berprestasi Menuju Masa Depan Cemerlang."</p>
          </div>
          <div className="misi">
            <h3>MISI</h3>
            <ol>{mission.map((item) => <li key={item}>{item}</li>)}</ol>
          </div>
        </section>

        <section className="berita" id="berita">
          <div className="social-row">
            <div className="social-col">
              <h2 className="section-title">Laman Kegiatan</h2>
              <div className="card-row">{activities.length ? activities.map((activity) => <article className="card" key={activity.id}>
                <SchoolImage item={activity} className="activity-image" />
                <div className="card-copy"><h3>{activity.title}</h3><p>{activity.description}</p></div>
              </article>) : <p>Belum ada kegiatan yang dibagikan.</p>}</div>
            </div>
            <div className="social-col">
              <h2 className="section-title">Laman Instagram</h2>
              <div className="card-row"><div className="card social-placeholder"><span>Kabar kegiatan sekolah</span>{meta.instagramUrl ? <a href={meta.instagramUrl} target="_blank" rel="noopener noreferrer">Buka Instagram ↗</a> : <p>Laman Instagram belum tersedia.</p>}</div></div>
            </div>
          </div>
          <div className="news">
            <h2 className="section-title">Laman Berita</h2>
            <div className="news-list" id="article-list">{posts.length ? posts.map((post) => <article className="news-card" key={post.id}>
              {post.imageUrl && <SchoolImage item={post} className="news-image" />}
              <div className="card-copy"><p className="article-meta">{post.date} · {post.category}</p><h3>{post.title}</h3><p>{post.excerpt}</p><a href={`#artikel/${post.id}`}>Baca selengkapnya ↗</a></div>
            </article>) : <p>Belum ada berita yang dibagikan.</p>}</div>
          </div>
        </section>

        <section className="informasi" id="informasi">
          <article className="panel">
            <header className="panel-head">
              <h3>Kalender Akademik</h3>
              <p>Tahun Ajaran {meta.year || '2025/2026'}</p>
            </header>
            <div className="calendar">
              <h4 className="month">{monthNames[month]} {year}</h4>
              <div className="days-header">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="days-grid">
                {calendarDays.map((day, index) => (
                  <div className={`day${index % 7 >= 5 ? ' weekend' : ''}`} key={index}>
                    {day && <span className="num">{day}</span>}
                    {day && datedEvents.filter((event) => event.calendarDate?.getDate() === day && event.calendarDate?.getMonth() === month && event.calendarDate?.getFullYear() === year).map((event) => <span className="event" key={event.id}>{event.title}</span>)}
                  </div>
                ))}
              </div>
            </div>
          </article>
          <article className="panel">
            <header className="panel-head">
              <h3>List Kegiatan</h3>
              <p>Agenda kegiatan sekolah.</p>
            </header>
            <ul className="activity-list">
              {agenda.length ? agenda.map((event) => <li key={event.id}><strong>{event.date}</strong><span>{event.title}{event.time && <small>{event.time}</small>}{event.description && <small>{event.description}</small>}</span></li>) : <li>Belum ada agenda yang dijadwalkan.</li>}
            </ul>
          </article>
        </section>
        <section className="contact-section" id="pendaftaran" aria-labelledby="contact-title">
          <div><h2 id="contact-title">Hubungi sekolah</h2><p>Informasi pendaftaran dan kunjungan sekolah.</p><address>{displayAddress}{meta.phone && <a href={`tel:${meta.phone}`}>{meta.phone}</a>}{meta.contactEmail && <a href={`mailto:${meta.contactEmail}`}>{meta.contactEmail}</a>}</address></div>
          <form id="contact-form" onSubmit={submitContact}>
            <label>Nama lengkap<input required name="name" autoComplete="name" /></label>
            <label>Email<input required name="email" type="email" autoComplete="email" /></label>
            <label>Pesan<textarea required name="message" rows="4" /></label>
            <button type="submit" className="btn-login">Kirim pesan</button><p role="status">{formStatus}</p>
          </form>
        </section>
        </>}
      </main>

      <footer className="school-footer"><span>{displayName}</span><a href="/admin">Admin editor</a><a href="/ai-learning-generator.html">AI Learning Generator</a></footer>
      <a href={phoneDigits ? `https://wa.me/${phoneDigits}` : 'https://wa.me/'} className="wa-float" target="_blank" rel="noopener noreferrer" aria-label="Hubungi via WhatsApp"><span aria-hidden="true">WA</span></a>
    </div>
  );
}
