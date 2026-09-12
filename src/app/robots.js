// /robots.txt — qidiruv tizimlariga qaysi sahifalarni ko'rish mumkinligini
// aytadi va sitemap manzilini beradi.

const SITE_URL = 'https://toshkentgpt.uz';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/sozlamalar',
          '/mening-malumotlarim',
          '/bildirishnomalar',
          '/fayllar',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}