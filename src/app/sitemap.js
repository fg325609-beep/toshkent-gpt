// /sitemap.xml — Google'ga ochiq sahifalar ro'yxatini beradi.
// Yangi ochiq sahifa qo'shsangiz, shu ro'yxatga ham qo'shing.

const SITE_URL = 'https://toshkentgpt.uz';

const PAGES = [
  { path: '', priority: 1.0, changeFrequency: 'daily' },
  { path: '/toshkentgpt-nima', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/yordam', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/maxfiylik-siyosati', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/foydalanish-shartlari', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap() {
  const now = new Date();

  return PAGES.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}