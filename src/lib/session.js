// ============================================================
// Suhbat (session) obyektlari bilan bog'liq sof funksiyalar —
// yangi suhbat yasash, sarlavha chiqarish va h.k. React'ga bog'liq emas.
// ============================================================

/**
 * Vaqt (Date) qo'yilmagan holatda — server va mijoz birinchi renderda bir xil
 * HTML chiqarishi uchun (aks holda "hydration mismatch" xatosi chiqadi).
 */
export function blankWelcome(name) {
  return {
    id: 'welcome',
    role: 'assistant',
    content: name
      ? `Nima gap, ${name} jigar? Men ToshkentGPT — savol ber, rasm/fayl tashla yoki shunchaki salomlash 👋`
      : 'Nima gap, jigar? Men ToshkentGPT — savol ber, rasm/fayl tashla yoki shunchaki salomlash 👋',
    time: null,
  };
}

export function stampNow(message) {
  return { ...message, time: new Date().toISOString() };
}

/** SSR-xavfsiz boshlang'ich holat (Date chaqirmaydi) — useState initializerida ishlatiladi. */
export function newSession() {
  return {
    id: crypto.randomUUID(),
    title: 'Yangi suhbat',
    messages: [blankWelcome()],
    lastInteractionId: null,
    updatedAt: null,
  };
}

/** Faqat mijoz tomonida (useEffect/handler ichida) chaqiriladigan versiya — haqiqiy vaqt bilan. */
export function freshSession(name) {
  return {
    id: crypto.randomUUID(),
    title: 'Yangi suhbat',
    messages: [stampNow(blankWelcome(name))],
    lastInteractionId: null,
    updatedAt: new Date().toISOString(),
  };
}

export function sessionTitle(messages) {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'Yangi suhbat';
  const text = firstUser.content?.trim() || 'Rasm/fayl yubordi';
  return text.length > 30 ? `${text.slice(0, 30)}…` : text;
}
