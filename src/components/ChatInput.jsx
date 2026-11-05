'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paperclip,
  Mic,
  Square,
  ArrowUp,
  X,
  Film,
  FileText,
  Brain,
  Loader2,
  ChevronDown,
  Plus,
  AudioLines,
  Music,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { PLANS } from '@/app/plans';
import { COMMANDS } from '@/lib/commands';
import { formatBytes } from '@/lib/upload-limits';

// Tashqariga bosilganda ochilgan menyuni yopadi ('click' ishlatiladi,
// 'pointerdown' emas — aks holda tugma bosilishi ULGURMASDAN yopilib qolardi).
function useMenuClose(open, onClose, ref) {
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

const CATEGORY_ICON = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  doc: FileText,
  text: FileText,
  file: Paperclip,
};

const CATEGORY_LABEL = {
  image: 'Rasm',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  doc: 'Hujjat',
  text: 'Matn',
  file: 'Fayl',
};

// ============================================================
// Biriktirma chipi — rasm/video uchun kichik ko'rinish, qolganlari uchun
// ikonka. Yuklanayotganda (Blob) foiz chizig'i ko'rinadi.
// ============================================================
function AttachmentChip({ att, onRemove }) {
  const Icon = CATEGORY_ICON[att.category] || Paperclip;
  const uploading = att.status === 'uploading';
  return (
    <div
      className="tg-pop-in relative flex items-center gap-2 overflow-hidden rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] py-1.5 pl-1.5 pr-2 text-left"
      title={att.name}
    >
      {att.category === 'image' && att.previewUrl ? (
        <img src={att.previewUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />
      ) : att.category === 'video' && att.previewUrl ? (
        <video src={att.previewUrl} muted className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[var(--tg-gold)]">
          <Icon size={15} />
        </span>
      )}
      <span className="min-w-0 max-w-[150px]">
        <span className="block truncate text-[12px] font-medium text-[var(--tg-text-1)]">{att.name}</span>
        <span className="block text-[10.5px] text-[var(--tg-text-4)]">
          {uploading ? `Yuklanmoqda ${att.progress ?? 0}%` : `${CATEGORY_LABEL[att.category] || 'Fayl'}${att.size ? ` · ${formatBytes(att.size)}` : ''}`}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onRemove(att.id)}
        title="Olib tashlash"
        aria-label="Biriktirmani olib tashlash"
        className="ml-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[var(--tg-text-4)] transition hover:bg-[var(--tg-hover-strong)] hover:text-[var(--tg-text-1)]"
      >
        <X size={12} />
      </button>
      {uploading && (
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--tg-hover)]">
          <span
            className="block h-full rounded-r-full transition-all"
            style={{ width: `${att.progress ?? 0}%`, background: 'linear-gradient(90deg, var(--tg-gold), var(--tg-teal))' }}
          />
        </span>
      )}
    </div>
  );
}

