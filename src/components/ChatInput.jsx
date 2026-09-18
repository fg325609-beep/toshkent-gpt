'use client';
 
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Mic, Square, Send, X, Film, FileText, Brain, Loader2, ChevronDown, Plus } from 'lucide-react';
import { PLANS } from '@/app/plans';
import { COMMANDS } from '@/lib/commands';
 
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
 
// ============================================================
// Yozish qatori.
//
// Ikki qatorli quti (ChatGPT'dagidek): tepada matn maydoni, pastda
// tugmalar. Tarif nomi endi ALOHIDA banner emas — shu qutining ICHIDA,
// kichik tugma sifatida turadi. Limit chizig'i esa chapdagi panelga
// ko'chirildi.
//
// centered=true bo'lsa (suhbat hali boshlanmagan) quti ekran o'rtasida,
// ramkasiz holatda chiziladi; aks holda pastda, chegara chizig'i bilan.
// ============================================================
export default function ChatInput({
  planInfo,
  attachment,
  onRemoveAttachment,
  fileInputRef,
  onFilePicked,
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
  centered = false,
}) {
  const canSend = Boolean(input.trim() || attachment);
  const router = useRouter();
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const planMenuRef = useRef(null);
  // "+" menyusi — suhbat davomida ham buyruqlarni eslab o'tirmasdan tanlash uchun.
  const [cmdMenuOpen, setCmdMenuOpen] = useState(false);
  const cmdMenuRef = useRef(null);
  useMenuClose(cmdMenuOpen, () => setCmdMenuOpen(false), cmdMenuRef);
  useMenuClose(planMenuOpen, () => setPlanMenuOpen(false), planMenuRef);
 
  const Shell = centered ? 'div' : 'footer';
 
  return (
    <Shell
      className={
        centered
          ? 'relative z-10 w-full'
          : 'relative z-10 border-t border-[var(--tg-border)] bg-[var(--tg-bg)] px-3 py-4 sm:px-6'
      }
    >
      <div className={centered ? 'w-full' : 'mx-auto max-w-3xl'}>
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
            ) : attachment.kind === 'pdf' ? (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[#E4A93B]">
                <FileText size={16} />
              </div>
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[#E4A93B]">
                <Paperclip size={16} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-medium uppercase tracking-wide text-[#E4A93B]">
                {attachment.kind === 'image'
                  ? 'Rasm biriktirildi'
                  : attachment.kind === 'video'
                    ? 'Video biriktirildi'
                    : attachment.kind === 'pdf'
                      ? 'PDF biriktirildi'
                      : 'Fayl biriktirildi'}
              </p>
              <p className="truncate text-xs text-[var(--tg-text-2)]">{attachment.name}</p>
            </div>
            <button
              onClick={onRemoveAttachment}
              title="Olib tashlash"
              className="flex-shrink-0 text-[var(--tg-text-3)] transition hover:text-[var(--tg-text-1)]"
            >
              <X size={14} />
            </button>
          </div>
        )}
 
        <div className="rounded-3xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] px-2 py-1.5 transition focus-within:border-[#E4A93B]/40">
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFilePicked}
            className="hidden"
            accept="image/*,video/*,.txt,.md,.json,.csv,.log,.pdf,.doc,.docx"
          />
 
          {/* 1-qator: matn maydoni butun kenglikda */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={1}
            placeholder="Yoz, jigar... (rasm/video uchun Ctrl+V ham boʻladi)"
            className="max-h-40 w-full resize-none bg-transparent px-2 py-2.5 text-sm text-[var(--tg-text-1)] placeholder-[var(--tg-text-3)] outline-none"
          />
 
          {/* 2-qator: tugmalar va tarif */}
          <div className="flex items-center gap-1 pb-0.5">
            <div className="relative flex-shrink-0" ref={cmdMenuRef}>
              <button
                onClick={() => setCmdMenuOpen((v) => !v)}
                title="Rasm, qidiruv, kod, prezentatsiya"
                aria-label="Buyruqlar menyusi"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  cmdMenuOpen
                    ? 'bg-[var(--tg-hover-strong)] text-[var(--tg-text-1)]'
                    : 'text-[var(--tg-text-2)] hover:bg-[var(--tg-hover)]'
                }`}
              >
                <Plus size={18} className={`transition-transform ${cmdMenuOpen ? 'rotate-45' : ''}`} />
              </button>
 
              {cmdMenuOpen && (
                <div className="tg-pop-in absolute bottom-full left-0 z-20 mb-2 w-60 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1.5 shadow-xl">
                  {COMMANDS.map((cmd) => {
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          setCmdMenuOpen(false);
                          onCommandPick?.(cmd.prefix);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--tg-hover)]"
                      >
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[#E4A93B]">
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-[var(--tg-text-1)]">{cmd.label}</span>
                          <span className="block truncate text-[11px] text-[var(--tg-text-4)]">{cmd.example}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
 
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Rasm, video yoki fayl biriktirish"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
            >
              <Paperclip size={16} />
            </button>
 
            <button
              onClick={onToggleDeepThink}
              title={deepThink ? "Chuqur o'ylash yoqilgan — javob sekinroq, lekin chuqurroq bo'ladi" : "Chuqur o'ylashni yoqish"}
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition ${
                deepThink ? 'bg-[#2F9E96]/15 text-[#2F9E96]' : 'text-[var(--tg-text-2)] hover:bg-[var(--tg-hover)]'
              }`}
            >
              <Brain size={16} />
            </button>
 
            {/* Tarif — endi shu qutining ichida */}
            {planInfo && (
              <div className="relative flex-shrink-0" ref={planMenuRef}>
                <button
                  onClick={() => setPlanMenuOpen((v) => !v)}
                  title="Tarifni ko'rish"
                  className="ml-0.5 flex items-center gap-1 rounded-full border border-[var(--tg-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:text-[var(--tg-text-1)]"
                >
                  <span className="max-w-[86px] truncate">
                    {planInfo.mode === 'trial' ? `${planInfo.name} sinovi` : planInfo.name}
                  </span>
                  <ChevronDown size={11} className={`transition-transform ${planMenuOpen ? 'rotate-180' : ''}`} />
                </button>
 
                {planMenuOpen && (
                  <div className="tg-pop-in absolute bottom-full left-0 z-20 mb-2 w-44 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1 shadow-xl">
                    {Object.values(PLANS).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPlanMenuOpen(false);
                          router.push('/tariflar');
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-[var(--tg-hover)] ${
                          p.id === planInfo.id ? 'text-[#2F9E96]' : 'text-[var(--tg-text-2)]'
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
                onClick={onToggleListening}
                disabled={transcribing}
                title={transcribing ? "Matnga o'girilmoqda..." : listening ? 'Yozishni toʻxtatish' : 'Ovoz bilan yozish'}
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition disabled:opacity-60 ${
                  listening ? 'bg-red-500/15 text-red-400' : 'text-[var(--tg-text-2)] hover:bg-[var(--tg-hover)]'
                }`}
              >
                {transcribing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : listening ? (
                  <Square size={14} />
                ) : (
                  <Mic size={16} />
                )}
              </button>
            )}
 
            {isLoading ? (
              <button
                onClick={onStop}
                title="Toʻxtatish"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tg-hover-strong)] text-[var(--tg-text-1)] transition hover:opacity-90"
                aria-label="Javob berishni toʻxtatish"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!canSend}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[#0A0A0B] transition disabled:cursor-not-allowed disabled:opacity-30"
                style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
                aria-label="Xabarni yuborish"
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
 
        {/* Pastdagi eslatma faqat oddiy (pastki) holatda — boshlanish ekranida
            uni StartScreen o'zi chiqaradi. */}
        {!centered && (
          <p className="mt-2 text-center text-[11px] text-[var(--tg-text-4)]">
            ToshkentGPT xato qilishi mumkin · Enter — yuborish, Shift+Enter — yangi qator
          </p>
        )}
      </div>
    </Shell>
  );
}
 