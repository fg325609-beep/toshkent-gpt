'use client';
 
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
 
import { PLANS } from './plans';
import { storageKey, loadJSON, saveJSON } from '@/lib/storage';
import { blankWelcome, stampNow, newSession, freshSession, sessionTitle } from '@/lib/session';
import { stripMarkdown } from '@/lib/format';
import { fileToDataUrl } from '@/lib/files';
import { prepareAttachment, toApiAttachment } from '@/lib/upload';
import { classifyFile } from '@/lib/upload-limits';
import { showToast } from '@/lib/toast';
import { APP_VERSION, CHANGELOG } from '@/lib/version';
import { isPushSupported, subscribeToPush, getCurrentPushSubscription } from '@/lib/push';
 
import SignInScreen from '@/components/SignInScreen';
import SplashScreen from '@/components/SplashScreen';
import OnboardingFlow from '@/components/OnboardingFlow';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';
import StartScreen from '@/components/StartScreen';
import VoiceMode from '@/components/VoiceMode';
import PlansModal from '@/components/PlansModal';
import WhatsNewModal from '@/components/WhatsNewModal';
import BrandMark from '@/components/BrandMark';
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
        <BrandMark size={72} variant="orbit" thinking />
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
  // Biriktirmalar — bir nechta bo'lishi mumkin (rasm, video, audio, hujjat).
  const [attachments, setAttachments] = useState([]);
  // AI yozayotgandagi holat satri ("O'ylayapman…", "Video yuklanmoqda…").
  const [assistantStatus, setAssistantStatus] = useState('');
  // Faylni sahifaga sudrab tashlash (drag & drop) qatlami.
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Katta ekrandagi doimiy yon panel ochiqmi? (Yopish tugmasi bilan boshqariladi.)
  const [railOpen, setRailOpen] = useState(true);
  // Boshlanish ekranidagi katta sarlavha — admin panelidan boshqariladi.
  const [hero, setHero] = useState(null);
  // Jonli (onlayn) ovozli suhbat oynasi.
  const [voiceOpen, setVoiceOpen] = useState(false);
  // Admin paneldan boshqariladigan e'lon va sozlamalar (/api/settings).
  const [appSettings, setAppSettings] = useState(null);
  const [announceClosed, setAnnounceClosed] = useState(false);
 
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
 
    // Telefonda "Ulashish → ToshkentGPT" (PWA share_target) orqali kelgan matn/havola
    // yozish qatoriga tushadi — foydalanuvchi faqat "yuborish"ni bosadi.
    try {
      const sp = new URLSearchParams(window.location.search);
      const shared = [sp.get('title'), sp.get('text'), sp.get('url')].filter(Boolean).join('\n').trim();
      if (shared) {
        setInput(shared.slice(0, 4000));
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {}
 
    // Serverdagi ilova sozlamalari: e'lon banneri, texnik ishlar, funksiyalar.
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setAppSettings(data);
        try {
          const key = data.announcement?.text ? `tg-announce-closed:${data.announcement.text.slice(0, 40)}` : null;
          if (key && localStorage.getItem(key)) setAnnounceClosed(true);
        } catch {}
      })
      .catch(() => {});
 
    // Admin panelida yozilgan sarlavha (matn, rang, shrift).
    fetch('/api/hero')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.text) setHero(data);
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
 
  // Yon panelning ochiq/yopiqligi brauzerda eslab qolinadi.
  useEffect(() => {
    if (localStorage.getItem('tg-rail-open') === '0') setRailOpen(false);
  }, []);
 
  function toggleRail(next) {
    setRailOpen(next);
    try {
      localStorage.setItem('tg-rail-open', next ? '1' : '0');
    } catch {}
  }
 
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
 
  // Klaviatura: Esc — javobni to'xtatish, Ctrl/Cmd+Shift+O — yangi suhbat.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && abortRef.current) {
        abortRef.current.abort();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault();
        handleNewChat();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.ism]);

  function updateMessages(updater) {
    setSession((prev) => {
      const messages = updater(prev.messages);
      return {
        ...prev,
        messages,
        // Foydalanuvchi o'zi nom bergan bo'lsa (customTitle), uni o'zgartirmaymiz.
        title: prev.customTitle || prev.autoTitled ? prev.title : sessionTitle(messages),
        updatedAt: new Date().toISOString(),
      };
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
 
  async function stopGeneration() {
    abortRef.current?.abort();
  }
 
  async function handleSendText(overrideText) {
    const text = (overrideText ?? input).trim();
    if (isLoading) return;
    if (attachments.some((a) => a.status === 'uploading')) {
      showToast('Fayl yuklanishini kuting.', 'error');
      return;
    }
    const currentAttachments = attachments.filter((a) => a.status !== 'uploading');
    if (!text && !currentAttachments.length) return;

    const previousInteractionId = session.lastInteractionId;

    setInput('');
    setAttachments([]);

    // Serverga yuboriladigan ko'rinish (regenerate uchun xabar ichida ham saqlanadi).
    const apiFiles = currentAttachments.map(toApiAttachment);
    // Ko'rsatish uchun: kichik rasmlar data: URL sifatida (sahifa yangilansa ham
    // ko'rinadi), kattalari — vaqtinchalik ko'rinish havolasi.
    const displayAttachments = currentAttachments.map((a) => ({
      id: a.id,
      category: a.category,
      name: a.name,
      size: a.size,
      previewUrl:
        a.category === 'image' && a.kind === 'inline' && a.size <= 1_000_000
          ? `data:${a.mimeType};base64,${a.data}`
          : a.category === 'image' || a.category === 'video'
            ? a.previewUrl || a.url || null
            : null,
    }));

    addMessage('user', text, {
      attachments: displayAttachments,
      apiText: text,
      // localStorage sig'imi (~5 MB) uchun: katta inline (base64) fayllar xabar
      // ichida saqlanmaydi — "qayta yozdirish" ularni qayta yubormaydi.
      apiFiles: apiFiles.filter((f) => f.kind === 'blob' || (f.data || '').length < 400_000),
      prevInteractionId: previousInteractionId,
    });

    // Bot javobi kelayotganda to'ldirib boriladigan bo'sh xabar — "so'z-so'z" effekti shundan.
    const assistantId = crypto.randomUUID();
    updateMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', time: new Date().toISOString(), prevInteractionId: previousInteractionId },
    ]);

    await streamAssistantReply({ assistantId, finalText: text, files: apiFiles, previousInteractionId, deepThink });
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
      files: userMsg.apiFiles || [],
      // Eski (2.2 gacha) xabarlar uchun — ularda alohida maydonlar bor edi.
      imagePayload: userMsg.apiImage || undefined,
      pdfPayload: userMsg.apiPdf || undefined,
      documentPayload: userMsg.apiDocument || undefined,
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
    setAttachments([]);
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
 
  // Suhbat nomini AI bilan qisqartirish — faqat birinchi almashinuvdan keyin,
  // bir marta. Xato bo'lsa — eski (birinchi xabarning boshi) nom qolaveradi.
  function maybeAutoTitle(userText, assistantText) {
    setSession((prev) => {
      if (prev.customTitle || prev.autoTitled) return prev;
      const userCount = prev.messages.filter((m) => m.role === 'user').length;
      if (userCount !== 1) return prev;
      const sessionId = prev.id;
      fetch('/api/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: (userText || '').slice(0, 1200), assistant: (assistantText || '').slice(0, 1200) }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.title) return;
          setSession((cur) => (cur.id === sessionId && !cur.customTitle ? { ...cur, title: data.title, autoTitled: true } : cur));
          setSessions((list) => {
            const next = list.map((x) => (x.id === sessionId && !x.customTitle ? { ...x, title: data.title, autoTitled: true } : x));
            saveJSON(SESSIONS_KEY, next);
            return next;
          });
        })
        .catch(() => {});
      return { ...prev, autoTitled: true };
    });
  }
 
  // /api/chat'ga so'rov yuborish + streaming javobni o'qish — bu qism
  // handleSendText (yangi xabar) va regenerateMessage (qayta generatsiya)
  // ikkalasi uchun ham umumiy, shuning uchun alohida funksiyaga chiqarilgan.
  async function streamAssistantReply({ assistantId, finalText, files, imagePayload, pdfPayload, documentPayload, previousInteractionId, deepThink }) {
    setIsLoading(true);
    setErrorBanner(null);
    setAssistantStatus(files?.length ? 'Fayllar tayyorlanmoqda...' : '');
 
    try {
      const controller = new AbortController();
      abortRef.current = controller;
 
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: finalText,
          files: files || [],
          image: imagePayload,
          pdf: pdfPayload,
          document: documentPayload,
          previousInteractionId,
          profile,
          deepThink,
        }),
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
 
          if (evt.type === 'status') {
            setAssistantStatus(evt.text || '');
          } else if (evt.type === 'thinking') {
            // Fikrlash qisqacha mazmuni — xabar ichida yig'ib boriladi.
            const piece = evt.text || '';
            updateMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, thinking: `${m.thinking || ''}${piece}` } : m)));
          } else if (evt.type === 'chunk') {
            if (!streamedText) setAssistantStatus('');
            streamedText += evt.text;
            const snapshot = streamedText;
            updateMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m)));
          } else if (evt.type === 'done') {
            const finalContent = evt.text;
            setAssistantStatus('');
            updateMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: finalContent,
                      image: evt.image || m.image,
                      file: evt.file || m.file,
                      followups: evt.followups || [],
                      sources: evt.sources || [],
                      time: new Date().toISOString(),
                    }
                  : m
              )
            );
            if (evt.interactionId) {
              setSession((prev) => ({ ...prev, lastInteractionId: evt.interactionId }));
            }
            if (evt.plan) {
              setPlanInfo(evt.plan);
            }
            // Birinchi javobdan keyin suhbatga qisqa, ma'noli nom qo'yamiz
            // (foydalanuvchi o'zi nom bergan bo'lsa — tegmaymiz).
            maybeAutoTitle(finalText, finalContent);
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
      setAssistantStatus('');
      abortRef.current = null;
    }
  }
 
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }
 
  // Buyruq tugmasi bosilganda: xabarni DARHOL yubormaymiz, faqat buyruqni
  // yozish qatoriga qo'yib, kursorni oxiriga olib boramiz.
  function handleCommandPick(prefix) {
    setInput(prefix);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(prefix.length, prefix.length);
    });
  }
 
  function handleNewChat() {
    audioRef.current?.pause();
    setSpeakingId(null);
    const fresh = freshSession(profile?.ism);
    setSession(fresh);
    setErrorBanner(null);
    setInput('');
    setAttachments([]);
    setHistoryOpen(false);
  }
 
  function openSession(s) {
    audioRef.current?.pause();
    setSpeakingId(null);
    setSession(s);
    setHistoryOpen(false);
  }
 
  function deleteSession(id, e) {
    e?.stopPropagation?.();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveJSON(SESSIONS_KEY, next);
      return next;
    });
    if (session.id === id) {
      setSession(freshSession(profile?.ism));
    }
  }

  // Suhbatni qadash (ro'yxat tepasida "Qadalgan" bo'limida turadi).
  function togglePinSession(id) {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s));
      saveJSON(SESSIONS_KEY, next);
      return next;
    });
    if (session.id === id) setSession((prev) => ({ ...prev, pinned: !prev.pinned }));
  }

  // Suhbatga o'z nomini berish — keyin avtomatik sarlavha uni bosib ketmaydi.
  function renameSession(id, title) {
    const clean = title.trim().slice(0, 80);
    if (!clean) return;
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, title: clean, customTitle: true } : s));
      saveJSON(SESSIONS_KEY, next);
      return next;
    });
    if (session.id === id) setSession((prev) => ({ ...prev, title: clean, customTitle: true }));
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
 
  // Fayl(lar)ni biriktirish — bir nechta bo'lishi mumkin. Kichiklari darhol
  // (base64), kattalari va video/audio Vercel Blob'ga yuklanadi (foiz bilan).
  async function handleFiles(fileList) {
    const list = Array.from(fileList || []).filter(Boolean);
    if (!list.length) return;
    if (attachments.length + list.length > 6) {
      showToast("Bir xabarga ko'pi bilan 6 ta fayl biriktirish mumkin.", 'error');
      return;
    }

    await Promise.all(
      list.map(async (file) => {
        const tempId = crypto.randomUUID();
        setAttachments((prev) => [
          ...prev,
          { id: tempId, status: 'uploading', progress: 0, name: file.name, category: classifyFile(file.name, file.type), size: file.size },
        ]);
        try {
          const att = await prepareAttachment(file, {
            email: userEmail,
            onProgress: (pct) => setAttachments((prev) => prev.map((a) => (a.id === tempId ? { ...a, progress: pct } : a))),
          });
          setAttachments((prev) => prev.map((a) => (a.id === tempId ? { ...att, id: tempId } : a)));
        } catch (err) {
          setAttachments((prev) => prev.filter((a) => a.id !== tempId));
          showToast(err.message || "Faylni biriktirib bo'lmadi.", 'error');
        }
      })
    );
  }

  function removeAttachment(id) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  async function handleFilePicked(e) {
    const files = e.target.files;
    await handleFiles(files);
    e.target.value = '';
  }

  // Matn maydoniga Ctrl+V bilan rasm/fayl joylashtirilsa — biriktirma
  // sifatida qo'shamiz (oddiy matn joylashtirish odatdagidek ishlayveradi).
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  }

  // --- Sudrab tashlash (drag & drop) — butun sahifa ---
  function onDragEnter(e) {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }
  function onDragOver(e) {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
  }
  function onDragLeave(e) {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  }
  function onDrop(e) {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
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
 
  // Suhbat hali boshlanmagan bo'lsa — yozish qatori ekran o'rtasida turadi.
  const isStart = session.messages.length === 1 && !isLoading;
  const wasStartRef = useRef(isStart);
 
  // Birinchi xabar yuborilgach yozish qatori pastga ko'chadi — kursor unda qolsin.
  useEffect(() => {
    if (wasStartRef.current === isStart) return;
    wasStartRef.current = isStart;
    if (!isStart) textareaRef.current?.focus();
  }, [isStart]);
 
  // ChatInput ikki joyda (o'rtada va pastda) ishlatilgani uchun proplari bir marta yig'iladi.
  const chatInputProps = {
    planInfo,
    attachments,
    onRemoveAttachment: removeAttachment,
    fileInputRef,
    onFilesPicked: handleFilePicked,
    textareaRef,
    input,
    onInputChange: setInput,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    speechSupported,
    listening,
    transcribing,
    onToggleListening: toggleListening,
    isLoading,
    onStop: stopGeneration,
    onSend: () => handleSendText(),
    deepThink,
    onToggleDeepThink: () => setDeepThink((v) => !v),
    onCommandPick: handleCommandPick,
    onOpenVoice: () => setVoiceOpen(true),
  };
 
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
 
  return (
    <div
      className={`relative flex h-dvh flex-col overflow-hidden bg-[var(--tg-bg)] text-[var(--tg-text-1)] ${railOpen ? 'lg:pl-[272px]' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {showSplash && <SplashScreen />}

      {dragActive && (
        <div className="tg-dropzone tg-fade-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="rounded-3xl border-2 border-dashed border-[var(--tg-gold)]/70 bg-[var(--tg-surface)]/80 px-10 py-8 text-center shadow-[var(--tg-shadow-lg)]">
            <p className="text-lg font-semibold text-[var(--tg-text-1)]">Faylni shu yerga tashlang</p>
            <p className="mt-1 text-sm text-[var(--tg-text-3)]">Rasm, video, audio, PDF, Word, Excel — GBʼlab fayl ham boʻladi</p>
          </div>
        </div>
      )}
 
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
 
      <Header
        user={user}
        railOpen={railOpen}
        thinking={isLoading}
        onOpenHistory={() => {
          setHistoryOpen(true);
          toggleRail(true);
        }}
        onNewChat={handleNewChat}
      />
 
      {appSettings?.announcement?.text && !announceClosed && (
        <div
          className={`tg-announce tg-fade-in relative z-10 flex items-center gap-3 px-4 py-2 text-[12.5px] text-[var(--tg-text-1)] sm:px-6 ${
            appSettings.announcement.level === 'warn' ? 'tg-announce-warn' : appSettings.announcement.level === 'success' ? 'tg-announce-success' : ''
          }`}
        >
          <span className="flex-1">
            {appSettings.announcement.text}
            {appSettings.announcement.link && (
              <a href={appSettings.announcement.link} className="ml-2 font-semibold underline underline-offset-2" target={/^https?:/.test(appSettings.announcement.link) ? '_blank' : undefined} rel="noopener noreferrer">
                Batafsil →
              </a>
            )}
          </span>
          <button
            type="button"
            aria-label="Yopish"
            onClick={() => {
              setAnnounceClosed(true);
              try {
                localStorage.setItem(`tg-announce-closed:${appSettings.announcement.text.slice(0, 40)}`, '1');
              } catch {}
            }}
            className="tg-iconbtn h-7 w-7"
          >
            ×
          </button>
        </div>
      )}
 
      {appSettings?.maintenance?.enabled && (
        <div className="relative z-10 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-center text-xs text-red-300 sm:px-6">
          🛠 {appSettings.maintenance.message || 'Texnik ishlar olib borilmoqda — ba\'zi funksiyalar vaqtincha ishlamasligi mumkin.'}
        </div>
      )}
 
      {errorBanner && (
        <div className="relative z-10 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-center text-xs text-red-300 sm:px-6">
          {errorBanner}
        </div>
      )}
 
      {isStart ? (
        <StartScreen
          hero={hero}
          firstName={profile?.ism}
          onCommandPick={handleCommandPick}
          onSuggestionClick={(q) => handleSendText(q)}
        >
          <ChatInput {...chatInputProps} centered />
        </StartScreen>
      ) : (
        <>
          <ChatMessages
            messages={session.messages}
            userImage={user?.image}
            isLoading={isLoading}
            assistantStatus={assistantStatus}
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
            onFollowup={(q) => handleSendText(q)}
            scrollAnchorRef={scrollAnchorRef}
          />
 
          <ChatInput {...chatInputProps} />
        </>
      )}
 
      <Sidebar
        open={historyOpen}
        sessions={sortedSessions}
        activeSessionId={session.id}
        onClose={() => setHistoryOpen(false)}
        onNewChat={handleNewChat}
        onOpenSession={openSession}
        onDeleteSession={deleteSession}
        onTogglePin={togglePinSession}
        onRenameSession={renameSession}
        railOpen={railOpen}
        onCollapse={() => toggleRail(false)}
        onCommandPick={handleCommandPick}
        chatStarted={!isStart}
        planInfo={planInfo}
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
 
      {/* Jonli ovozli suhbat — butun ekranni egallaydi. */}
      <VoiceMode
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onPlanUpdate={setPlanInfo}
        onExchange={(userText, replyText) => {
          // Ovozda gaplashilgani ham suhbat tarixida qolsin.
          if (!userText && !replyText) return;
          updateMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'user', content: userText, time: new Date().toISOString(), voice: true },
            { id: crypto.randomUUID(), role: 'assistant', content: replyText, time: new Date().toISOString(), voice: true },
          ]);
        }}
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
 