// Shared browser/server helpers. All calendar dates are date-only, without UTC shifts.
const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const mission = [
  'Menanamkan Nilai Religius & Karakter: Mengintegrasikan nilai-nilai keimanan, ketakwaan, dan Budi Pekerti Luhur dalam setiap aktivitas pembelajaran sehari-hari.',
  'Mengembangkan Potensi Akademik & Non-Akademik: Menyediakan sarana dan bimbingan belajar yang berkualitas untuk mendorong siswa meraih prestasi tinggi di bidang akademik, seni, maupun olahraga.',
  'Mewujudkan Lingkungan Belajar Kreatif & Inovatif: Menerapkan metode pembelajaran yang aktif, menyenangkan, dan berwawasan teknologi untuk melatih keterampilan berpikir kritis.',
  'Membangun Budaya Kolaboratif: Menjalin kerja sama yang erat dan harmonis antara pihak sekolah, orang tua, serta masyarakat sekitar.',
  'Membentuk Sikap Mandiri & Peduli Lingkungan: Menumbuhkan rasa tanggung jawab, kepemimpinan, serta kepedulian terhadap kebersihan dan kelestarian lingkungan sekolah.',
];

const defaults = {
  schoolName: 'SD Negeri Bangah (SDN Bangah No. 383)', shortName: 'SDN Bangah', npsn: '383',
  schoolType: 'Sekolah Dasar (SD)', schoolStatus: 'Negeri',
  address: 'Jl. Singojoyo III No. 1, Dusun Bangah Barat, Desa Bangah, Kec. Gedangan, Kabupaten Sidoarjo, Jawa Timur 61254',
  eyebrow: 'Selamat datang di SD Negeri Bangah',
  heroTitle: 'Membangun karakter. Menginspirasi masa depan.',
  heroDescription: 'Bersama membentuk generasi yang beriman, kreatif, mandiri, dan siap meraih prestasi.',
  aboutTitle: 'Mengenal SD Negeri Bangah',
  aboutDescription: 'Lingkungan belajar yang mendukung tumbuh kembang dan karakter setiap peserta didik.',
  aboutBody: 'SD Negeri Bangah merupakan salah satu lembaga pendidikan dasar negeri yang terletak di Kecamatan Gedangan, Kabupaten Sidoarjo. Sekolah ini berkomitmen memberikan pelayanan pendidikan terbaik guna mencetak generasi muda yang cerdas dan berkarakter.',
  vision: 'Terwujudnya Generasi Unggul, Berkarakter Beriman, Kreatif, dan Berprestasi Menuju Masa Depan Cemerlang.',
  mission: mission.join('\n'), logoUrl: '/assets/logo-sekolah.png', heroImageUrl: '/assets/SDN.jpg',
  instagramUrl: 'https://www.instagram.com/sdnbangah/', year: '', phone: '', contactEmail: '',
};

function text(meta, key) { return typeof meta?.[key] === 'string' ? meta[key] : defaults[key] || ''; }
function missionItems(value) {
  if (value === undefined || value === null) return mission;
  return (Array.isArray(value) ? value : String(value).split(/\r?\n/)).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
}

function parseDate(value) {
  if (typeof value !== 'string') return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const local = /^(\d{1,2})\s+([^\s]+)\s+(\d{4})$/.exec(value.trim());
  if (!iso && !local) return null;
  const year = Number(iso ? iso[1] : local[3]);
  const month = iso ? Number(iso[2]) : months.findIndex((name) => name.toLowerCase() === local[2].toLowerCase()) + 1;
  const day = Number(iso ? iso[3] : local[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? `${date.day} ${months[date.month - 1]} ${date.year}` : (typeof value === 'string' && value ? value : 'Tanggal belum ditentukan');
}

function today(reference = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(reference);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function calendar(monthKey, agenda) {
  const selected = parseDate(`${monthKey}-01`);
  if (!selected) return null;
  const start = (new Date(Date.UTC(selected.year, selected.month - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(selected.year, selected.month, 0)).getUTCDate();
  const events = new Map();
  for (const event of agenda) {
    const date = parseDate(event.date);
    if (date?.year === selected.year && date.month === selected.month) events.set(date.day, [...(events.get(date.day) || []), event]);
  }
  return {
    label: `${months[selected.month - 1]} ${selected.year}`,
    days: Array.from({ length: Math.ceil((start + length) / 7) * 7 }, (_, index) => {
      const day = index - start + 1;
      return { day: day > 0 && day <= length ? day : null, weekend: index % 7 >= 5, events: events.get(day) || [] };
    }),
  };
}

function shiftMonth(monthKey, delta) {
  const current = parseDate(`${monthKey}-01`);
  if (!current) return today().slice(0, 7);
  const date = new Date(Date.UTC(current.year, current.month - 1 + delta, 1));
  if (date.getUTCFullYear() < 1000 || date.getUTCFullYear() > 9999) return monthKey;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function safeUrl(value, image = false) {
  if (typeof value !== 'string' || !value || /[\u0000-\u001f]/.test(value)) return '';
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  if (image && /^data:image\/(png|jpeg|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? value : ''; } catch { return ''; }
}

function invalid(message) { const error = new Error(message); error.status = 400; throw error; }
function validateImage(value) {
  if (typeof value !== 'string' || value.length > 6 * 1024 * 1024 || (value && !safeUrl(value, true))) invalid('URL atau ukuran gambar tidak valid. Gunakan JPG, PNG, GIF, WebP, atau AVIF.');
}

function validatePublicRecord(collection, item) {
  for (const key of ['title', 'description', 'excerpt', 'content', 'label', 'category', 'date', 'time', 'imageLabel']) {
    if (item[key] !== undefined && (typeof item[key] !== 'string' || item[key].length > (key === 'content' ? 100000 : 10000))) invalid(`Kolom ${key} tidak valid.`);
  }
  if (item.imageUrl !== undefined) validateImage(item.imageUrl);
  if (item.date && !parseDate(item.date)) invalid('Tanggal harus valid, misalnya 2026-11-13 atau 13 November 2026.');
  return item;
}

function validateSiteMeta(meta) {
  for (const key of Object.keys(defaults)) {
    if (meta[key] === undefined) continue;
    if (['logoUrl', 'heroImageUrl'].includes(key)) { validateImage(meta[key]); continue; }
    if (key === 'mission' && Array.isArray(meta[key]) && meta[key].every((item) => typeof item === 'string' && item.length <= 10000)) continue;
    if (typeof meta[key] !== 'string' || meta[key].length > 50000) invalid(`Kolom ${key} tidak valid.`);
  }
  if (meta.instagramUrl && !safeUrl(meta.instagramUrl)) invalid('Alamat Instagram harus berupa URL http atau https.');
  if (meta.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(meta.contactEmail)) invalid('Alamat email sekolah tidak valid.');
}

module.exports = { defaults, months, text, missionItems, parseDate, formatDate, today, calendar, shiftMonth, safeUrl, validatePublicRecord, validateSiteMeta };
