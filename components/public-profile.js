'use client';

import { useEffect, useState } from 'react';
import schoolPhoto from '../assets/SDN.jpg';
import schoolLogo from '../assets/logo-sekolah.png';

// Styles scoped to this component; no external CSS import is needed in Next.js.
const profileStyles = `/* SDN Bangah — shared visual system for static HTML and React */
:root{--ink:#17233e;--muted:#5d6b81;--navy:#152c56;--blue:#244d8b;--yellow:#f5c84b;--cream:#fffaf0;--surface:#fff;--soft:#f4f7fb;--line:#e0e7f0;--shadow:0 16px 45px rgba(20,44,79,.08)}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:92px}body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--surface);font-size:16px;line-height:1.65}a{color:inherit;text-decoration:none}button{font:inherit}img{max-width:100%;display:block}button,a{-webkit-tap-highlight-color:transparent}a:focus-visible,button:focus-visible{outline:3px solid #e7ae2b;outline-offset:4px}.site-shell{max-width:1180px;width:calc(100% - 48px);margin-inline:auto}.skip-link{position:absolute;top:-100px;left:12px;z-index:1000;padding:10px 16px;background:white}.skip-link:focus{top:12px}.header{height:82px;position:sticky;top:0;z-index:30;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.header-inner{height:100%;display:flex;align-items:center;gap:32px}.brand{display:flex;align-items:center;gap:12px;flex-shrink:0}.brand-logo{width:51px;height:51px;object-fit:contain;border-radius:13px}.brand-logo--fallback{display:grid;place-items:center;background:var(--navy);color:var(--yellow);font-size:17px;font-weight:800}.brand-name{font-size:16px;font-weight:800;line-height:1.15;letter-spacing:-.35px}.brand-name small{font-size:11px;font-weight:500;color:var(--muted);letter-spacing:.1px}.nav{display:flex;gap:30px;align-items:center;margin-left:auto}.nav a{font-size:14px;font-weight:600;color:#42516b;transition:color .2s}.nav a:hover{color:#174eaa}.btn-login{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;min-height:42px;padding:0 20px;border-radius:11px;color:#182b4f;background:var(--yellow);font-size:14px;font-weight:800;transition:transform .2s,background .2s}.btn-login:hover{background:#ffdc73;transform:translateY(-1px)}.menu-toggle{display:none}.eyebrow{margin:0 0 16px;text-transform:uppercase;font-size:12px;font-weight:800;letter-spacing:2px;color:#d8a326}.hero{position:relative;isolation:isolate;overflow:hidden;min-height:555px;display:flex;align-items:center;color:white;background:linear-gradient(100deg,rgba(11,30,66,.96),rgba(19,50,97,.82) 60%,rgba(25,58,113,.55)),url('/assets/SDN.jpg') center/cover no-repeat,#183966}.hero::after{content:"";position:absolute;z-index:-1;width:360px;height:360px;right:-120px;bottom:-240px;border:65px solid rgba(246,200,75,.17);border-radius:50%}.hero-content{padding-block:100px 110px;max-width:790px;margin-left:max(24px,calc((100vw - 1180px)/2))}.hero-school{font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:800;color:#f7d371;margin:0 0 20px}.hero-title{max-width:780px;font-size:clamp(38px,5vw,65px);line-height:1.13;letter-spacing:-2px;font-weight:800;margin:0 0 22px}.hero-desc{max-width:565px;color:#e2eaf5;font-size:17px;line-height:1.8;margin:0 0 30px}.hero-actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.button-primary,.button-outline{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;min-height:49px;padding:12px 22px;font-size:14px;font-weight:800;transition:transform .2s,background .2s}.button-primary{color:#172849;background:var(--yellow)}.button-outline{border:1px solid rgba(255,255,255,.5);color:white}.button-primary:hover,.button-outline:hover{transform:translateY(-2px)}.button-outline:hover{background:rgba(255,255,255,.12)}.hero-bottom{margin-top:45px;font-size:13px;color:#e1e9f5;display:flex;align-items:center;gap:10px}.hero-bottom::before{content:"";height:7px;width:7px;border-radius:50%;background:var(--yellow)}.section{padding-block:90px}.section--light{background:var(--soft)}.section-heading{margin-bottom:34px}.section-label{font-size:12px;font-weight:800;letter-spacing:1.9px;text-transform:uppercase;color:#b38620;margin:0 0 9px}.section-heading h2{font-size:clamp(27px,3.1vw,39px);line-height:1.22;letter-spacing:-1px;margin:0 0 12px}.section-heading p{color:var(--muted);max-width:640px;margin:0}.profile-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:30px;align-items:start}.profile-copy{font-size:16px;color:#50617a;line-height:1.9}.profile-copy p{margin:0 0 17px}.info-card,.vision-card,.mission-card,.panel,.preview-card,.news-card{background:white;border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow)}.info-card{overflow:hidden}.info-card-title{padding:20px 25px;background:#eaf1fa;font-size:15px;font-weight:800;color:var(--navy)}.info-body{margin:0;display:grid;grid-template-columns:150px 1fr;padding:10px 24px}.info-body dt,.info-body dd{padding:12px 0;margin:0;border-bottom:1px solid var(--line);font-size:13px;overflow-wrap:anywhere}.info-body dt{color:#68778d;font-weight:600}.info-body dd{font-weight:700;color:#233455}.info-body dt:nth-last-of-type(1),.info-body dd:nth-last-of-type(1){border-bottom:0}.principles{display:grid;grid-template-columns:1fr 1.3fr;gap:24px;margin-top:32px}.vision-card,.mission-card{padding:28px}.vision-card{background:var(--navy);color:white;border-color:var(--navy)}.vision-card .section-label{color:var(--yellow)}.vision-card h3,.mission-card h3{font-size:21px;margin:0 0 14px;line-height:1.3}.vision-card p{margin:0;line-height:1.85;color:#edf3fb}.mission-card ol{margin:0;padding-left:21px;color:#51627c;font-size:14px}.mission-card li{margin-bottom:10px;padding-left:4px}.mission-card li::marker{font-weight:800;color:#b78b2b}.content-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.preview-card{overflow:hidden}.preview-visual{height:175px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#dce9fa,#f5f8fd);position:relative}.preview-card:nth-child(2) .preview-visual{background:linear-gradient(135deg,#faf0d5,#f7f9fc)}.preview-symbol{height:74px;width:74px;display:grid;place-items:center;background:white;border-radius:20px;color:var(--blue);font-size:32px;font-weight:800;box-shadow:0 8px 22px rgba(22,58,102,.12)}.preview-body{padding:25px}.preview-body h3{font-size:20px;margin:0 0 6px}.preview-body p{color:var(--muted);margin:0;font-size:14px}.preview-status{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#63748e;margin-top:18px}.preview-status::before{content:"";height:7px;width:7px;background:#e3b648;border-radius:50%}.news-card{margin-top:24px;padding:30px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px}.news-card h3{margin:0 0 7px;font-size:21px}.news-card p{margin:0;color:var(--muted);font-size:14px}.news-mark{height:67px;width:67px;flex-shrink:0;border-radius:18px;display:grid;place-items:center;background:#e8effb;font-weight:800;font-size:28px;color:#245193}.information-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:start}.panel{padding:28px}.panel-head h3{font-size:20px;margin:0 0 4px}.panel-head p{font-size:13px;color:var(--muted);margin:0}.calendar{margin-top:23px}.month{font-size:15px;margin:0 0 15px}.days-header,.days-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.days-header{margin-bottom:9px}.days-header span{text-align:center;font-size:11px;font-weight:700;color:#7e8da2}.day{min-height:66px;padding:7px 3px;background:#f5f8fc;border-radius:8px;text-align:center}.day.weekend{background:#edf1f7}.day .num{font-size:12px;font-weight:800}.day .event{display:block;margin-top:3px;font-size:9px;line-height:1.2;color:#2a538b;overflow-wrap:anywhere}.activity-list{list-style:none;padding:0;margin:24px 0 0;display:flex;flex-direction:column;gap:11px}.activity-list li{display:flex;gap:15px;align-items:center;padding:14px 15px;background:#f5f8fc;border:1px solid #eaf0f7;border-radius:10px;font-size:13px;color:#52637a}.activity-list strong{width:55px;flex-shrink:0;color:#1f477e}.info-note{margin:20px 0 0;font-size:12px;color:#7b8798}.footer{padding:34px 0;background:#122849;color:#dce6f5}.footer-inner{display:flex;align-items:center;justify-content:space-between;gap:15px}.footer strong{font-size:16px}.footer p{margin:0;font-size:13px;color:#b8c8df}.static-public-profile{min-height:100vh}.static-public-profile .header{height:82px}
@media(max-width:900px){.nav{gap:18px}.hero-content{margin-left:24px}.profile-grid,.principles,.information-grid{grid-template-columns:1fr}.principles{margin-top:24px}.profile-grid{gap:20px}.section{padding-block:70px}}
@media(max-width:680px){html{scroll-padding-top:75px}.site-shell{width:calc(100% - 34px)}.header,.static-public-profile .header{height:72px}.header-inner{gap:12px}.brand-logo{height:42px;width:42px}.brand-name{font-size:14px}.brand-name small{font-size:10px}.menu-toggle{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:4px 12px;margin-left:auto;border:1px solid var(--line);border-radius:9px;background:white;color:var(--navy);font-size:13px;font-weight:750;cursor:pointer}.nav{display:none;position:absolute;top:71px;left:0;right:0;margin:0;padding:16px 20px 22px;flex-direction:column;align-items:stretch;gap:5px;background:#fff;box-shadow:0 16px 30px rgba(18,40,73,.1);border-bottom:1px solid var(--line)}.nav.is-open{display:flex}.nav a{display:block;padding:9px}.btn-login{padding:0 12px;min-height:38px;font-size:12px}.hero{min-height:500px}.hero-content{margin:0;padding:75px 20px 85px}.hero-title{font-size:clamp(35px,9vw,49px);letter-spacing:-1.3px}.hero-desc{font-size:15px}.section{padding-block:60px}.section-heading{margin-bottom:25px}.info-body{grid-template-columns:116px 1fr;padding:8px 16px}.info-body dt,.info-body dd{font-size:12px}.vision-card,.mission-card,.panel{padding:22px}.content-grid{grid-template-columns:1fr}.news-card{padding:24px}.information-grid{grid-template-columns:1fr}.day{min-height:49px;padding:5px 2px}.day .event{display:none}.footer-inner{flex-direction:column;align-items:flex-start}.hero-bottom{margin-top:30px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}

/* Penyesuaian hero dan galeri foto — v2 */
.static-public-profile .hero{min-height:calc(100svh - 82px);background:linear-gradient(90deg,rgba(8,25,51,.84) 0%,rgba(9,30,60,.70) 43%,rgba(12,38,76,.28) 100%),url('/assets/SDN.jpg') center center/cover no-repeat,#183966}
.static-public-profile .hero::after{display:none}
.static-public-profile .hero-content{padding-top:64px;padding-bottom:64px}
.static-public-profile .hero-title{font-size:clamp(39px,5.3vw,70px);max-width:790px;text-wrap:balance}
.static-public-profile .hero-desc{max-width:540px}
.static-public-profile .gallery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
.static-public-profile .gallery-card{min-width:0;padding:24px;background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow)}
.static-public-profile .gallery-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
.static-public-profile .gallery-card-head h3{font-size:22px;line-height:1.2;margin:0}
.static-public-profile .gallery-card-head .section-label{margin-bottom:4px}
.static-public-profile .gallery-chip{font-size:11px;font-weight:800;color:#264d82;padding:7px 10px;border-radius:99px;background:#e9f1fc;white-space:nowrap}
.static-public-profile .photo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.static-public-profile .gallery-photo{aspect-ratio:3/4;overflow:hidden;background:#ecf2f9;border-radius:12px}
.static-public-profile .gallery-photo img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.static-public-profile .gallery-photo:hover img{transform:scale(1.05)}
.static-public-profile .gallery-photo-empty{display:grid;place-items:center;width:100%;height:100%;padding:12px;text-align:center;font-size:12px;color:#77859b;background:linear-gradient(145deg,#e9f1fa,#f7f9fc)}
.static-public-profile .instagram-link{display:inline-flex;gap:8px;margin-top:18px;padding:10px 14px;background:#173b70;color:#fff;border-radius:10px;font-weight:700;font-size:13px}
.static-public-profile .instagram-link:hover{background:#254f8b}
.static-public-profile .gallery-caption{margin:15px 0 0;color:var(--muted);font-size:12px;line-height:1.6}
@media(max-width:900px){.static-public-profile .gallery-grid{grid-template-columns:1fr}}
@media(max-width:680px){.static-public-profile .hero{min-height:calc(100svh - 72px);background-position:58% center}.static-public-profile .hero-content{padding:48px 20px}.static-public-profile .hero-title{font-size:clamp(36px,10vw,50px)}.static-public-profile .gallery-card{padding:17px}.static-public-profile .gallery-card-head h3{font-size:19px}.static-public-profile .gallery-chip{font-size:10px}.static-public-profile .photo-grid{gap:6px}}
`;

