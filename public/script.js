const navigation = document.querySelector('#primary-navigation');
const menuToggle = document.querySelector('#menu-toggle');
const pageIds = ['home', 'profil', 'informasi', 'galeri', 'berita', 'pendaftaran', 'artikel'];
const pages = pageIds.map((id) => document.getElementById(id));
const internalLinks = [...document.querySelectorAll('a[href^="#"]')];

function getPageId() {
  const requestedPage = window.location.hash.slice(1);
  if (requestedPage.startsWith('artikel/')) return 'artikel';
  return pageIds.includes(requestedPage) ? requestedPage : 'home';
}

function getArticleId() {
  const requestedPage = window.location.hash.slice(1);
  return requestedPage.startsWith('artikel/') ? requestedPage.slice('artikel/'.length) : '';
}

function showPage(pageId, updateHistory = false) {
  const activePage = pageIds.includes(pageId) ? pageId : 'home';
  pages.forEach((page) => {
    const isActive = page.id === activePage;
    page.hidden = !isActive;
    page.classList.toggle('is-current', isActive);
  });
  navigation.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href') === `#${activePage}` || (['berita', 'artikel'].includes(activePage) && link.getAttribute('href') === '#informasi'));
  });
  if (activePage === 'artikel') renderArticleDetail(getArticleId());
  if (updateHistory && window.location.hash !== `#${activePage}`) {
    window.history.pushState({}, '', `#${activePage}`);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

pages.forEach((page) => page.classList.add('page-view'));
showPage(getPageId());

internalLinks.forEach((link) => {
  const targetId = link.getAttribute('href').slice(1);
  if (!pageIds.includes(targetId)) return;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    showPage(targetId, true);
  });
});

window.addEventListener('popstate', () => showPage(getPageId()));
window.addEventListener('hashchange', () => showPage(getPageId()));

function setText(selector, value) {
  const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (element && value) element.textContent = value;
}

function setPhoto(element, item) {
  if (!element || !item) return;
  const label = item.imageLabel || item.title;
  const labelElement = element.querySelector('span');
  if (labelElement) labelElement.textContent = label;
  if (item.imageUrl) {
    element.style.backgroundImage = `url("${item.imageUrl}")`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.style.color = 'white';
  }
}

function renderGallery(activities) {
  const galleryGrid = document.querySelector('.gallery-grid');
  if (!galleryGrid) return;
  const orderedActivities = [...activities].sort((first, second) => {
    const firstDate = first.updatedAt || first.createdAt;
    const secondDate = second.updatedAt || second.createdAt;
    if (!firstDate || !secondDate) return 0;
    return new Date(secondDate) - new Date(firstDate);
  });
  const tileColors = ['photo-placeholder--mint', 'photo-placeholder--yellow', 'photo-placeholder--coral', 'photo-placeholder--green'];
  galleryGrid.replaceChildren(...orderedActivities.map((item, index) => {
    const tile = document.createElement('article');
    tile.className = 'gallery-tile';
    const photo = item.imageUrl ? document.createElement('img') : document.createElement('div');
    photo.className = item.imageUrl ? 'gallery-image' : `photo-placeholder ${tileColors[index % tileColors.length]}`;
    const label = document.createElement('span');
    label.textContent = item.imageLabel || item.title || 'Foto kegiatan';
    if (item.imageUrl) {
      photo.src = item.imageUrl;
      photo.alt = item.imageLabel || item.title || 'Foto kegiatan sekolah';
    } else photo.append(label);
    const caption = document.createElement('div');
    caption.className = 'gallery-caption';
    const title = document.createElement('h3');
    title.textContent = item.title || 'Kegiatan sekolah';
    const category = document.createElement('span');
    category.textContent = item.label || 'Dokumentasi kegiatan';
    caption.append(category, title);
    tile.append(photo, caption);
    return tile;
  }));
}

function renderArticleArchive(posts) {
  const articleList = document.querySelector('#article-list');
  if (!articleList) return;
  articleList.replaceChildren(...posts.map((post) => {
    const article = document.createElement('article');
    article.className = 'article-card';
    const meta = document.createElement('span');
    meta.className = 'article-card__meta';
    meta.textContent = `${post.date || 'Informasi sekolah'} · ${post.category || 'Berita'}`;
    const title = document.createElement('h3');
    title.textContent = post.title || 'Artikel sekolah';
    const excerpt = document.createElement('p');
    excerpt.textContent = post.excerpt || 'Belum ada ringkasan artikel.';
    const readMore = document.createElement('a');
    readMore.className = 'article-card__link';
    readMore.href = `#artikel/${post.id}`;
    readMore.dataset.articleId = post.id;
    readMore.textContent = 'Baca selengkapnya ↗';
    article.append(meta, title, excerpt, readMore);
    return article;
  }));
}

