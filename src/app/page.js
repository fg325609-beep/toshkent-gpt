'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import MarkdownMessage from './markdown-message';
import { useTheme } from './use-theme';
import { PLANS, PLAN_ORDER, PAYMENT_CARD } from './plans';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Crown,
  Film,
  Flame,
  History,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Moon,
  Paperclip,
  Plus,
  Send,
  Settings,
  Sparkles,
  Square,
  Sun,
  Trash2,
  User,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';

// lucide-react'da brend logotiplari (Linkedin, Instagram) endi yo'q —
// shu sababli o'zimiz kichik SVG sifatida chizamiz.
function LinkedinGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
    </svg>
  );
}

function InstagramGlyph({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

const SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/in/farhod-gofurov-frontend-aa45a63b7/',
  instagram: 'https://www.instagram.com/code.farhod/',
  telegram: 'https://t.me/Farhod00111',
};

const SUGGESTIONS = [
  'Aka, ishlar qalay?',
  'Bugun nima qilsam boʻladi zerikmasdan?',
  'Bitta kulgili gap ayt',
  'Dasturlashni qayerdan boshlasam boʻladi?',
];

// --- Foydalanuvchiga xos localStorage kalitlari ---
function storageKey(base, email) {
  const safe = (email || 'mehmon').replace(/[^a-zA-Z0-9]/g, '_');
  return `${base}.${safe}`;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Vaqt (Date) qo'yilmagan holatda — server va mijoz birinchi renderda bir xil HTML
// chiqarishi uchun (aks holda "hydration mismatch" xatosi chiqadi).
function blankWelcome(name) {
  return {
    id: 'welcome',
    role: 'assistant',
    content: name
      ? `Nima gap, ${name} jigar? Men ToshkentGPT — savol ber, rasm/fayl tashla yoki shunchaki salomlash 👋`
      : 'Nima gap, jigar? Men ToshkentGPT — savol ber, rasm/fayl tashla yoki shunchaki salomlash 👋',
    time: null,
  };
}

function stampNow(message) {
  return { ...message, time: new Date().toISOString() };
}

// SSR-xavfsiz boshlang'ich holat (Date chaqirmaydi) — useState initializerida ishlatiladi.
function newSession() {
  return {
    id: crypto.randomUUID(),
    title: 'Yangi suhbat',
    messages: [blankWelcome()],
    lastInteractionId: null,
    updatedAt: null,
  };
}

// Faqat mijoz tomonida (useEffect/handler ichida) chaqiriladigan versiya — haqiqiy vaqt bilan.
function freshSession(name) {
  return {
    id: crypto.randomUUID(),
    title: 'Yangi suhbat',
    messages: [stampNow(blankWelcome(name))],
    lastInteractionId: null,
    updatedAt: new Date().toISOString(),
  };
}

function sessionTitle(messages) {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'Yangi suhbat';
  const text = firstUser.content?.trim() || 'Rasm/fayl yubordi';
  return text.length > 30 ? `${text.slice(0, 30)}…` : text;
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(iso) {
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

// Ovozda o'qishdan oldin markdown belgilarini (**, #, kod bloklari va h.k.) tozalaymiz —
// aks holda "yulduzcha yulduzcha" kabi belgilar ovozda eshitiladi.
function stripMarkdown(text) {
  return (text || '')
    .replace(/```[\s\S]*?```/g, ' kod boʻlagi ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~#>]+/g, '')
    .replace(/\n{2,}/g, '. ')
    .trim();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ============================================================
// Kirish darvozasi — avval Google orqali autentifikatsiyani tekshiradi.
// ============================================================
export default function ToshkentGPTGate() {
  const { data: authData, status } = useSession();

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

function SignInScreen() {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--tg-bg)] px-6 text-center">
      <GirihPattern />
      <div className="relative z-10 flex flex-col items-center">
        <img src="/icons/logo-header.png" alt="ToshkentGPT" className="tg-splash-logo h-20 w-20" />
        <h1
          className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--tg-text-1)]"
          style={{
            fontFamily: 'var(--font-display)',
            backgroundImage: 'linear-gradient(90deg, #F3EEE2, #E4A93B)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          ToshkentGPT'ga xush kelibsiz
        </h1>
        <p className="mt-2 max-w-xs text-sm text-[var(--tg-text-3)]">
          Davom etish uchun Google hisobing bilan kir — suhbatlaring shu hisobga saqlanadi.
        </p>

        <button
          onClick={() => signIn('google')}
          className="mt-8 flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-lg transition hover:bg-gray-100"
        >
          <GoogleGlyph />
          Google bilan kirish
        </button>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.1-5.1l-6.5-5.5C29.5 35.1 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5l6.5 5.5C40.9 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

// ============================================================
// Asosiy chat ilovasi — foydalanuvchi tasdiqlangandan keyingina ishga tushadi.
// ============================================================
function ToshkentGPT({ user }) {
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
  const [speechSupported, setSpeechSupported] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle'); // idle | sending | sent | error

  // --- Ro'yxatdan o'tishdagi bosqichli tanishuv (ism-familiya so'rash) ---
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [obStep, setObStep] = useState(1);
  const [obIsm, setObIsm] = useState('');
  const [obFamiliya, setObFamiliya] = useState('');

  const [plansOpen, setPlansOpen] = useState(false);
  const [plansView, setPlansView] = useState('list'); // list | pay | trial-ended
  const [paymentPlanId, setPaymentPlanId] = useState('pro');
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | sending | sent | error
  const [planInfo, setPlanInfo] = useState(null); // { id, name, mode, limit, used, remaining, resetAt }
  const [trialEndInfo, setTrialEndInfo] = useState(null); // { planId, unlockAt }
  const [trialStarting, setTrialStarting] = useState(false);

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
      alert(err.message);
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
  const [showSplash, setShowSplash] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const { theme, toggleTheme } = useTheme();

  const textareaRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

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
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

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
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSpeechSupported(false);
    } else {
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'uz-UZ';
      rec.onresult = (e) => {
        const transcript = e.results?.[0]?.[0]?.transcript || '';
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
    }
    if (!window.speechSynthesis) setTtsSupported(false);
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

  async function submitFeedback(e) {
    e.preventDefault();
    const text = feedbackMsg.trim();
    if (!text || feedbackStatus === 'sending') return;

    setFeedbackStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, from: user?.email || null }),
      });
      if (!res.ok) throw new Error('Xato');
      setFeedbackStatus('sent');
      setFeedbackMsg('');
    } catch {
      setFeedbackStatus('error');
    }
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

    addMessage('user', text, {
      image: currentAttachment?.kind === 'image' ? { dataUrl: currentAttachment.dataUrl, name: currentAttachment.name } : null,
      fileNote:
        currentAttachment && currentAttachment.kind !== 'image'
          ? `📎 ${currentAttachment.name}`
          : null,
    });

    setIsLoading(true);
    setErrorBanner(null);

    // Bot javobi kelayotganda to'ldirib boriladigan bo'sh xabar — "so'z-so'z" effekti shundan.
    const assistantId = crypto.randomUUID();
    updateMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', time: new Date().toISOString() },
    ]);

    try {
      let finalText = text;
      let imagePayload;

      if (currentAttachment?.kind === 'image') {
        imagePayload = {
          mimeType: currentAttachment.mimeType,
          data: currentAttachment.dataUrl.split(',')[1],
        };
        if (!finalText) finalText = 'Bu rasmda nima borligini aytib ber.';
      } else if (currentAttachment?.kind === 'text') {
        finalText = `${finalText}\n\n[Fayl: ${currentAttachment.name}]\n${currentAttachment.text.slice(0, 6000)}`;
      } else if (currentAttachment?.kind === 'video') {
        finalText = `${finalText}\n\n(Foydalanuvchi "${currentAttachment.name}" nomli video biriktirdi, lekin men hozircha video formatini koʻra olmayman — faqat nomini bilaman.)`;
      } else if (currentAttachment?.kind === 'file') {
        finalText = `${finalText}\n\n(Foydalanuvchi "${currentAttachment.name}" faylini biriktirdi, lekin bu turdagi faylni oʻqiy olmayman — faqat nomini bilaman.)`;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalText, image: imagePayload, previousInteractionId, profile }),
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
              prev.map((m) => (m.id === assistantId ? { ...m, content: finalContent, time: new Date().toISOString() } : m))
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
    window.speechSynthesis?.cancel();
    const fresh = freshSession(profile?.ism);
    setSession(fresh);
    setErrorBanner(null);
    setInput('');
    setAttachment(null);
    setHistoryOpen(false);
  }

  function openSession(s) {
    window.speechSynthesis?.cancel();
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

  function toggleListening() {
    if (!speechSupported || !recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }

  function toggleSpeak(msg) {
    if (!ttsSupported) return;
    if (speakingId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(stripMarkdown(msg.content));
    utter.lang = 'uz-UZ';
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);
    setSpeakingId(msg.id);
    window.speechSynthesis.speak(utter);
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

  const showSuggestions = session.messages.length === 1;
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[var(--tg-bg)] text-[var(--tg-text-1)]">
      {showSplash && (
        <div className="tg-splash-overlay fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[var(--tg-bg)]">
          <img src="/icons/logo-header.png" alt="ToshkentGPT" className="tg-splash-logo h-24 w-24" />
          <p
            className="tg-splash-logo text-sm font-bold tracking-tight text-[var(--tg-text-2)]"
            style={{ fontFamily: 'var(--font-display)', animationDelay: '0.1s' }}
          >
            ToshkentGPT
          </p>
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
      <GirihPattern />

      <header className="relative z-10 flex items-center justify-between border-b border-[var(--tg-border)] bg-[var(--tg-bg)]/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setHistoryOpen(true)}
            title="Suhbatlar"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
          >
            <Menu size={17} />
          </button>

          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
            <div
              className="tg-logo-ring absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, #2F9E96, #E4A93B, #2F9E96)',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
              }}
            />
            <span className="tg-logo-pulse absolute inset-0 rounded-full border border-[#2F9E96]/50" />
            <img src="/icons/logo-header.png" alt="ToshkentGPT" className="relative h-8 w-8 rounded-full" />
          </div>
          <div className="min-w-0">
            <h1
              className="truncate text-[15px] font-extrabold tracking-tight sm:text-base"
              style={{
                fontFamily: 'var(--font-display)',
                backgroundImage: 'linear-gradient(90deg, #F3EEE2, #E4A93B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ToshkentGPT
            </h1>
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--tg-text-3)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2F9E96] shadow-[0_0_0_3px_rgba(47,158,150,0.2)]" />
              <span className="hidden sm:inline">koʻcha tilida gaplashadi</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleNewChat}
            title="Yangi suhbat"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--tg-border)] px-3 py-1.5 text-xs font-medium text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Yangi suhbat</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setNavMenuOpen((v) => !v)}
              title="Sozlamalar"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
            >
              <Settings size={16} />
            </button>
            {navMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setNavMenuOpen(false)} />
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1 shadow-xl">
                  <button
                    onClick={() => {
                      toggleTheme();
                      setNavMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                  >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    {theme === 'dark' ? 'Yorugʻ rejim' : 'Qorongʻu rejim'}
                  </button>
                  <button
                    onClick={() => {
                      setFeedbackOpen(true);
                      setNavMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                  >
                    <MessageSquare size={14} />
                    Shikoyat va takliflar
                  </button>
                  <div className="my-1 h-px bg-[var(--tg-border)]" />
                  <button
                    onClick={() => {
                      setPlansView('list');
                      setPlansOpen(true);
                      setNavMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles size={14} />
                      Tariflar
                    </span>
                    <span className="rounded-full border border-[var(--tg-border)] px-1.5 py-0.5 text-[10px]">
                      {PLANS[planInfo?.id || 'lite'].name}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="ml-1 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--tg-border)]">
              {user?.image ? (
                <img src={user.image} alt={user.name || ''} className="h-full w-full object-cover" />
              ) : (
                <User size={14} className="text-[var(--tg-text-2)]" />
              )}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1 shadow-xl">
                  <div className="truncate px-3 py-2 text-xs text-[var(--tg-text-3)]">{user?.email}</div>
                  <button
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                  >
                    <LogOut size={13} />
                    Chiqish
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {errorBanner && (
        <div className="relative z-10 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-center text-xs text-red-300 sm:px-6">
          {errorBanner}
        </div>
      )}

      <main className="relative z-10 flex-1 overflow-y-auto px-3 py-6 sm:px-6 tg-scroll">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {session.messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`group flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${
                    isUser ? 'bg-[var(--tg-hover-strong)] text-[var(--tg-text-2)]' : 'border border-[#E4A93B]/25 bg-[#E4A93B]/10'
                  }`}
                >
                  {isUser ? (
                    user?.image ? (
                      <img src={user.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User size={15} />
                    )
                  ) : (
                    <img src="/icons/logo-header.png" alt="" className="h-full w-full" />
                  )}
                </div>

                <div className={`flex max-w-[80%] flex-col sm:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`overflow-hidden rounded-2xl text-[14px] leading-relaxed ${
                      isUser
                        ? 'rounded-tr-sm text-[#0D0F14] font-semibold'
                        : 'rounded-tl-sm border border-[#E4A93B]/10 bg-[var(--tg-surface)] text-[var(--tg-text-1)]'
                    }`}
                    style={isUser ? { background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' } : undefined}
                  >
                    {msg.image?.dataUrl && (
                      <img src={msg.image.dataUrl} alt={msg.image.name || 'rasm'} className="max-h-64 w-full object-cover" />
                    )}
                    {!isUser && !msg.content && isLoading && msg.id === session.messages[session.messages.length - 1]?.id ? (
                      <div className="flex items-center gap-1 px-4 py-3.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#E4A93B] [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#E4A93B] [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#E4A93B]" />
                      </div>
                    ) : (
                      (msg.content || msg.fileNote) && (
                        <div className="break-words px-4 py-2.5">
                          {msg.fileNote && <div className="mb-1 text-[12px] opacity-80">{msg.fileNote}</div>}
                          {isUser ? (
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          ) : (
                            <MarkdownMessage content={msg.content} />
                          )}
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-2 px-1">
                    {msg.time && <span className="text-[11px] text-[var(--tg-text-4)]">{formatTime(msg.time)}</span>}
                    <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {msg.content && (
                        <button
                          onClick={() => copyMessage(msg)}
                          title="Nusxa olish"
                          className="text-[var(--tg-text-3)] transition-colors hover:text-[var(--tg-text-1)]"
                        >
                          {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                      {!isUser && ttsSupported && msg.content && (
                        <button
                          onClick={() => toggleSpeak(msg)}
                          title="Ovozda eshitish"
                          className={`transition-colors hover:text-[var(--tg-text-1)] ${
                            speakingId === msg.id ? 'text-[#2F9E96]' : 'text-[var(--tg-text-3)]'
                          }`}
                        >
                          {speakingId === msg.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {showSuggestions && !isLoading && (
            <div className="ml-11 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSendText(s)}
                  className="rounded-full border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3.5 py-2 text-left text-[13px] text-[var(--tg-text-1)] transition-colors hover:bg-[var(--tg-hover-strong)]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div ref={scrollAnchorRef} />
        </div>
      </main>

      <footer className="relative z-10 border-t border-[var(--tg-border)] bg-[var(--tg-bg)] px-3 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {planInfo && (planInfo.mode === 'trial' || planInfo.remaining <= 3) && (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3 py-1.5 text-[11px] text-[var(--tg-text-2)]">
              <span>
                {planInfo.mode === 'trial' ? `${planInfo.name} sinovi` : planInfo.name}: {planInfo.remaining}/{planInfo.limit} xabar qoldi
              </span>
              {planInfo.resetAt && <span>Soat {formatTime(planInfo.resetAt)}da yangilanadi</span>}
            </div>
          )}

          {attachment && (
            <div className="tg-pop-in mb-2 flex items-center gap-2.5 rounded-xl border border-[#E4A93B]/30 bg-[var(--tg-surface-2)] px-3 py-2">
              {attachment.kind === 'image' ? (
                <img src={attachment.dataUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
              ) : attachment.kind === 'video' ? (
                attachment.dataUrl ? (
                  <video src={attachment.dataUrl} muted className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[#E4A93B]">
                    <Film size={16} />
                  </div>
                )
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[#E4A93B]">
                  <Paperclip size={16} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-medium uppercase tracking-wide text-[#E4A93B]">
                  {attachment.kind === 'image' ? 'Rasm biriktirildi' : attachment.kind === 'video' ? 'Video biriktirildi' : 'Fayl biriktirildi'}
                </p>
                <p className="truncate text-xs text-[var(--tg-text-2)]">{attachment.name}</p>
              </div>
              <button
                onClick={() => setAttachment(null)}
                title="Olib tashlash"
                className="flex-shrink-0 text-[var(--tg-text-3)] transition hover:text-[var(--tg-text-1)]"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-2 transition focus-within:border-[#E4A93B]/40">
            <input ref={fileInputRef} type="file" onChange={handleFilePicked} className="hidden" accept="image/*,video/*,.txt,.md,.json,.csv,.log,.pdf,.doc,.docx" />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Rasm, video yoki fayl biriktirish"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
            >
              <Paperclip size={16} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder="Yoz, jigar... (rasm/video uchun Ctrl+V ham boʻladi)"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[var(--tg-text-1)] placeholder-[var(--tg-text-3)] outline-none"
            />

            {speechSupported && (
              <button
                onClick={toggleListening}
                title={listening ? 'Yozishni toʻxtatish' : 'Ovoz bilan yozish'}
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition ${
                  listening ? 'bg-red-500/15 text-red-400' : 'text-[var(--tg-text-2)] hover:bg-[var(--tg-hover)]'
                }`}
              >
                {listening ? <Square size={14} /> : <Mic size={16} />}
              </button>
            )}

            {isLoading ? (
              <button
                onClick={stopGeneration}
                title="Toʻxtatish"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tg-hover-strong)] text-[var(--tg-text-1)] transition hover:opacity-90"
                aria-label="Javob berishni toʻxtatish"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => handleSendText()}
                disabled={!input.trim() && !attachment}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-30"
                style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
                aria-label="Xabarni yuborish"
              >
                <Send size={15} />
              </button>
            )}
          </div>

          <p className="mt-2 text-center text-[11px] text-[var(--tg-text-4)]">
            ToshkentGPT xato qilishi mumkin · Enter — yuborish, Shift+Enter — yangi qator
          </p>
        </div>
      </footer>

      {historyOpen && (
        <div className="fixed inset-0 z-40 flex justify-start">
          <div className="absolute inset-0 bg-[var(--tg-overlay)]" onClick={() => setHistoryOpen(false)} />
          <div className="tg-sidebar-in relative flex h-full w-full max-w-xs flex-col border-r border-[var(--tg-border)] bg-[var(--tg-bg)] p-4">
            <div className="mb-4 flex items-center gap-2.5">
              <img src="/icons/logo-header.png" alt="" className="h-7 w-7 flex-shrink-0 rounded-full" />
              <h2
                className="flex-1 truncate text-[15px] font-extrabold tracking-tight"
                style={{
                  fontFamily: 'var(--font-display)',
                  backgroundImage: 'linear-gradient(90deg, #F3EEE2, #E4A93B)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                ToshkentGPT
              </h2>
              <button
                onClick={() => setHistoryOpen(false)}
                className="flex-shrink-0 text-[var(--tg-text-3)] transition hover:text-[var(--tg-text-1)]"
              >
                <X size={16} />
              </button>
            </div>

            <button
              onClick={handleNewChat}
              className="mb-4 flex w-full flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#0D0F14] transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              <Plus size={16} />
              Yangi suhbat
            </button>

            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
              <History size={12} />
              Suhbatlar
            </p>
            <div className="flex-1 space-y-1.5 overflow-y-auto tg-scroll">
              {sortedSessions.length === 0 && (
                <p className="mt-6 text-center text-xs text-[var(--tg-text-4)]">Hali suhbat yoʻq.</p>
              )}
              {sortedSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s)}
                  className={`group flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                    s.id === session.id
                      ? 'border-[#E4A93B]/30 bg-[#E4A93B]/10'
                      : 'border-[var(--tg-border)] bg-[var(--tg-hover)] hover:bg-[var(--tg-hover)]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[var(--tg-text-1)]">{s.title}</p>
                    <p className="text-[10.5px] text-[var(--tg-text-4)]">{formatRelative(s.updatedAt)}</p>
                  </div>
                  <span
                    onClick={(e) => deleteSession(s.id, e)}
                    className="opacity-0 text-[var(--tg-text-4)] transition hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {feedbackOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--tg-overlay)]" onClick={() => setFeedbackOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--tg-text-1)]">Shikoyat va takliflar</h2>
              <button onClick={() => setFeedbackOpen(false)} className="text-[var(--tg-text-3)] hover:text-[var(--tg-text-1)]">
                <X size={16} />
              </button>
            </div>

            <p className="mb-3 text-xs text-[var(--tg-text-3)]">Murojaat uchun ijtimoiy tarmoqlarimiz:</p>
            <div className="mb-4 flex items-center gap-3">
              <a
                href={SOCIAL_LINKS.linkedin}
                target="_blank"
                rel="noreferrer"
                title="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[#0A66C2]/50 hover:text-[#0A66C2]"
              >
                <LinkedinGlyph size={16} />
              </a>
              <a
                href={SOCIAL_LINKS.instagram}
                target="_blank"
                rel="noreferrer"
                title="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[#E1306C]/50 hover:text-[#E1306C]"
              >
                <InstagramGlyph size={16} />
              </a>
              <a
                href={SOCIAL_LINKS.telegram}
                target="_blank"
                rel="noreferrer"
                title="Telegram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[#2AABEE]/50 hover:text-[#2AABEE]"
              >
                <Send size={16} />
              </a>
            </div>

            <form onSubmit={submitFeedback} className="space-y-2">
              <textarea
                value={feedbackMsg}
                onChange={(e) => setFeedbackMsg(e.target.value)}
                placeholder="Fikr-mulohaza yoki shikoyatingizni yozing..."
                rows={4}
                required
                className="w-full resize-none rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-3 text-sm text-[var(--tg-text-1)] outline-none placeholder-[var(--tg-text-3)] focus:border-[#E4A93B]/40"
              />
              <button
                type="submit"
                disabled={feedbackStatus === 'sending'}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
              >
                {feedbackStatus === 'sending' ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
              {feedbackStatus === 'sent' && (
                <p className="text-center text-xs text-[#2F9E96]">Rahmat! Xabaringiz yuborildi.</p>
              )}
              {feedbackStatus === 'error' && (
                <p className="text-center text-xs text-red-400">Xatolik yuz berdi, qayta urinib koʻring.</p>
              )}
            </form>
          </div>
        </div>
      )}

      {plansOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--tg-overlay)]" onClick={() => setPlansOpen(false)} />
          <div
            className={`relative max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-5 tg-scroll ${
              plansView === 'list' ? 'max-w-3xl' : 'max-w-sm'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--tg-text-1)]">
                {plansView === 'list'
                  ? 'Tariflar'
                  : plansView === 'trial-ended'
                    ? "Sinov vaqti tugadi"
                    : `${PLANS[paymentPlanId].name}ga o'tish`}
              </h2>
              <button
                onClick={() => setPlansOpen(false)}
                className="text-[var(--tg-text-3)] hover:text-[var(--tg-text-1)]"
              >
                <X size={16} />
              </button>
            </div>

            {plansView === 'trial-ended' && trialEndInfo && (
              <div className="text-center">
                <Clock size={28} className="mx-auto mb-2 text-[#E4A93B]" />
                <p className="text-sm text-[var(--tg-text-1)]">
                  {PLANS[trialEndInfo.planId]?.name || 'Pro'} bepul sinovi limitiga yetdingiz.
                </p>
                <p className="mt-1 text-xs text-[var(--tg-text-3)]">
                  Soat <b className="text-[var(--tg-text-1)]">{formatTime(trialEndInfo.unlockAt)}</b>da yana bepul sinab
                  ko'rishingiz mumkin. Yoki hoziroq sotib olib, cheklovsiz foydalaning.
                </p>
                <button
                  onClick={() => {
                    setPaymentPlanId(trialEndInfo.planId || 'pro');
                    setPlansView('pay');
                    setPaymentStatus('idle');
                  }}
                  className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14]"
                  style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
                >
                  Hoziroq sotib olish
                </button>
                <button
                  onClick={() => setPlansOpen(false)}
                  className="mt-2 w-full text-center text-[11px] text-[var(--tg-text-3)] underline"
                >
                  Kutib turaman
                </button>
              </div>
            )}

            {plansView === 'list' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PLAN_ORDER.map((id) => {
                  const plan = PLANS[id];
                  const isCurrent = (planInfo?.id || 'lite') === id;
                  const TierIcon = { lite: Sparkles, pro: Zap, max: Crown, promax: Flame }[id];
                  return (
                    <div
                      key={id}
                      className={`flex flex-col rounded-2xl border p-4 transition ${
                        isCurrent
                          ? 'border-[#E4A93B]/60 bg-[#E4A93B]/[0.04]'
                          : 'border-[var(--tg-border)] bg-[var(--tg-surface-2)]'
                      }`}
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[#0D0F14]"
                        style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
                      >
                        <TierIcon size={16} />
                      </div>

                      <p className="mt-3 text-base font-bold text-[var(--tg-text-1)]">{plan.name}</p>
                      <p className="mb-3 text-xs text-[var(--tg-text-3)]">{plan.tagline}</p>

                      <p className="text-2xl font-extrabold tracking-tight text-[var(--tg-text-1)]">
                        {plan.priceAmount === 0 ? (
                          '0 soʻm'
                        ) : (
                          <>
                            {plan.priceAmount.toLocaleString('ru-RU')}
                            <span className="text-sm font-medium text-[var(--tg-text-3)]"> soʻm/oy</span>
                          </>
                        )}
                      </p>

                      <div className="mt-4">
                        {isCurrent ? (
                          <span className="flex w-full items-center justify-center rounded-xl bg-[var(--tg-hover)] px-3 py-2.5 text-xs font-semibold text-[var(--tg-text-2)]">
                            Joriy tarifingiz
                          </span>
                        ) : plan.paid ? (
                          <div className="space-y-1.5">
                            <button
                              onClick={() => openUpgrade(id)}
                              className="w-full rounded-xl py-2.5 text-xs font-semibold text-[#0D0F14] transition hover:opacity-90"
                              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
                            >
                              {plan.name} tarifini olish
                            </button>
                            {plan.trial && (planInfo?.id || 'lite') === 'lite' && (
                              <button
                                onClick={() => startTrial(id)}
                                disabled={trialStarting}
                                className="w-full rounded-xl border border-[var(--tg-border)] py-2 text-[11px] font-medium text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)] disabled:opacity-50"
                              >
                                {trialStarting ? 'Boshlanmoqda...' : 'Avval bepul sinab ko\u2018ring'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="flex w-full items-center justify-center rounded-xl border border-[var(--tg-border)] px-3 py-2.5 text-xs font-medium text-[var(--tg-text-2)]">
                            Doim mavjud
                          </span>
                        )}
                      </div>

                      <div className="my-4 h-px bg-[var(--tg-border)]" />

                      <ul className="space-y-2">
                        {plan.featuresIntro && (
                          <li className="text-[11px] font-medium text-[var(--tg-text-3)]">{plan.featuresIntro}</li>
                        )}
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-[12px] text-[var(--tg-text-2)]">
                            <Check size={13} className="mt-0.5 flex-shrink-0 text-[#2F9E96]" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            {plansView === 'pay' && (
              <div>
                {paymentStatus === 'sent' ? (
                  <div className="py-4 text-center">
                    <Check size={28} className="mx-auto mb-2 text-[#2F9E96]" />
                    <p className="text-sm text-[var(--tg-text-1)]">So'rovingiz yuborildi!</p>
                    <p className="mt-1 text-xs text-[var(--tg-text-3)]">
                      To'lov tekshirilgach, {PLANS[paymentPlanId].name} tarifi 24 soat ichida faollashadi.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-xs text-[var(--tg-text-3)]">
                      Quyidagi kartaga <b className="text-[var(--tg-text-1)]">{PLANS[paymentPlanId].priceLabel}</b> miqdorida
                      o'tkazing, so'ng "To'ladim" tugmasini bosing.
                    </p>
                    <div className="mb-4 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-3">
                      <p className="text-[10.5px] uppercase tracking-wide text-[var(--tg-text-3)]">{PAYMENT_CARD.bank}</p>
                      <p className="mt-1 text-base font-semibold tracking-wider text-[var(--tg-text-1)]">
                        {PAYMENT_CARD.number}
                      </p>
                      <p className="mt-1 text-xs text-[var(--tg-text-3)]">{PAYMENT_CARD.holder}</p>
                    </div>
                    <button
                      onClick={requestUpgrade}
                      disabled={paymentStatus === 'sending'}
                      className="w-full rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
                    >
                      {paymentStatus === 'sending' ? 'Yuborilmoqda...' : "To'ladim"}
                    </button>
                    {paymentStatus === 'error' && (
                      <p className="mt-2 text-center text-xs text-red-400">Xatolik yuz berdi, qayta urinib ko'ring.</p>
                    )}
                    <button
                      onClick={() => setPlansView('list')}
                      className="mt-2 w-full text-center text-[11px] text-[var(--tg-text-3)] underline"
                    >
                      Orqaga
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Ro'yxatdan o'tishdagi tanishuv — Google bilan birinchi marta kirgandan keyin
// ism (va ixtiyoriy familiya) so'raladi. Natija profilga (demak, "xotira"ga) yoziladi.
// ============================================================
function OnboardingFlow({
  step,
  ism,
  familiya,
  userImage,
  onIsmChange,
  onFamiliyaChange,
  onNext,
  onBack,
  onFinish,
  onSkip,
}) {
  function handleStep1Submit(e) {
    e.preventDefault();
    if (ism.trim()) onNext();
  }

  function handleStep2Submit(e) {
    e.preventDefault();
    onFinish();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[var(--tg-bg)] px-6 text-center">
      <GirihPattern />
      <div className="relative z-10 flex w-full max-w-xs flex-col items-center">
        {userImage ? (
          <img src={userImage} alt="" className="h-16 w-16 rounded-full border-2 border-[#E4A93B]/40 object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#E4A93B]/25 bg-[#E4A93B]/10">
            <User size={24} className="text-[#E4A93B]" />
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="mt-5 w-full">
            <h1
              className="text-xl font-extrabold tracking-tight text-[var(--tg-text-1)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Tanishib olaylik!
            </h1>
            <p className="mt-2 text-sm text-[var(--tg-text-3)]">Sizni qanday chaqiray, jigar?</p>
            <input
              autoFocus
              value={ism}
              onChange={(e) => onIsmChange(e.target.value)}
              placeholder="Ismingiz"
              maxLength={40}
              className="mt-5 w-full rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] px-4 py-3 text-center text-sm text-[var(--tg-text-1)] outline-none placeholder-[var(--tg-text-3)] focus:border-[#E4A93B]/40"
            />
            <button
              type="submit"
              disabled={!ism.trim()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              Davom etish
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="mt-3 text-[11px] text-[var(--tg-text-4)] underline underline-offset-2 hover:text-[var(--tg-text-2)]"
            >
              Hozircha oʻtkazib yuborish
            </button>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} className="mt-5 w-full">
            <h1
              className="text-xl font-extrabold tracking-tight text-[var(--tg-text-1)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Rahmat, {ism.trim()}!
            </h1>
            <p className="mt-2 text-sm text-[var(--tg-text-3)]">Familiyangizni ham qoldirasizmi? (ixtiyoriy)</p>
            <input
              autoFocus
              value={familiya}
              onChange={(e) => onFamiliyaChange(e.target.value)}
              placeholder="Familiyangiz"
              maxLength={40}
              className="mt-5 w-full rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] px-4 py-3 text-center text-sm text-[var(--tg-text-1)] outline-none placeholder-[var(--tg-text-3)] focus:border-[#E4A93B]/40"
            />
            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-[#0D0F14] transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              <Check size={15} />
              Boshlaymiz
            </button>
            <button
              type="button"
              onClick={onBack}
              className="mt-3 flex w-full items-center justify-center gap-1 text-[11px] text-[var(--tg-text-4)] hover:text-[var(--tg-text-2)]"
            >
              <ArrowLeft size={12} />
              Orqaga
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center gap-1.5">
          <span className={`h-1.5 rounded-full transition-all ${step === 1 ? 'w-5 bg-[#E4A93B]' : 'w-1.5 bg-[var(--tg-border-strong)]'}`} />
          <span className={`h-1.5 rounded-full transition-all ${step === 2 ? 'w-5 bg-[#E4A93B]' : 'w-1.5 bg-[var(--tg-border-strong)]'}`} />
        </div>
      </div>
    </div>
  );
}

function GirihPattern() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]">
      <defs>
        <pattern id="girih" width="64" height="64" patternUnits="userSpaceOnUse">
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
      <rect width="100%" height="100%" fill="url(#girih)" />
    </svg>
  );
}
