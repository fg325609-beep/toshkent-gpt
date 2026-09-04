// ============================================================
// Yengil, global bildirishnoma (toast) tizimi — hech qanday tashqi
// kutubxonasiz. `showToast(...)` istalgan joydan (hatto komponent
// bo'lmagan joydan ham) chaqirilishi mumkin; <ToastContainer /> esa
// layout.jsx'da BIR MARTA joylashtiriladi va barcha bildirishnomalarni
// ko'rsatadi — prop orqali uzatib yurish shart emas.
// ============================================================
let toasts = [];
let listeners = [];
 
function notify() {
  listeners.forEach((l) => l(toasts));
}
 
export function subscribeToasts(listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
 
export function getToasts() {
  return toasts;
}
 
export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}
 
/** type: 'success' | 'error' | 'info' */
export function showToast(message, type = 'info', duration = 4000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts = [...toasts, { id, message, type }];
  notify();
  if (duration) {
    setTimeout(() => dismissToast(id), duration);
  }
  return id;
}
 