// Foto disajikan dari folder public/assets. Tambahkan foto asli sekolah ke folder itu.
const activityPhotos = [
  { src: '/assets/kegiatan-1.jpg', alt: 'Dokumentasi kegiatan sekolah 1' },
  { src: '/assets/kegiatan-2.jpg', alt: 'Dokumentasi kegiatan sekolah 2' },
  { src: '/assets/kegiatan-3.jpg', alt: 'Dokumentasi kegiatan sekolah 3' },
];
const instagramPhotos = [
  { src: '/assets/instagram-1.jpg', alt: 'Foto unggahan Instagram SDN Bangah 1' },
  { src: '/assets/instagram-2.jpg', alt: 'Foto unggahan Instagram SDN Bangah 2' },
  { src: '/assets/instagram-3.jpg', alt: 'Foto unggahan Instagram SDN Bangah 3' },
];

function GalleryPhoto({ photo }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="gallery-photo">
      {failed ? (
        <div className="gallery-photo-empty" role="status"><span>Foto belum ditambahkan</span></div>
      ) : (
        <img src={photo.src} alt={photo.alt} loading="lazy" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

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

export default function PublicProfile({ initialSite = null }) {
  const [site, setSite] = useState(initialSite);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/site', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data) setSite(data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const displayName = site?.meta?.schoolName || school.name;
  // The backend uses meta.address; prefer it when available.
  const displayAddress = site?.meta?.address || school.address;
  const closeMenu = () => setMenuOpen(false);
  return (
    <div className="static-public-profile" id="home">
      <style dangerouslySetInnerHTML={{ __html: profileStyles }} />
      <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
      <header className="header">
        <div className="site-shell header-inner">
          <a className="brand" href="#home" onClick={closeMenu}>
            {logoUnavailable ? <span className="brand-logo brand-logo--fallback" aria-hidden="true">SD</span> : <img className="brand-logo" src={schoolLogo.src} alt="Logo SDN Bangah" onError={() => setLogoUnavailable(true)} />}
            <span className="brand-name">SDN Bangah<small style={{display:'block'}}>Sekolah Dasar Negeri</small></span>
          </a>
          <button className="menu-toggle" type="button" aria-controls="public-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? 'Tutup' : 'Menu'}</button>
          <nav className={`nav${menuOpen ? ' is-open' : ''}`} id="public-navigation" aria-label="Navigasi utama">
            <a href="#home" onClick={closeMenu}>Beranda</a><a href="#profil" onClick={closeMenu}>Profil</a><a href="#berita" onClick={closeMenu}>Kegiatan & Berita</a><a href="#informasi" onClick={closeMenu}>Informasi</a>
          </nav>
          <a className="btn-login" href="/login">Portal Guru</a>
        </div>
      </header>
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title" style={{
          backgroundImage: `linear-gradient(90deg, rgba(8, 25, 51, 0.76) 0%, rgba(12, 34, 70, 0.56) 48%, rgba(12, 38, 76, 0.40) 100%), url("${schoolPhoto.src}")`,
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}>
          <div className="hero-content">
            <p className="hero-school">Selamat datang di SD Negeri Bangah</p>
            <h1 className="hero-title" id="hero-title">Membangun karakter. Menginspirasi masa depan.</h1>
            <p className="hero-desc">Bersama membentuk generasi yang beriman, kreatif, mandiri, dan siap meraih prestasi.</p>
            <div className="hero-actions"><a className="button-primary" href="#profil">Mengenal Sekolah <span aria-hidden="true">&nbsp;↗</span></a><a className="button-outline" href="#informasi">Informasi Akademik</a></div>
            <div className="hero-bottom">Belajar, bertumbuh, dan berprestasi bersama.</div>
          </div>
        </section>
        <section className="section" id="profil">
          <div className="site-shell">
            <div className="section-heading"><p className="section-label">Tentang Kami</p><h2>Mengenal SD Negeri Bangah</h2><p>Lingkungan belajar yang mendukung tumbuh kembang dan karakter setiap peserta didik.</p></div>
            <div className="profile-grid">
              <div className="profile-copy"><p>SD Negeri Bangah merupakan salah satu lembaga pendidikan dasar negeri yang terletak di Kecamatan Gedangan, Kabupaten Sidoarjo. Berdiri di tengah lingkungan masyarakat yang kondusif, sekolah ini berkomitmen memberikan pelayanan pendidikan terbaik guna mencetak generasi muda yang cerdas, berkarakter, serta berdaya saing di era digital.</p><p>Sebagai sekolah dasar, SDN Bangah terus beradaptasi dengan perkembangan zaman melalui penerapan kurikulum nasional terkini, integrasi teknologi pembelajaran, serta pembentukan karakter peserta didik berlandaskan nilai-nilai keimanan, kedisiplinan, dan kreativitas.</p></div>
              <div className="info-card"><div className="info-card-title">Identitas Sekolah</div><dl className="info-body"><dt>Nama Sekolah</dt><dd>{displayName}</dd><dt>NPSN</dt><dd>{school.npsn}</dd><dt>Jenjang</dt><dd>{school.type}</dd><dt>Status</dt><dd>{school.status}</dd><dt>Alamat</dt><dd>{displayAddress}</dd></dl></div>
            </div>
            <div className="principles"><article className="vision-card"><p className="section-label">Arah Kami</p><h3>Visi Sekolah</h3><p>“Terwujudnya Generasi Unggul, Berkarakter Beriman, Kreatif, dan Berprestasi Menuju Masa Depan Cemerlang.”</p></article><article className="mission-card"><p className="section-label">Langkah Kami</p><h3>Misi Sekolah</h3><ol>{mission.map(item => <li key={item}>{item}</li>)}</ol></article></div>
          </div>
        </section>
        <section className="section section--light" id="berita">
          <div className="site-shell">
            <div className="section-heading"><p className="section-label">Kehidupan Sekolah</p><h2>Momen yang tumbuh bersama.</h2><p>Dokumentasi kegiatan dan cerita keseharian SDN Bangah.</p></div>
            <div className="gallery-grid">
              <article className="gallery-card">
                <div className="gallery-card-head"><div><p className="section-label">Galeri</p><h3>Kegiatan Sekolah</h3></div><span className="gallery-chip">Dokumentasi</span></div>
                <div className="photo-grid">{activityPhotos.map(photo => <GalleryPhoto key={photo.src} photo={photo} />)}</div>
                <p className="gallery-caption">Foto-foto kegiatan siswa dan lingkungan sekolah.</p>
              </article>
              <article className="gallery-card">
                <div className="gallery-card-head"><div><p className="section-label">Media Sosial</p><h3>Instagram Sekolah</h3></div><span className="gallery-chip">@sdnbangah</span></div>
                <div className="photo-grid">{instagramPhotos.map(photo => <GalleryPhoto key={photo.src} photo={photo} />)}</div>
                <a className="instagram-link" href="https://www.instagram.com/sdnbangah/" target="_blank" rel="noopener noreferrer">Kunjungi Instagram @sdnbangah <span aria-hidden="true">↗</span></a>
                <p className="gallery-caption">Foto Instagram ditampilkan dari aset lokal agar tetap stabil. Unggahan otomatis memerlukan integrasi backend/Meta API.</p>
              </article>
            </div>
            <article className="news-card"><div><p className="section-label">Berita Sekolah</p><h3>Informasi terbaru untuk warga sekolah</h3><p>Berita terbaru akan ditampilkan setelah konten dipublikasikan.</p></div><div className="news-mark" aria-hidden="true">✎</div></article>
          </div>
        </section>
        <section className="section" id="informasi"><div className="site-shell"><div className="section-heading"><p className="section-label">Informasi Akademik</p><h2>Kalender & Agenda Sekolah</h2><p>Contoh kalender dan daftar kegiatan untuk membantu melihat jadwal sekolah.</p></div><div className="information-grid"><article className="panel"><div className="panel-head"><h3>Kalender Akademik</h3><p>Tahun Ajaran 2025/2026 — contoh data</p></div><div className="calendar"><h4 className="month">September 2025</h4><div className="days-header">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d => <span key={d}>{d}</span>)}</div><div className="days-grid">{calendarDays.map((day,index) => <div key={index} className={`day${index%7>=5?' weekend':''}`}><span className="num">{day || ''}</span>{day && septemberEvents[day] && <span className="event">{septemberEvents[day]}</span>}</div>)}</div></div><p className="info-note">Kalender ini adalah contoh September 2025, bukan jadwal aktif.</p></article><article className="panel"><div className="panel-head"><h3>Daftar Kegiatan</h3><p>Agenda September 2025 (contoh)</p></div><ul className="activity-list">{Object.entries(septemberEvents).map(([day,label]) => <li key={day}><strong>{day} Sep</strong><span>{label}</span></li>)}</ul></article></div></div></section>
      </main>
      <footer className="footer"><div className="site-shell footer-inner"><strong>SD Negeri Bangah</strong><p>Belajar dengan karakter, melangkah menuju masa depan.</p></div></footer>
    </div>
  );
}
