'use client';

import { Paperclip, Mic, Square, Send, X, Film } from 'lucide-react';
import { formatTime } from '@/lib/format';

// ============================================================
// Pastki panel: tarif-limit banneri, biriktirma (rasm/video/fayl) ko'rinishi
// va yozish qatori (matn, ovoz, biriktirish, yuborish/toʻxtatish tugmalari).
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
  onToggleListening,
  isLoading,
  onStop,
  onSend,
}) {
  const canSend = Boolean(input.trim() || attachment);

  return (
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
              onClick={onRemoveAttachment}
              title="Olib tashlash"
              className="flex-shrink-0 text-[var(--tg-text-3)] transition hover:text-[var(--tg-text-1)]"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-2 transition focus-within:border-[#E4A93B]/40">
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFilePicked}
            className="hidden"
            accept="image/*,video/*,.txt,.md,.json,.csv,.log,.pdf,.doc,.docx"
          />
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
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={1}
            placeholder="Yoz, jigar... (rasm/video uchun Ctrl+V ham boʻladi)"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[var(--tg-text-1)] placeholder-[var(--tg-text-3)] outline-none"
          />

          {speechSupported && (
            <button
              onClick={onToggleListening}
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
              onClick={onStop}
              title="Toʻxtatish"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tg-hover-strong)] text-[var(--tg-text-1)] transition hover:opacity-90"
              aria-label="Javob berishni toʻxtatish"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!canSend}
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
  );
}
