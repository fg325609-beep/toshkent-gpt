import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ============================================================
// Dinamik OG rasm (1200×630) — havola Telegram, Instagram, WhatsApp,
// Facebook, X, LinkedIn va boshqalarda ulashilganda chiqadigan karta.
// Brend ranglari, logotip va "nima qila oladi" ro'yxati bilan — statik
// public/og-image.png o'rniga kod orqali chiziladi (o'zgartirish oson).
// ============================================================

export const alt = 'ToshkentGPT — koʻcha tilida gaplashuvchi AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function loadLogo() {
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'icons', 'logo-4k.png'));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const FEATURES = ['Suhbat', 'Rasm', 'Kod', 'Video va hujjat', 'Podkast → klip', 'Ovoz'];

export default async function Image() {
  const logo = await loadLogo();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: 'linear-gradient(135deg, #0A0A0B 0%, #14161C 55%, #0E1B1A 100%)',
          color: '#F3F4F6',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Orqa fon nurlari */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(228,169,59,0.35), rgba(228,169,59,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            left: -80,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(47,158,150,0.32), rgba(47,158,150,0) 70%)',
            display: 'flex',
          }}
        />

        {/* Yuqori: logo + nom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 128,
              height: 128,
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #2F9E96, #E4A93B)',
              padding: 5,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 9999,
                background: '#0A0A0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {logo ? (
                <img src={logo} width={110} height={110} style={{ borderRadius: 9999 }} alt="" />
              ) : (
                <div style={{ fontSize: 56, fontWeight: 800, color: '#E4A93B', display: 'flex' }}>T</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                letterSpacing: -2,
                background: 'linear-gradient(90deg, #F3EEE2, #E4A93B)',
                backgroundClip: 'text',
                color: 'transparent',
                display: 'flex',
              }}
            >
              ToshkentGPT
            </div>
            <div style={{ fontSize: 28, color: '#9CA3AF', display: 'flex', marginTop: 2 }}>
              koʻcha tilida gaplashuvchi sunʼiy intellekt
            </div>
          </div>
        </div>

        {/* O'rta: asosiy matn */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.2, display: 'flex', maxWidth: 980 }}>
            Savol ber, rasm/video/fayl tashla — oʻzbekcha, samimiy, aqlli javob.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
            {FEATURES.map((f) => (
              <div
                key={f}
                style={{
                  display: 'flex',
                  padding: '10px 20px',
                  borderRadius: 9999,
                  border: '2px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.05)',
                  fontSize: 24,
                  color: '#E5E7EB',
                }}
              >
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Past: sayt */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 26, color: '#2F9E96', fontWeight: 700, display: 'flex' }}>toshkentgpt.uz</div>
          <div style={{ fontSize: 22, color: '#6B7280', display: 'flex' }}>Veb · Telegram · Telefon ilovasi</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
