'use client';

import { useEffect, useState } from 'react';
import '../style.css';

// The layout and class names intentionally mirror index.html so both pages
// share style.css. Interactions are handled by React, not by script.js.
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

const septemberEvents = {
  3: 'Pertemuan Orang Tua',
  11: 'Ulangan Harian',
  18: 'Pembagian Raport',
  25: 'Hari Raya',
};

const calendarDays = Array.from({ length: 35 }, (_, index) =>
  index < 30 ? index + 1 : null
);

export default function PublicProfile() {
  const [site, setSite] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [whatsappUnavailable, setWhatsappUnavailable] = useState(false);

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

  // Retain backend-driven identity/agenda when provided without changing the
  // original static HTML's structure, typography, or section order.
  const displayName = site?.meta?.schoolName || school.name;
  const displayAddress = site?.meta?.schoolAddress || school.address;
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="static-public-profile" id="home">
      <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
      <header className="header">
        <a href="#home" className="brand" onClick={closeMenu}>
          {logoUnavailable ? (
            <span className="brand-logo brand-logo--fallback" aria-hidden="true">SD</span>
          ) : (
            <img
              src="/img/logo-sekolah.png"
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
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-content">
            <h2 className="hero-school">SDN Bangah</h2>
            <h1 className="hero-title" id="hero-title">Ayo, raih masa depan cerah melalui pendidikan berkarakter</h1>
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
            <p>SD Negeri Bangah merupakan salah satu lembaga pendidikan dasar negeri yang terletak di Kecamatan Gedangan, Kabupaten Sidoarjo. Berdiri di tengah lingkungan masyarakat yang kondusif, sekolah ini berkomitmen memberikan pelayanan pendidikan terbaik guna mencetak generasi muda yang cerdas, berkarakter, serta berdaya saing di era digital</p>
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
              <div className="card-row"><div className="card" /><div className="card" /></div>
            </div>
            <div className="social-col">
              <h2 className="section-title">Laman Instagram</h2>
              <div className="card-row"><div className="card" /><div className="card" /></div>
            </div>
          </div>
          <div className="news">
            <h2 className="section-title">Laman Berita</h2>
            <div className="news-card" />
          </div>
        </section>

        <section className="informasi" id="informasi">
          <article className="panel">
            <header className="panel-head">
              <h3>Kalender Akademik</h3>
              <p>Tahun Ajaran 2025/2026</p>
            </header>
            <div className="calendar">
              <h4 className="month">September 2025</h4>
              <div className="days-header">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="days-grid">
                {calendarDays.map((day, index) => (
                  <div className={`day${index % 7 >= 5 ? ' weekend' : ''}`} key={index}>
                    {day && <span className="num">{day}</span>}
                    {day && septemberEvents[day] && <span className="event">{septemberEvents[day]}</span>}
                  </div>
                ))}
              </div>
            </div>
          </article>
          <article className="panel">
            <header className="panel-head">
              <h3>List Kegiatan</h3>
              <p>Kegiatan selama bulan September 2025 (contoh)</p>
            </header>
            <ul className="activity-list">
              {Object.entries(septemberEvents).map(([day, label]) => (
                <li key={day}><strong>{day} Sep</strong><span>{label}</span></li>
              ))}
            </ul>
          </article>
        </section>
      </main>

      {!whatsappUnavailable && (
        <a href="https://wa.me/" className="wa-float" target="_blank" rel="noopener noreferrer" aria-label="Hubungi via WhatsApp">
          <img src="/img/whatsapp.svg" alt="" onError={() => setWhatsappUnavailable(true)} />
        </a>
      )}
    </div>
  );
}
  