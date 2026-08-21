// ============================================================
// Matn va vaqtni foydalanuvchiga chiroyli ko'rsatish uchun sof funksiyalar.
// ============================================================

export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'hozir';
  if (mins < 60) return `${mins} daq oldin`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.round(hours / 24);
  return `${days} kun oldin`;
}

/**
 * Ovozda o'qishdan oldin markdown belgilarini (**, #, kod bloklari va h.k.) tozalaydi —
 * aks holda "yulduzcha yulduzcha" kabi belgilar ovozda eshitiladi.
 */
export function stripMarkdown(text) {
  return (text || '')
    .replace(/```[\s\S]*?```/g, ' kod boʻlagi ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~#>]+/g, '')
    .replace(/\n{2,}/g, '. ')
    .trim();
}
