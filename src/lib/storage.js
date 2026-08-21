// ============================================================
// localStorage bilan ishlash uchun kichik yordamchi funksiyalar.
// Bu fayl hech qanday React/UI kodini bilmaydi — faqat "saqlash/o'qish".
// ============================================================

/**
 * Foydalanuvchiga xos (email asosida) localStorage kaliti yasaydi.
 * Masalan: storageKey('toshkentgpt.sessions.v1', 'a@b.com') -> 'toshkentgpt.sessions.v1.a_b_com'
 */
export function storageKey(base, email) {
  const safe = (email || 'mehmon').replace(/[^a-zA-Z0-9]/g, '_');
  return `${base}.${safe}`;
}

/** localStorage'dan JSON o'qiydi; xato bo'lsa yoki topilmasa — fallback qaytaradi. */
export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** localStorage'ga JSON yozadi; muvaffaqiyatli bo'lsa true qaytaradi. */
export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
