'use client';

import { useId } from 'react';

// ============================================================
// Fon uchun yumshoq, o'zbek girih naqshiga o'xshash geometrik SVG naqsh.
// Sof "presentational" komponent — hech qanday state yoki props qabul qilmaydi.
//
// useId() bilan har bir <GirihPattern /> nusxasi o'ziga xos <pattern id> oladi —
// aks holda sahifada bu komponent ikki joyda bir vaqtda render bo'lganda
// (masalan asosiy sahifa + tanishuv oynasi ustma-ust chiqqanda) ikkita
// bir xil id (HTML'da noto'g'ri) hosil bo'lardi.
export default function GirihPattern() {
  const patternId = useId();

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]">
      <defs>
        <pattern id={patternId} width="64" height="64" patternUnits="userSpaceOnUse">
          <g stroke="#E4A93B" strokeWidth="1" fill="none">
            <path d="M32 4 L48 20 L32 36 L16 20 Z" />
            <path d="M32 36 L48 52 L32 68 L16 52 Z" />
            <circle cx="0" cy="0" r="14" />
            <circle cx="64" cy="0" r="14" />
            <circle cx="0" cy="64" r="14" />
            <circle cx="64" cy="64" r="14" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
