'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  History,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Send,
  Square,
  Trash2,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

const SESSIONS_KEY = 'toshkentgpt.sessions.v1';
const ACTIVE_KEY = 'toshkentgpt.activeId.v1';

const SUGGESTIONS = [
  'Aka, ishlar qalay?',
  'Bugun nima qilsam boʻladi zerikmasdan?',
  'Bitta kulgili gap ayt',
  'Dasturlashni qayerdan boshlasam boʻladi?',
];

// Vaqt (Date) qo'yilmagan holatda — server va mijoz birinchi renderda bir xil HTML
// chiqarishi uchun (aks holda "hydration mismatch" xatosi chiqadi).
function blankWelcome() {
  return {
    id: 'welcome',
    role: 'assistant',
    content: 'Nima gap, jigar? Men ToshkentGPT — savol ber, rasm/fayl tashla yoki shunchaki salomlash 👋',
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
function freshSession() {
  return {
    id: crypto.randomUUID(),
    title: 'Yangi suhbat',
    messages: [stampNow(blankWelcome())],
    lastInteractionId: null,
    updatedAt: new Date().toISOString(),
  };
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
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

export default function ToshkentGPT() {
  const [session, setSession] = useState(newSession);
  const [sessions, setSessions] = useState([]);
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
  const [showSplash, setShowSplash] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const textareaRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- Ilova birinchi ochilganda: saqlangan suhbatlarni tiklash (faqat mijozda) ---
  useEffect(() => {
    const stored = loadSessions();
    const activeId = localStorage.getItem(ACTIVE_KEY);
    if (stored.length > 0) {
      setSessions(stored);
      const active = stored.find((s) => s.id === activeId) || stored[0];
      setSession(active);
    } else {
      const fresh = freshSession();
      setSessions([fresh]);
      setSession(fresh);
      saveSessions([fresh]);
      localStorage.setItem(ACTIVE_KEY, fresh.id);
    }
    setHydrated(true);

    const t = setTimeout(() => setShowSplash(false), 1600);
    return () => clearTimeout(t);
  }, []);

  // --- Har bir o'zgarishda joriy suhbatni saqlab boramiz ("istoriya") ---
  useEffect(() => {
    if (!hydrated) return;
    setSessions((prev) => {
      const next = prev.some((s) => s.id === session.id)
        ? prev.map((s) => (s.id === session.id ? session : s))
        : [session, ...prev];
      saveSessions(next);
      return next;
    });
    localStorage.setItem(ACTIVE_KEY, session.id);
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
      } else if (currentAttachment?.kind === 'file') {
        finalText = `${finalText}\n\n(Foydalanuvchi "${currentAttachment.name}" faylini biriktirdi, lekin bu turdagi faylni oʻqiy olmayman — faqat nomini bilaman.)`;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalText, image: imagePayload, previousInteractionId }),
      });

      if (!res.ok) throw new Error(`Server xatosi: ${res.status}`);

      const data = await res.json();
      addMessage('assistant', data.response ?? 'Javob topilmadi.');
      if (data.interactionId) {
        setSession((prev) => ({ ...prev, lastInteractionId: data.interactionId }));
      }
    } catch (err) {
      console.error(err);
      setErrorBanner('Serverga ulanishda xatolik yuz berdi. .env.local dagi API kalitni tekshiring.');
    } finally {
      setIsLoading(false);
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
    const fresh = freshSession();
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
      saveSessions(next);
      return next;
    });
    if (session.id === id) {
      setSession(freshSession());
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
    const utter = new SpeechSynthesisUtterance(msg.content);
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

  async function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const dataUrl = await fileToDataUrl(file);
      setAttachment({ kind: 'image', mimeType: file.type, dataUrl, name: file.name });
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

  const showSuggestions = session.messages.length === 1;
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#0D0F14] text-gray-100">
      {showSplash && (
        <div className="tg-splash-overlay fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0D0F14]">
          <img src="/icons/logo-header.png" alt="ToshkentGPT" className="tg-splash-logo h-24 w-24" />
          <p
            className="tg-splash-logo text-sm font-bold tracking-tight text-gray-300"
            style={{ fontFamily: 'var(--font-display)', animationDelay: '0.1s' }}
          >
            ToshkentGPT
          </p>
        </div>
      )}

      <GirihPattern />

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-[#0D0F14]/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
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
          <div>
            <h1
              className="text-[15px] font-extrabold tracking-tight sm:text-base"
              style={{
                fontFamily: 'var(--font-display)',
                backgroundImage: 'linear-gradient(90deg, #F3EEE2, #E4A93B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ToshkentGPT
            </h1>
            <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2F9E96] shadow-[0_0_0_3px_rgba(47,158,150,0.2)]" />
              koʻcha tilida gaplashadi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/5"
          >
            <History size={14} />
            <span className="hidden sm:inline">Tarix</span>
          </button>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/5"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Yangi suhbat</span>
          </button>
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
                    isUser ? 'bg-white/10 text-gray-300' : 'border border-[#E4A93B]/25 bg-[#E4A93B]/10'
                  }`}
                >
                  {isUser ? <User size={15} /> : <img src="/icons/logo-header.png" alt="" className="h-full w-full" />}
                </div>

                <div className={`flex max-w-[80%] flex-col sm:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`overflow-hidden rounded-2xl text-[14px] leading-relaxed ${
                      isUser
                        ? 'rounded-tr-sm text-[#0D0F14] font-semibold'
                        : 'rounded-tl-sm border border-[#E4A93B]/10 bg-[#171A21] text-gray-100'
                    }`}
                    style={isUser ? { background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' } : undefined}
                  >
                    {msg.image?.dataUrl && (
                      <img src={msg.image.dataUrl} alt={msg.image.name || 'rasm'} className="max-h-64 w-full object-cover" />
                    )}
                    {(msg.content || msg.fileNote) && (
                      <div className="whitespace-pre-wrap break-words px-4 py-2.5">
                        {msg.fileNote && <div className="mb-1 text-[12px] opacity-80">{msg.fileNote}</div>}
                        {msg.content}
                      </div>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-2 px-1">
                    {msg.time && <span className="text-[11px] text-gray-600">{formatTime(msg.time)}</span>}
                    <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {msg.content && (
                        <button
                          onClick={() => copyMessage(msg)}
                          title="Nusxa olish"
                          className="text-gray-500 transition-colors hover:text-gray-200"
                        >
                          {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                      {!isUser && ttsSupported && msg.content && (
                        <button
                          onClick={() => toggleSpeak(msg)}
                          title="Ovozda eshitish"
                          className={`transition-colors hover:text-gray-200 ${
                            speakingId === msg.id ? 'text-[#2F9E96]' : 'text-gray-500'
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
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-left text-[13px] text-gray-200 transition-colors hover:bg-white/[0.08]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E4A93B]/25 bg-[#E4A93B]/10">
                <img src="/icons/logo-header.png" alt="" className="h-full w-full" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-[#E4A93B]/10 bg-[#171A21] px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#E4A93B] [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#E4A93B] [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#E4A93B]" />
              </div>
            </div>
          )}

          <div ref={scrollAnchorRef} />
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-[#0D0F14] px-3 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {attachment && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-[#14161C] px-3 py-2">
              {attachment.kind === 'image' ? (
                <img src={attachment.dataUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <Paperclip size={16} className="text-gray-400" />
              )}
              <span className="flex-1 truncate text-xs text-gray-300">{attachment.name}</span>
              <button onClick={() => setAttachment(null)} className="text-gray-500 hover:text-gray-200">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#14161C] p-2 transition focus-within:border-[#E4A93B]/40">
            <input ref={fileInputRef} type="file" onChange={handleFilePicked} className="hidden" accept="image/*,.txt,.md,.json,.csv,.log,.pdf,.doc,.docx" />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Rasm yoki fayl biriktirish"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/5"
            >
              <Paperclip size={16} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Yoz, jigar..."
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none"
            />

            {speechSupported && (
              <button
                onClick={toggleListening}
                title={listening ? 'Yozishni toʻxtatish' : 'Ovoz bilan yozish'}
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition ${
                  listening ? 'bg-red-500/15 text-red-400' : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                {listening ? <Square size={14} /> : <Mic size={16} />}
              </button>
            )}

            <button
              onClick={() => handleSendText()}
              disabled={(!input.trim() && !attachment) || isLoading}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
              aria-label="Xabarni yuborish"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>

          <p className="mt-2 text-center text-[11px] text-gray-600">
            ToshkentGPT xato qilishi mumkin · Enter — yuborish, Shift+Enter — yangi qator
          </p>
        </div>
      </footer>

      {historyOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setHistoryOpen(false)} />
          <div className="relative flex h-full w-full max-w-xs flex-col border-l border-white/10 bg-[#0D0F14] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-100">Suhbatlar tarixi</h2>
              <button onClick={() => setHistoryOpen(false)} className="text-gray-500 hover:text-gray-200">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto tg-scroll">
              {sortedSessions.length === 0 && (
                <p className="mt-6 text-center text-xs text-gray-600">Hali suhbat yoʻq.</p>
              )}
              {sortedSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s)}
                  className={`group flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                    s.id === session.id
                      ? 'border-[#E4A93B]/30 bg-[#E4A93B]/10'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-200">{s.title}</p>
                    <p className="text-[10.5px] text-gray-600">{formatRelative(s.updatedAt)}</p>
                  </div>
                  <span
                    onClick={(e) => deleteSession(s.id, e)}
                    className="opacity-0 text-gray-600 transition hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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