function renderArticleDetail(articleId) {
  const detail = document.querySelector('#article-detail-content');
  if (!detail) return;
  const post = window.publicPosts?.find((item) => item.id === articleId);
  if (!post) {
    detail.innerHTML = '<p class="section-label">Informasi sekolah</p><h2>Artikel tidak ditemukan.</h2><p>Artikel yang kamu cari belum tersedia atau sudah dihapus.</p>';
    return;
  }
  detail.replaceChildren();
  const label = document.createElement('p');
  label.className = 'section-label';
  label.textContent = post.category || 'Informasi sekolah';
  const title = document.createElement('h2');
  title.id = 'article-detail-title';
  title.textContent = post.title || 'Artikel sekolah';
  const meta = document.createElement('p');
  meta.className = 'article-detail__meta';
  meta.textContent = post.date || 'Informasi sekolah';
  const image = post.imageUrl ? document.createElement('img') : null;
  if (image) { image.src = post.imageUrl; image.alt = post.imageLabel || post.title; image.className = 'article-detail__image'; }
  const body = document.createElement('div');
  body.className = 'article-detail__body';
  body.textContent = post.content || post.excerpt || 'Belum ada isi artikel.';
  detail.append(label, title, meta);
  if (image) detail.append(image);
  detail.append(body);
}

async function loadPublicContent() {
  try {
    const response = await fetch('/api/site');
    if (!response.ok) return;
    const site = await response.json();
    const meta = site.meta || {};
    setText('#home .section-label', meta.eyebrow);
    setText('#home h1', meta.schoolName || meta.heroTitle);
    setText('#home .hero-subtitle', meta.heroDescription);
    setText('#profil h2', meta.aboutTitle);
    setText('#profil .profile-lead', meta.aboutDescription);
    const profileParagraphs = document.querySelectorAll('#profil .profile-copy > p');
    if (profileParagraphs[0] && meta.aboutBody) profileParagraphs[0].textContent = meta.aboutBody;
    document.querySelectorAll('.utility-bar a').forEach((link) => {
      if (link.href.startsWith('mailto:') && meta.contactEmail) { link.href = `mailto:${meta.contactEmail}`; link.textContent = meta.contactEmail; }
      if (link.href.startsWith('tel:') && meta.phone) { link.textContent = meta.phone; }
    });
    renderGallery(site.activities || []);
    const posts = site.posts || [];
    window.publicPosts = posts;
    renderArticleArchive(posts);
    const feature = document.querySelector('.feature-news');
    if (feature && posts[0]) { setText(feature.querySelector('.news-date'), `${posts[0].date || ''} · ${posts[0].category || ''}`); setText(feature.querySelector('h3'), posts[0].title); setText(feature.querySelector('p:not(.news-date)'), posts[0].excerpt); }
    document.querySelectorAll('.news-card').forEach((card, index) => {
      const post = posts[index + 1];
      if (!post) return;
      setText(card.querySelector('.news-date'), post.date);
      setText(card.querySelector('h3'), post.title);
    });
    const primaryLinks = [document.querySelector('.feature-news a'), ...document.querySelectorAll('.news-card a')];
    primaryLinks.forEach((link, index) => {
      const post = posts[index];
      if (!link || !post) return;
      link.href = `#artikel/${post.id}`;
      link.dataset.articleId = post.id;
    });
    if (getPageId() === 'artikel') renderArticleDetail(getArticleId());
  } catch (error) {
    console.warn('Konten publik belum dapat dimuat dari CMS.', error);
  }
}

loadPublicContent();

document.addEventListener('click', (event) => {
  const articleLink = event.target.closest('a[data-article-id]');
  if (!articleLink) return;
  event.preventDefault();
  window.history.pushState({}, '', `#artikel/${articleLink.dataset.articleId}`);
  showPage('artikel');
});

menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  navigation.classList.toggle('show', !isOpen);
});

navigation.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    navigation.classList.remove('show');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

const form = document.querySelector('#contact-form');
const formStatus = document.querySelector('#form-status');
const submitButton = document.querySelector('#form-submit');
const fields = [...form.querySelectorAll('input, textarea')];

function setFieldMessage(field, message = '') {
  const wrapper = field.closest('.form-field');
  wrapper.classList.toggle('has-error', Boolean(message));
  wrapper.querySelector(`[data-for="${field.name}"]`).textContent = message;
}

function validateField(field) {
  if (!field.value.trim()) {
    setFieldMessage(field, `${field.labels[0].textContent} perlu diisi.`);
    return false;
  }
  if (field.type === 'email' && !field.validity.valid) {
    setFieldMessage(field, 'Gunakan alamat email yang masih aktif.');
    return false;
  }
  setFieldMessage(field);
  return true;
}

fields.forEach((field) => field.addEventListener('blur', () => validateField(field)));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const isValid = fields.map(validateField).every(Boolean);
  formStatus.textContent = '';
  if (!isValid) {
    formStatus.textContent = 'Periksa kembali kolom yang ditandai.';
    fields.find((field) => field.closest('.form-field').classList.contains('has-error'))?.focus();
    return;
  }
  submitButton.classList.add('is-loading');
  submitButton.setAttribute('aria-busy', 'true');
  window.setTimeout(() => {
    submitButton.classList.remove('is-loading');
    submitButton.removeAttribute('aria-busy');
    formStatus.textContent = 'Pesan sudah siap dicatat. Tim sekolah akan menghubungi kamu melalui email.';
    form.reset();
  }, 700);
});