// ============================================================
// Yozish qatori — zamonaviy AI ilovalardagi kabi "suzuvchi" karta:
//   * tepada biriktirma chiplari (bir nechta, rasm/video ko'rinishi bilan),
//   * matn maydoni,
//   * pastda: + (buyruqlar), 📎, 🧠 chuqur o'ylash, tarif; o'ngda 🎤, jonli
//     suhbat va yuborish tugmasi.
// "/" bilan boshlansa — buyruqlar ro'yxati darhol ochiladi (avtoto'ldirish).
//
// centered=true bo'lsa (suhbat hali boshlanmagan) quti ekran o'rtasida turadi.
// ============================================================
export default function ChatInput({
  planInfo,
  attachments = [],
  onRemoveAttachment,
  fileInputRef,
  onFilesPicked,
  textareaRef,
  input,
  onInputChange,
  onKeyDown,
  onPaste,
  speechSupported,
  listening,
  transcribing,
  onToggleListening,
  isLoading,
  onStop,
  onSend,
  deepThink,
  onToggleDeepThink,
  onCommandPick,
  onOpenVoice,
  centered = false,
}) {
  const router = useRouter();
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const planMenuRef = useRef(null);
  // "+" menyusi — suhbat davomida ham buyruqlarni eslab o'tirmasdan tanlash uchun.
  const [cmdMenuOpen, setCmdMenuOpen] = useState(false);
  const cmdMenuRef = useRef(null);
  const [slashIndex, setSlashIndex] = useState(0);
  useMenuClose(cmdMenuOpen, () => setCmdMenuOpen(false), cmdMenuRef);
  useMenuClose(planMenuOpen, () => setPlanMenuOpen(false), planMenuRef);

  const uploading = attachments.some((a) => a.status === 'uploading');
  const canSend = Boolean(input.trim() || attachments.length) && !uploading;

  // "/" avtoto'ldirish: foydalanuvchi "/ra" deb yozsa, "/rasm" taklif qilinadi.
  const slashMatches = useMemo(() => {
    const m = /^\/([a-z]*)$/i.exec(input);
    if (!m) return [];
    const q = m[1].toLowerCase();
    return COMMANDS.filter((c) => c.id.startsWith(q) || c.prefix.trim().slice(1).startsWith(q));
  }, [input]);
  const slashOpen = slashMatches.length > 0;

  useEffect(() => {
    setSlashIndex(0);
  }, [input]);

  function handleKeyDown(e) {
    if (slashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        onCommandPick?.(slashMatches[slashIndex].prefix);
        return;
      }
      if (e.key === 'Escape') {
        onInputChange('');
        return;
      }
    }
    onKeyDown?.(e);
  }

  const Shell = centered ? 'div' : 'footer';

  return (
    <Shell className={centered ? 'relative z-10 w-full' : 'relative z-10 px-3 pb-3 pt-2 sm:px-6'}>
      <div className={centered ? 'w-full' : 'mx-auto max-w-3xl'}>
        <div className="relative">
          {/* "/" buyruq takliflari */}
          {slashOpen && (
            <div className="tg-pop-in absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1.5 shadow-[var(--tg-shadow-lg)]">
              <p className="px-2.5 pb-1 pt-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
                Buyruqlar · Tab/Enter — tanlash
              </p>
              {slashMatches.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onMouseEnter={() => setSlashIndex(i)}
                    onClick={() => onCommandPick?.(cmd.prefix)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                      i === slashIndex ? 'bg-[var(--tg-hover-strong)]' : 'hover:bg-[var(--tg-hover)]'
                    }`}
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[var(--tg-gold)]">
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-[var(--tg-text-1)]">
                        <span className="font-mono text-[var(--tg-teal)]">{cmd.prefix.trim()}</span> · {cmd.label}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--tg-text-4)]">{cmd.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div
            className={`tg-composer rounded-[26px] border bg-[var(--tg-surface-2)] px-2.5 pb-2 pt-2 transition ${
              centered ? 'border-[var(--tg-border)] shadow-[var(--tg-shadow-lg)]' : 'border-[var(--tg-border)] shadow-[var(--tg-shadow-md)]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={onFilesPicked}
              className="hidden"
              accept="image/*,video/*,audio/*,.txt,.md,.json,.csv,.log,.pdf,.docx,.xlsx,.xls,.pptx"
            />

            {attachments.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5 px-1 pt-1">
                {attachments.map((att) => (
                  <AttachmentChip key={att.id} att={att} onRemove={onRemoveAttachment} />
                ))}
              </div>
            )}

            {/* 1-qator: matn maydoni butun kenglikda */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={onPaste}
              rows={1}
              placeholder={centered ? 'Nima qilib beray, jigar?' : 'Yoz, jigar… ("/" — buyruqlar)'}
              className="max-h-48 w-full resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed text-[var(--tg-text-1)] placeholder-[var(--tg-text-4)] outline-none"
            />

            {/* 2-qator: tugmalar */}
            <div className="flex items-center gap-1 pt-0.5">
              <div className="relative flex-shrink-0" ref={cmdMenuRef}>
                <button
                  type="button"
                  onClick={() => setCmdMenuOpen((v) => !v)}
                  title="Rasm, qidiruv, kod, prezentatsiya"
                  aria-label="Buyruqlar menyusi"
                  className={`tg-iconbtn ${cmdMenuOpen ? 'bg-[var(--tg-hover-strong)] text-[var(--tg-text-1)]' : ''}`}
                >
                  <Plus size={18} className={`transition-transform ${cmdMenuOpen ? 'rotate-45' : ''}`} />
                </button>

                {cmdMenuOpen && (
                  <div className="tg-pop-in absolute bottom-full left-0 z-20 mb-2 w-64 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1.5 shadow-[var(--tg-shadow-lg)]">
                    {COMMANDS.map((cmd) => {
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          onClick={() => {
                            setCmdMenuOpen(false);
                            onCommandPick?.(cmd.prefix);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--tg-hover)]"
                        >
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[var(--tg-gold)]">
                            <Icon size={14} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-[var(--tg-text-1)]">{cmd.label}</span>
                            <span className="block truncate text-[11px] text-[var(--tg-text-4)]">{cmd.example}</span>
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setCmdMenuOpen(false);
                        router.push('/klip');
                      }}
                      className="mt-0.5 flex w-full items-center gap-2.5 rounded-xl border-t border-[var(--tg-border)] px-2.5 py-2 text-left transition hover:bg-[var(--tg-hover)]"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[var(--tg-teal)]">
                        <Sparkles size={14} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-[var(--tg-text-1)]">Podkast → klip</span>
                        <span className="block truncate text-[11px] text-[var(--tg-text-4)]">Uzun videodan qisqa kliplar</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Rasm, video, audio yoki fayl biriktirish (bir nechta ham bo'ladi)"
                className="tg-iconbtn"
              >
                <Paperclip size={16} />
              </button>

              <button
                type="button"
                onClick={onToggleDeepThink}
                title={deepThink ? "Chuqur o'ylash yoqilgan — javob sekinroq, lekin chuqurroq bo'ladi" : "Chuqur o'ylashni yoqish"}
                className={`flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition ${
                  deepThink
                    ? 'bg-[var(--tg-teal)]/15 text-[var(--tg-teal)]'
                    : 'text-[var(--tg-text-2)] hover:bg-[var(--tg-hover)]'
                }`}
              >
                <Brain size={15} />
                <span className="hidden sm:inline">Oʻylash</span>
              </button>

              {planInfo && (
                <div className="relative flex-shrink-0" ref={planMenuRef}>
                  <button
                    type="button"
                    onClick={() => setPlanMenuOpen((v) => !v)}
                    title="Tarifni ko'rish"
                    className="ml-0.5 flex h-7 items-center gap-1 rounded-full border border-[var(--tg-border)] px-2.5 text-[11px] font-medium text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:text-[var(--tg-text-1)]"
                  >
                    <span className="max-w-[86px] truncate">
                      {planInfo.mode === 'trial' ? `${planInfo.name} sinovi` : planInfo.name}
                    </span>
                    <ChevronDown size={11} className={`transition-transform ${planMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {planMenuOpen && (
                    <div className="tg-pop-in absolute bottom-full left-0 z-20 mb-2 w-44 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1 shadow-[var(--tg-shadow-lg)]">
                      {Object.values(PLANS).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPlanMenuOpen(false);
                            router.push('/tariflar');
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-[var(--tg-hover)] ${
                            p.id === planInfo.id ? 'text-[var(--tg-teal)]' : 'text-[var(--tg-text-2)]'
                          }`}
                        >
                          <span>{p.name}</span>
                          <span className="text-[10px] text-[var(--tg-text-4)]">{p.priceLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1" />

              {speechSupported && (
                <button
                  type="button"
                  onClick={onToggleListening}
                  disabled={transcribing}
                  title={transcribing ? "Matnga o'girilmoqda..." : listening ? 'Yozishni toʻxtatish' : 'Ovoz bilan yozish'}
                  className={`tg-iconbtn disabled:opacity-60 ${listening ? 'bg-red-500/15 text-red-400 tg-recording' : ''}`}
                >
                  {transcribing ? <Loader2 size={15} className="animate-spin" /> : listening ? <Square size={14} /> : <Mic size={16} />}
                </button>
              )}

              <button
                type="button"
                onClick={onOpenVoice}
                title="Jonli suhbat — ovoz bilan gaplashish"
                aria-label="Jonli suhbat"
                className="tg-iconbtn text-[var(--tg-teal)]"
              >
                <AudioLines size={17} />
              </button>

              {isLoading ? (
                <button
                  type="button"
                  onClick={onStop}
                  title="Toʻxtatish (Esc)"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tg-text-1)] text-[var(--tg-bg)] transition hover:opacity-90"
                  aria-label="Javob berishni toʻxtatish"
                >
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!canSend}
                  className="tg-sendbtn flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[#0A0A0B] transition disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Xabarni yuborish"
                  title={uploading ? 'Fayl yuklanishini kuting' : 'Yuborish (Enter)'}
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.5} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {!centered && (
          <p className="mt-2 text-center text-[11px] text-[var(--tg-text-4)]">
            ToshkentGPT xato qilishi mumkin · Enter — yuborish, Shift+Enter — yangi qator
          </p>
        )}
      </div>
    </Shell>
  );
}
