'use client';
 
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
 
import { PLANS } from './plans';
import { storageKey, loadJSON, saveJSON } from '@/lib/storage';
import { blankWelcome, stampNow, newSession, freshSession, sessionTitle } from '@/lib/session';
import { stripMarkdown } from '@/lib/format';
import { fileToDataUrl, fileToText } from '@/lib/files';
 
import SignInScreen from '@/components/SignInScreen';
import SplashScreen from '@/components/SplashScreen';
import OnboardingFlow from '@/components/OnboardingFlow';
import GirihPattern from '@/components/GirihPattern';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';
import PlansModal from '@/components/PlansModal';
import { useTheme } from './use-theme';
 
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
  const [speechSupported, setSpeechSupported] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
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
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: finalContent, image: evt.image || m.image, time: new Date().toISOString() }
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
        planId={planInfo?.id}
        navMenuOpen={navMenuOpen}
        onToggleNavMenu={() => setNavMenuOpen((v) => !v)}
        onCloseNavMenu={() => setNavMenuOpen(false)}
        avatarMenuOpen={menuOpen}
        onToggleAvatarMenu={() => setMenuOpen((v) => !v)}
        onCloseAvatarMenu={() => setMenuOpen(false)}
        onOpenHistory={() => setHistoryOpen(true)}
        onNewChat={handleNewChat}
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
        ttsSupported={ttsSupported}
        onCopy={copyMessage}
        onToggleSpeak={toggleSpeak}
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
        onToggleListening={toggleListening}
        isLoading={isLoading}
        onStop={stopGeneration}
        onSend={() => handleSendText()}
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
    </div>
  );
}