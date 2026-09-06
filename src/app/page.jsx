'use client';
 
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
 
import { PLANS } from './plans';
import { storageKey, loadJSON, saveJSON } from '@/lib/storage';
import { blankWelcome, stampNow, newSession, freshSession, sessionTitle } from '@/lib/session';
import { stripMarkdown } from '@/lib/format';
import { fileToDataUrl, fileToText } from '@/lib/files';
import { showToast } from '@/lib/toast';
import { APP_VERSION, CHANGELOG } from '@/lib/version';
import { isPushSupported, subscribeToPush, getCurrentPushSubscription } from '@/lib/push';
 
import SignInScreen from '@/components/SignInScreen';
import SplashScreen from '@/components/SplashScreen';
import OnboardingFlow from '@/components/OnboardingFlow';
import GirihPattern from '@/components/GirihPattern';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';
import PlansModal from '@/components/PlansModal';
import WhatsNewModal from '@/components/WhatsNewModal';
import { useTheme } from './use-theme';
 
// ============================================================
// Kirish darvozasi — avval Google orqali autentifikatsiyani tekshiradi.
// ============================================================
export default function ToshkentGPTGate() {
  const { data: authData, status } = useSession();
 
  // Referral havolasi orqali kirilgan bo'lsa ("?ref=KOD"), buni ENG BIRINCHI
  // fursatda (hali tizimga kirmagan bo'lsa ham) saqlab qo'yamiz — chunki
  // Google orqali kirish (redirect) jarayonida URL'dagi parametr yo'qolib
  // qolishi mumkin, localStorage esa saqlanib qoladi.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      localStorage.setItem('tg-pending-referral', ref.toUpperCase().trim());
    }
  }, []);
 
  if (status === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--tg-bg)]">
        <img src="/icons/logo-header.png" alt="ToshkentGPT" className="tg-splash-logo h-16 w-16" />
      </div>
    );
  }
 
  if (status !== 'authenticated') {
    return <SignInScreen />;
  }
 
  return <ToshkentGPT user={authData.user} />;
}
 
