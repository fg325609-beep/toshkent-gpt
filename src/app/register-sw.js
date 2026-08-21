'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // Development'da (npm run dev) service worker kerak emas — u so'rovlarni
      // ushlab qolib, Turbopack'ning jonli yangilanishlarini (HMR) "muzlatib"
      // qo'yishi mumkin. Ilgari (masalan avvalgi test paytida) ro'yxatdan
      // o'tgan eski worker qolgan bo'lsa, uni ham avtomatik o'chirib tashlaymiz —
      // aks holda kod to'g'ri bo'lsa ham brauzerda eski holat ko'rinaveradi.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