// ============================================================
// Asosiy chat ilovasi — foydalanuvchi tasdiqlangandan keyingina ishga tushadi.
// Bu komponent barcha holatni (state) o'zida ushlaydi va uni pastki
// komponentlarga (Header, Sidebar, ChatMessages, ChatInput, modallar) props
// orqali uzatadi. Har bir komponentning o'zi qanday ko'rinishini
// src/components/ papkasidagi tegishli faylida ko'rish mumkin.
// ============================================================
function ToshkentGPT({ user }) {
  const router = useRouter();
  const userEmail = user?.email || null;
  const SESSIONS_KEY = storageKey('toshkentgpt.sessions.v1', userEmail);
  const ACTIVE_KEY = storageKey('toshkentgpt.activeId.v1', userEmail);
  const ALIVE_KEY = storageKey('toshkentgpt.alive', userEmail);
  const PROFILE_KEY = storageKey('toshkentgpt.profile.v1', userEmail);
 
  const [session, setSession] = useState(newSession);
  const [sessions, setSessions] = useState([]);
  const [profile, setProfile] = useState({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [ttsLoadingId, setTtsLoadingId] = useState(null);
  const [audioCache, setAudioCache] = useState({}); // { [msgId]: base64Mp3 } — qayta so'ramaslik uchun
  const [deepThink, setDeepThink] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
 
  // --- Ro'yxatdan o'tishdagi bosqichli tanishuv (ism-familiya so'rash) ---
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [obStep, setObStep] = useState(1);
  const [obIsm, setObIsm] = useState('');
  const [obFamiliya, setObFamiliya] = useState('');
 
  // Tarif belgisi (Sozlamalar menyusidagi "Lite"/"Pro" kabi yozuv) uchun —
  // /tariflar va /shikoyat endi alohida sahifalar, shu yerda faqat hozirgi
  // tarifni bilib turish kifoya.
  const [planInfo, setPlanInfo] = useState(null); // { id, name, mode, limit, used, remaining, resetAt }
 
  // PlansModal — endi faqat chatda limitga/sinov muddatiga yetilganda ("interrupt"
  // sifatida) ochiladi. Oddiy "Tariflar" havolasi esa alohida /tariflar sahifasiga olib boradi.
  const [plansOpen, setPlansOpen] = useState(false);
  const [plansView, setPlansView] = useState('list'); // list | trial-ended | pay
  const [paymentPlanId, setPaymentPlanId] = useState('pro');
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | sending | sent | error
  const [trialStarting, setTrialStarting] = useState(false);
  const [trialEndInfo, setTrialEndInfo] = useState(null); // { planId, unlockAt }
 
  const [showSplash, setShowSplash] = useState(true);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
 
  const { theme, toggleTheme } = useTheme();
 
  const textareaRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const audioRef = useRef(null);
 
  // --- Ilova ochilganda: profil + suhbatlarni tiklash ---
  // Agar bu shunchaki sahifa yangilanishi bo'lsa (F5), oxirgi suhbat davom etadi.
  // Agar ilova haqiqatan yopib qayta ochilgan bo'lsa (yangi tab/oyna), yangi suhbat
  // boshlanadi — eski suhbat esa "Tarix"da saqlanib qoladi.
  useEffect(() => {
    const storedProfile = loadJSON(PROFILE_KEY, {});
    setProfile(storedProfile);
 
    // Foydalanuvchi birinchi marta kirgan (hali tanishuv o'tmagan) bo'lsa — ism-familiya
    // so'raymiz. Google hisobidan kelgan ism-familiyani standart qiymat sifatida to'ldirib qo'yamiz.
    if (!storedProfile?.onboarded) {
      const [gFirst, ...gRest] = (user?.name || '').trim().split(/\s+/).filter(Boolean);
      setObIsm(gFirst || '');
      setObFamiliya(gRest.join(' ') || '');
      setObStep(1);
      setOnboardingOpen(true);
    }
 
    const stored = loadJSON(SESSIONS_KEY, []);
    const wasAlive = sessionStorage.getItem(ALIVE_KEY);
    const firstName = storedProfile?.ism;
 
    if (wasAlive && stored.length > 0) {
      const activeId = localStorage.getItem(ACTIVE_KEY);
      setSessions(stored);
      setSession(stored.find((s) => s.id === activeId) || stored[0]);
    } else {
      const fresh = freshSession(firstName);
      const next = [fresh, ...stored];
      setSessions(next);
      setSession(fresh);
      saveJSON(SESSIONS_KEY, next);
      localStorage.setItem(ACTIVE_KEY, fresh.id);
    }
    sessionStorage.setItem(ALIVE_KEY, '1');
    setHydrated(true);
 
    const t = setTimeout(() => setShowSplash(false), 1400);
 
    // Referral havolasi orqali kirgan bo'lsa (ToshkentGPTGate localStorage'ga
    // yozib qo'ygan), shu yerda "ishlatib" qo'yamiz — natija (bonus yoki xato)
    // haqida bir marta bildirishnoma ko'rsatamiz, keyin izni tozalaymiz.
    const pendingRef = localStorage.getItem('tg-pending-referral');
    if (pendingRef) {
      localStorage.removeItem('tg-pending-referral');
      fetch('/api/referral/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pendingRef }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.ok) {
            showToast(`🎁 Tabriklaymiz! Siz va do'stingiz ${data.days} kunlik Pro tarif (kuniga 60 xabar) oldingiz!`, 'success', 6000);
          }
        })
        .catch(() => {});
    }
 
    // Serverdagi (Redis) profilni ham olib kelamiz — bu qurilmalar orasida
    // haqiqiy manba hisoblanadi (localStorage faqat shu brauzerga xos "kesh").
    // Masalan boshqa qurilmada tanishuvdan o'tgan bo'lsa, shu yerda bilib olamiz.
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((serverProfile) => {
        if (!serverProfile || !Object.keys(serverProfile).length) return;
        setProfile((prev) => {
          const next = { ...prev, ...serverProfile };
          saveJSON(PROFILE_KEY, next);
          return next;
        });
        if (serverProfile.onboarded) setOnboardingOpen(false);
        if (serverProfile.ism) {
          setSession((prev) =>
            prev.messages.length === 1 && prev.messages[0].id === 'welcome'
              ? { ...prev, messages: [stampNow(blankWelcome(serverProfile.ism))] }
              : prev
          );
        }
      })
      .catch(() => {});
 
    // Joriy tarif/limit holatini ham darhol olib kelamiz — shunda
    // pastdagi progress-chiziq birinchi xabar yuborilishidan oldin ham ko'rinadi.
    fetch('/api/plan')
      .then((r) => (r.ok ? r.json() : null))
      .then((plan) => {
        if (plan) setPlanInfo(plan);
      })
      .catch(() => {});
 
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);
 
  // --- Yangilanish bo'lganda ("Nimalar yangilandi?") — FAQAT eski
  // foydalanuvchilarga, yangi ro'yxatdan o'tganlar allaqachon tanishuv
  // jarayonidan o'tayotgani uchun ularga ortiqcha. ---
  useEffect(() => {
    if (!hydrated) return;
    const lastSeenVersion = localStorage.getItem('tg-last-seen-version');
    if (lastSeenVersion === APP_VERSION) return;
 
    const isExistingUser = Boolean(loadJSON(PROFILE_KEY, {})?.onboarded);
    localStorage.setItem('tg-last-seen-version', APP_VERSION);
    if (isExistingUser) setWhatsNewOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
 
  // --- Har bir o'zgarishda joriy suhbatni saqlab boramiz ("istoriya") ---
  useEffect(() => {
    if (!hydrated) return;
    setSessions((prev) => {
      const next = prev.some((s) => s.id === session.id)
        ? prev.map((s) => (s.id === session.id ? session : s))
        : [session, ...prev];
      saveJSON(SESSIONS_KEY, next);
      return next;
    });
    localStorage.setItem(ACTIVE_KEY, session.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hydrated]);
 
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages, isLoading]);
 
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);
 
  useEffect(() => {
    const supported = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
    setSpeechSupported(supported);
  }, []);
 
  function updateMessages(updater) {
    setSession((prev) => {
      const messages = updater(prev.messages);
      return { ...prev, messages, title: sessionTitle(messages), updatedAt: new Date().toISOString() };
    });
  }
 
  function addMessage(role, content, extra = {}) {
    const msg = { id: crypto.randomUUID(), role, content, time: new Date().toISOString(), ...extra };
    updateMessages((prev) => [...prev, msg]);
    return msg;
  }
 
  // Tanishuv oxirida (yoki o'tkazib yuborilganda) chaqiriladi — ismni profilga
  // (demak, xotiraga) yozib qo'yamiz va ochilish xabarini yangi ism bilan yangilaymiz.
  function finishOnboarding({ skip } = {}) {
    const ism = skip ? '' : obIsm.trim();
    const familiya = skip ? '' : obFamiliya.trim();
 
    setProfile((prev) => {
      const next = { ...prev, onboarded: true };
      if (ism) next.ism = ism;
      if (familiya) next.familiya = familiya;
      saveJSON(PROFILE_KEY, next);
      // Serverga (Redis) ham yozamiz — shunda boshqa qurilmadan kirsa ham
      // qayta so'ralmaydi. Tarmoq xatosi bo'lsa ham interfeysni to'smaymiz.
      fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
 
    if (ism) {
      setSession((prev) =>
        prev.messages.length === 1 && prev.messages[0].id === 'welcome'
          ? { ...prev, messages: [stampNow(blankWelcome(ism))] }
          : prev
      );
    }
    setOnboardingOpen(false);
  }
 
  function changeLanguage(lang) {
    setProfile((prev) => {
      const next = { ...prev, til: lang };
      saveJSON(PROFILE_KEY, next);
      fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  }
 
  const [pushEnabled, setPushEnabled] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
 
  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => {
        const latest = data?.notifications?.[0];
        if (!latest) return;
        const lastSeen = localStorage.getItem('tg-last-seen-notification');
        if (latest.createdAt !== lastSeen) setHasNewNotification(true);
      })
      .catch(() => {});
  }, []);
 
  useEffect(() => {
    if (!isPushSupported()) return;
    getCurrentPushSubscription().then((sub) => setPushEnabled(Boolean(sub)));
  }, []);
 
  async function togglePushNotifications() {
    if (!isPushSupported()) {
      showToast("Brauzeringiz push-bildirishnomani qoʻllab-quvvatlamaydi.", 'error');
      return;
    }
 
    // localhost'da (npm run dev) service worker ataylab o'chirilgan (HMR bilan
    // to'qnashmasligi uchun) — shu sabab push-bildirishnoma FAQAT production
    // (Vercel'ga joylashtirilgan) saytda ishlaydi. Aks holda kod "abadiy
    // kutib" qolar edi (xato ham, natija ham bermay).
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      showToast(
        "Bu funksiya faqat Vercel'ga joylashtirilgan (production) saytda ishlaydi — localhost'da service worker o'chirilgan.",
        'error',
        6000
      );
      return;
    }
 
    if (pushEnabled) {
      const sub = await getCurrentPushSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setPushEnabled(false);
      showToast("Bildirishnomalar oʻchirildi.", 'info');
      return;
    }
 
    try {
      const permission = await Notification.requestPermission();
      console.log('[push] permission:', permission);
      if (permission !== 'granted') {
        showToast("Bildirishnoma uchun ruxsat berilmadi.", 'error');
        return;
      }
 
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      console.log('[push] vapidPublicKey mavjudmi:', Boolean(vapidPublicKey));
      if (!vapidPublicKey) {
        showToast("Push-bildirishnoma hali sozlanmagan.", 'error');
        return;
      }
 
      const subscription = await subscribeToPush(vapidPublicKey);
      console.log('[push] subscription:', subscription);
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
      console.log('[push] /api/push/subscribe status:', res.status);
      setPushEnabled(true);
      showToast("Bildirishnomalar yoqildi! 🔔", 'success');
    } catch (err) {
      console.error('[push] XATO:', err);
      showToast(`Bildirishnomani yoqishda xatolik: ${err.message || err}`, 'error');
    }
  }
 
  function downloadChat() {
    if (!session.messages.length) {
      showToast("Suhbat hali bo'sh.", 'error');
      return;
    }
 
    const lines = [`ToshkentGPT — ${session.title || 'Suhbat'}`, '='.repeat(40), ''];
    for (const msg of session.messages) {
      const who = msg.role === 'user' ? (profile?.ism || 'Siz') : 'ToshkentGPT';
      const time = msg.time ? new Date(msg.time).toLocaleString('uz-UZ') : '';
      lines.push(`[${time}] ${who}:`);
      lines.push(msg.content || (msg.image ? '(rasm)' : ''));
      lines.push('');
    }
 
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toshkentgpt-${(session.title || 'suhbat').slice(0, 40).replace(/[^\p{L}\p{N}\s-]/gu, '')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
 
  async function connectTelegram() {
    try {
      const res = await fetch('/api/telegram/link-token', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) {
        showToast(data?.error || "Telegram bilan bog'lashda xatolik yuz berdi.", 'error');
        return;
      }
      if (!data.botUsername) {
        showToast("Telegram bot hali sozlanmagan (.env.local'da TELEGRAM_BOT_USERNAME yo'q).", 'error');
        return;
      }
      window.open(`https://t.me/${data.botUsername}?start=${data.token}`, '_blank');
    } catch {
      showToast("Telegram bilan bog'lashda xatolik yuz berdi.", 'error');
    }
  }
 
  function stopGeneration() {
    abortRef.current?.abort();
  }
 
  async function handleSendText(overrideText) {
    const text = (overrideText ?? input).trim();
    if ((!text && !attachment) || isLoading) return;
 
    const currentAttachment = attachment;
    const previousInteractionId = session.lastInteractionId;
 
    setInput('');
    setAttachment(null);
 
    // Serverga yuboriladigan yakuniy matn/rasm shu yerda tayyorlanadi — bir xil
    // qiymatlar keyinroq "qayta generatsiya qilish" (regenerate) uchun ham
    // xabar ichida saqlab qo'yiladi (apiText/apiImage), aks holda regenerate
    // vaqtida fayl matnini yoki rasmni qayta qurib bo'lmaydi.
    let finalText = text;
    let imagePayload;
    let pdfPayload;
 
    if (currentAttachment?.kind === 'image') {
      imagePayload = {
        mimeType: currentAttachment.mimeType,
        data: currentAttachment.dataUrl.split(',')[1],
      };
      if (!finalText) finalText = 'Bu rasmda nima borligini aytib ber.';
    } else if (currentAttachment?.kind === 'pdf') {
      pdfPayload = { data: currentAttachment.dataUrl.split(',')[1], name: currentAttachment.name };
      if (!finalText) finalText = 'Bu PDF faylda nima yozilganini tushuntirib ber.';
    } else if (currentAttachment?.kind === 'text') {
      finalText = `${finalText}\n\n[Fayl: ${currentAttachment.name}]\n${currentAttachment.text.slice(0, 6000)}`;
    } else if (currentAttachment?.kind === 'video') {
      finalText = `${finalText}\n\n(Foydalanuvchi "${currentAttachment.name}" nomli video biriktirdi, lekin men hozircha video formatini koʻra olmayman — faqat nomini bilaman.)`;
    } else if (currentAttachment?.kind === 'file') {
      finalText = `${finalText}\n\n(Foydalanuvchi "${currentAttachment.name}" faylini biriktirdi, lekin bu turdagi faylni oʻqiy olmayman — faqat nomini bilaman.)`;
    }
 
    addMessage('user', text, {
      image: currentAttachment?.kind === 'image' ? { dataUrl: currentAttachment.dataUrl, name: currentAttachment.name } : null,
      fileNote:
        currentAttachment && currentAttachment.kind !== 'image'
          ? `📎 ${currentAttachment.name}`
          : null,
      apiText: finalText,
      apiImage: imagePayload || null,
      apiPdf: pdfPayload || null,
      prevInteractionId: previousInteractionId,
    });
 
    // Bot javobi kelayotganda to'ldirib boriladigan bo'sh xabar — "so'z-so'z" effekti shundan.
    const assistantId = crypto.randomUUID();
    updateMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', time: new Date().toISOString(), prevInteractionId: previousInteractionId },
    ]);
 
    await streamAssistantReply({ assistantId, finalText, imagePayload, pdfPayload, previousInteractionId, deepThink });
  }
 
  // "Qayta generatsiya qilish" (regenerate) tugmasi bosilganda: oldingi
  // foydalanuvchi xabari (matn/rasm) o'sha holicha qayta yuboriladi, lekin
  // YANGI foydalanuvchi pufakchasi qo'shilmaydi — faqat AI javobi (assistantMsg)
  // o'rniga yangisi yoziladi.
  async function regenerateMessage(assistantMsg) {
    if (isLoading) return;
    const idx = session.messages.findIndex((m) => m.id === assistantMsg.id);
    const userMsg = session.messages[idx - 1];
    if (!userMsg || userMsg.role !== 'user') return;
 
    audioRef.current?.pause();
    setSpeakingId(null);
    updateMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: '', rating: null } : m)));
 
    await streamAssistantReply({
      assistantId: assistantMsg.id,
      finalText: userMsg.apiText ?? userMsg.content,
      imagePayload: userMsg.apiImage || undefined,
      pdfPayload: userMsg.apiPdf || undefined,
      previousInteractionId: assistantMsg.prevInteractionId ?? userMsg.prevInteractionId ?? null,
      deepThink,
    });
  }
 
  // "Tahrirlash" tugmasi — faqat suhbatdagi ENG OXIRGI foydalanuvchi xabari
  // uchun ishlaydi (aks holda AI xotirasi va tarix bir-biriga mos kelmay
  // qoladi). Xabar va undan keyingi javob o'chiriladi, matn kiritish
  // maydoniga qaytariladi — foydalanuvchi tahrirlab, qayta yuboradi.
  function startEditMessage(userMsg) {
    if (isLoading) return;
    const idx = session.messages.findIndex((m) => m.id === userMsg.id);
    if (idx === -1) return;
 
    updateMessages((prev) => prev.slice(0, idx));
    setSession((prev) => ({ ...prev, lastInteractionId: userMsg.prevInteractionId ?? null }));
    setInput(userMsg.content);
    setAttachment(null);
    textareaRef.current?.focus();
  }
 
  // Assistant javobiga 👍/👎 belgisi qo'yish. Faqat vizual holat sifatida
  // saqlanadi, shu bilan birga adminга ko'rish uchun serverga ham (xatoga
  // chidamli, interfeysni to'smaydigan tarzda) yuboriladi.
  function rateMessage(msg, rating) {
    const nextRating = msg.rating === rating ? null : rating;
    updateMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, rating: nextRating } : m)));
 
    if (nextRating) {
      fetch('/api/rate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: nextRating, content: msg.content }),
      }).catch(() => {});
    }
  }
 
  // /api/chat'ga so'rov yuborish + streaming javobni o'qish — bu qism
  // handleSendText (yangi xabar) va regenerateMessage (qayta generatsiya)
  // ikkalasi uchun ham umumiy, shuning uchun alohida funksiyaga chiqarilgan.
  async function streamAssistantReply({ assistantId, finalText, imagePayload, pdfPayload, previousInteractionId, deepThink }) {
    setIsLoading(true);
    setErrorBanner(null);
 
    try {
      const controller = new AbortController();
      abortRef.current = controller;
 
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalText, image: imagePayload, pdf: pdfPayload, previousInteractionId, profile, deepThink }),
        signal: controller.signal,
      });
 
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        if (data?.unlockAt) {
          setTrialEndInfo({ planId: data.suggestedPlan === 'pro' ? 'pro' : planInfo?.id || 'pro', unlockAt: data.unlockAt });
          setPaymentPlanId(data.suggestedPlan || 'pro');
          setPlansView('trial-ended');
          setPlansOpen(true);
        } else if (data?.requiresUpgrade) {
          setPaymentPlanId(data.suggestedPlan || 'pro');
          setPlansView('list');
          setPlansOpen(true);
        }
        throw new Error(data?.response || `Server xatosi: ${res.status}`);
      }
 
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';
 
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
 
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          let evt;
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
 
          if (evt.type === 'chunk') {
            streamedText += evt.text;
            const snapshot = streamedText;
            updateMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m)));
          } else if (evt.type === 'done') {
            const finalContent = evt.text;
            updateMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: finalContent, image: evt.image || m.image, file: evt.file || m.file, time: new Date().toISOString() }
                  : m
              )
            );
            if (evt.interactionId) {
              setSession((prev) => ({ ...prev, lastInteractionId: evt.interactionId }));
            }
            if (evt.plan) {
              setPlanInfo(evt.plan);
            }
            if (evt.facts && Object.keys(evt.facts).length) {
              setProfile((prev) => {
                const next = { ...prev, ...evt.facts };
                saveJSON(PROFILE_KEY, next);
                return next;
              });
            }
          } else if (evt.type === 'error') {
            throw new Error(evt.message || 'Server xatosi');
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Foydalanuvchi "to'xtatish" tugmasini bosdi — bu xato emas, xabarni
        // qancha kelgan bo'lsa shu holida qoldiramiz (yoki hali bo'sh bo'lsa, belgi qo'yamiz).
        updateMessages((prev) =>
          prev.map((m) => (m.id === assistantId && !m.content ? { ...m, content: '_Toʻxtatildi._' } : m))
        );
      } else {
        console.error(err);
        setErrorBanner(err.message || 'Serverga ulanishda xatolik yuz berdi.');
        // Hech narsa kelmagan bo'lsa, bo'sh xabarni olib tashlaymiz.
        updateMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.content)));
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }
 
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }
 
  function handleNewChat() {
    audioRef.current?.pause();
    setSpeakingId(null);
    const fresh = freshSession(profile?.ism);
    setSession(fresh);
    setErrorBanner(null);
    setInput('');
    setAttachment(null);
    setHistoryOpen(false);
  }
 
  function openSession(s) {
    audioRef.current?.pause();
    setSpeakingId(null);
    setSession(s);
    setHistoryOpen(false);
  }
 
  function deleteSession(id, e) {
    e.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveJSON(SESSIONS_KEY, next);
      return next;
    });
    if (session.id === id) {
      setSession(freshSession(profile?.ism));
    }
  }
 
  async function toggleListening() {
    if (!speechSupported) return;
 
    if (listening) {
      // Yozib olishni to'xtatamiz — qolgani (yuborish, matnga o'girish)
      // recorder'ning "onstop" hodisasida davom etadi.
      mediaRecorderRef.current?.stop();
      setListening(false);
      return;
    }
 
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
 
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
 
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
 
        if (blob.size < 500) return; // deyarli bo'sh yozuv — hech narsa qilmaymiz
 
        setTranscribing(true);
        try {
          const dataUrl = await fileToDataUrl(blob);
          const base64 = dataUrl.split(',')[1];
          const res = await fetch('/api/stt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, mimeType: blob.type }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error || "Ovozni matnga o'girib bo'lmadi.");
          if (data?.text) {
            setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
          }
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setTranscribing(false);
        }
      };
 
      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
    } catch {
      showToast("Mikrofonga ruxsat berilmadi yoki topilmadi.", 'error');
      setListening(false);
    }
  }
 
  function playAudio(msgId, base64Mp3) {
    audioRef.current?.pause();
    const audio = new Audio(`data:audio/mpeg;base64,${base64Mp3}`);
    audioRef.current = audio;
    audio.onended = () => setSpeakingId(null);
    audio.onerror = () => setSpeakingId(null);
    setSpeakingId(msgId);
    audio.play().catch(() => setSpeakingId(null));
  }
 
  async function toggleSpeak(msg) {
    if (speakingId === msg.id) {
      audioRef.current?.pause();
      setSpeakingId(null);
      return;
    }
    audioRef.current?.pause();
    setSpeakingId(null);
 
    // Avval yaratilgan bo'lsa, qayta so'ramaymiz — keshdan darhol ijro etamiz.
    const cached = audioCache[msg.id];
    if (cached) {
      playAudio(msg.id, cached);
      return;
    }
 
    setTtsLoadingId(msg.id);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: stripMarkdown(msg.content).slice(0, 2000) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.audio) throw new Error(data?.error || "Ovoz yaratib bo'lmadi.");
      setAudioCache((prev) => ({ ...prev, [msg.id]: data.audio }));
      playAudio(msg.id, data.audio);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTtsLoadingId(null);
    }
  }
 
  function downloadAudio(msgId) {
    const base64 = audioCache[msgId];
    if (!base64) return;
    const a = document.createElement('a');
    a.href = `data:audio/mpeg;base64,${base64}`;
    a.download = 'toshkentgpt-ovoz.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
 
  async function copyMessage(msg) {
    try {
      await navigator.clipboard.writeText(msg.content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = msg.content;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(ta);
    }
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  }
 
  async function handleFile(file) {
    if (!file) return;
 
    if (file.type.startsWith('image/')) {
      const dataUrl = await fileToDataUrl(file);
      setAttachment({ kind: 'image', mimeType: file.type, dataUrl, name: file.name });
    } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      if (file.size > 15_000_000) {
        setAttachment({ kind: 'file', name: file.name });
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setAttachment({ kind: 'pdf', dataUrl, name: file.name });
    } else if (file.type.startsWith('video/')) {
      if (file.size > 15_000_000) {
        setAttachment({ kind: 'video', name: file.name });
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setAttachment({ kind: 'video', mimeType: file.type, dataUrl, name: file.name });
    } else if (file.type.startsWith('text/') || /\.(txt|md|json|csv|log)$/i.test(file.name)) {
      if (file.size > 300000) {
        setAttachment({ kind: 'file', name: file.name });
        return;
      }
      const text = await fileToText(file);
      setAttachment({ kind: 'text', name: file.name, text });
    } else {
      setAttachment({ kind: 'file', name: file.name });
    }
  }
 
  async function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    await handleFile(file);
  }
 
  // Matn maydoniga Ctrl+V bilan rasm yoki video joylashtirilsa — biriktirma
  // sifatida qo'shamiz (oddiy matn joylashtirish odatdagidek ishlayveradi).
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
          e.preventDefault();
          handleFile(file);
          return;
        }
      }
    }
  }
 
  async function startTrial(planId) {
    setTrialStarting(true);
    try {
      const res = await fetch('/api/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Xato');
      setPlanInfo({
        id: planId,
        name: PLANS[planId].name,
        mode: 'trial',
        limit: PLANS[planId].trial.limit,
        used: 0,
        remaining: PLANS[planId].trial.limit,
        resetAt: null,
      });
      setPlansOpen(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTrialStarting(false);
    }
  }
 
  function openUpgrade(planId) {
    setPaymentPlanId(planId);
    setPlansView('pay');
    setPaymentStatus('idle');
    setPlansOpen(true);
  }
 
  async function requestUpgrade() {
    setPaymentStatus('sending');
    try {
      const res = await fetch('/api/upgrade-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: paymentPlanId }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Xato');
      setPaymentStatus('sent');
    } catch {
      setPaymentStatus('error');
    }
  }
 
  function goToPayFromTrialEnd(planId) {
    setPaymentPlanId(planId || 'pro');
    setPlansView('pay');
    setPaymentStatus('idle');
  }
 
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
 
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[var(--tg-bg)] text-[var(--tg-text-1)]">
      {showSplash && <SplashScreen />}
 
      {!showSplash && onboardingOpen && (
        <OnboardingFlow
          step={obStep}
          ism={obIsm}
          familiya={obFamiliya}
          userImage={user?.image}
          onIsmChange={setObIsm}
          onFamiliyaChange={setObFamiliya}
          onNext={() => setObStep(2)}
          onBack={() => setObStep(1)}
          onFinish={() => finishOnboarding()}
          onSkip={() => finishOnboarding({ skip: true })}
        />
      )}
 
      <div className="tg-ambient-bg pointer-events-none fixed inset-0" />
      <GirihPattern />
 
      <Header
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        language={profile?.til}
        onChangeLanguage={changeLanguage}
        planId={planInfo?.id}
        navMenuOpen={navMenuOpen}
        onToggleNavMenu={() => setNavMenuOpen((v) => !v)}
        onCloseNavMenu={() => setNavMenuOpen(false)}
        avatarMenuOpen={menuOpen}
        onToggleAvatarMenu={() => setMenuOpen((v) => !v)}
        onCloseAvatarMenu={() => setMenuOpen(false)}
        onOpenHistory={() => setHistoryOpen(true)}
        onNewChat={handleNewChat}
        onConnectTelegram={connectTelegram}
        pushEnabled={pushEnabled}
        onTogglePush={togglePushNotifications}
        onDownloadChat={downloadChat}
        hasNewNotification={hasNewNotification}
      />
 
      {errorBanner && (
        <div className="relative z-10 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-center text-xs text-red-300 sm:px-6">
          {errorBanner}
        </div>
      )}
 
      <ChatMessages
        messages={session.messages}
        userImage={user?.image}
        isLoading={isLoading}
        copiedId={copiedId}
        speakingId={speakingId}
        ttsLoadingId={ttsLoadingId}
        audioCache={audioCache}
        onCopy={copyMessage}
        onToggleSpeak={toggleSpeak}
        onDownloadAudio={downloadAudio}
        onRegenerate={regenerateMessage}
        onEdit={startEditMessage}
        onRate={rateMessage}
        onSuggestionClick={(s) => handleSendText(s)}
        scrollAnchorRef={scrollAnchorRef}
      />
 
      <ChatInput
        planInfo={planInfo}
        attachment={attachment}
        onRemoveAttachment={() => setAttachment(null)}
        fileInputRef={fileInputRef}
        onFilePicked={handleFilePicked}
        textareaRef={textareaRef}
        input={input}
        onInputChange={setInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        speechSupported={speechSupported}
        listening={listening}
        transcribing={transcribing}
        onToggleListening={toggleListening}
        isLoading={isLoading}
        onStop={stopGeneration}
        onSend={() => handleSendText()}
        deepThink={deepThink}
        onToggleDeepThink={() => setDeepThink((v) => !v)}
      />
 
      <Sidebar
        open={historyOpen}
        sessions={sortedSessions}
        activeSessionId={session.id}
        onClose={() => setHistoryOpen(false)}
        onNewChat={handleNewChat}
        onOpenSession={openSession}
        onDeleteSession={deleteSession}
      />
 
      <PlansModal
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        view={plansView}
        currentPlanId={planInfo?.id}
        paymentPlanId={paymentPlanId}
        trialEndInfo={trialEndInfo}
        paymentStatus={paymentStatus}
        trialStarting={trialStarting}
        onStartTrial={startTrial}
        onOpenUpgrade={openUpgrade}
        onRequestUpgrade={requestUpgrade}
        onGoToPayFromTrialEnd={goToPayFromTrialEnd}
        onBackToList={() => setPlansView('list')}
      />
 
      <WhatsNewModal
        open={whatsNewOpen}
        version={APP_VERSION}
        items={CHANGELOG[0]?.items || []}
        onClose={() => setWhatsNewOpen(false)}
      />
    </div>
  );
}
 