'use client';

import { useState } from 'react';
import {
  User,
  Check,
  Copy,
  Volume2,
  VolumeX,
  RefreshCw,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  FileDown,
  Loader2,
  Download,
  FileText,
  Film,
  Music,
  Paperclip,
  Maximize2,
  X,
  ArrowRight,
  Brain,
  ChevronDown,
  Globe,
} from 'lucide-react';
import MarkdownMessage from '@/app/markdown-message';
import { formatTime } from '@/lib/format';
import BrandMark from './BrandMark';

const ATT_ICON = { pdf: FileText, doc: FileText, text: FileText, video: Film, audio: Music, file: Paperclip };

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url || 'manba';
  }
}

// Rasmni katta ko'rish (lightbox).
function Lightbox({ src, alt, onClose }) {
  return (
    <div className="tg-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Yopish"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X size={18} />
      </button>
      <img src={src} alt={alt || ''} className="max-h-full max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// Foydalanuvchi yuborgan biriktirmalar (rasm ko'rinishi yoki fayl chipi).
function UserAttachments({ attachments }) {
  const [open, setOpen] = useState(null);
  if (!attachments?.length) return null;
  return (
    <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
      {attachments.map((att, i) =>
        att.category === 'image' && att.previewUrl ? (
          <button
            key={att.id || i}
            type="button"
            onClick={() => setOpen(att)}
            className="group/img relative overflow-hidden rounded-xl border border-[var(--tg-border)]"
            title={att.name}
          >
            <img src={att.previewUrl} alt={att.name || 'rasm'} className="max-h-56 max-w-[260px] object-cover" />
            <span className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white opacity-0 transition group-hover/img:opacity-100">
              <Maximize2 size={12} />
            </span>
          </button>
        ) : att.category === 'video' && att.previewUrl ? (
          <video key={att.id || i} src={att.previewUrl} controls className="max-h-56 max-w-[300px] rounded-xl border border-[var(--tg-border)]" />
        ) : (
          <span
            key={att.id || i}
            className="flex items-center gap-2 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-2.5 py-1.5 text-[12px] text-[var(--tg-text-2)]"
            title={att.name}
          >
            {(() => {
              const Icon = ATT_ICON[att.category] || Paperclip;
              return <Icon size={13} className="text-[var(--tg-gold)]" />;
            })()}
            <span className="max-w-[180px] truncate">{att.name}</span>
          </span>
        )
      )}
      {open && <Lightbox src={open.previewUrl} alt={open.name} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ============================================================
// Bitta xabar. Zamonaviy AI ilovalardagi kabi:
//   * foydalanuvchi — o'ngda, ixcham "pufakcha";
//   * AI — chapda logotip, matn pufakchasiz, butun kenglikda (o'qish qulay);
//   * AI yozayotganda — holat satri ("O'ylayapman…", "Video yuklanmoqda…")
//     va matn oxirida miltillovchi kursor;
//   * javob tugagach — davom-savol tugmalari (follow-up) va amallar paneli.
// ============================================================
export default function MessageBubble({
  msg,
  userImage,
  isLastAssistant,
  isLoading,
  status,
  copiedId,
  speakingId,
  ttsLoading,
  hasAudio,
  onCopy,
  onToggleSpeak,
  onDownloadAudio,
  canRegenerate,
  canEdit,
  onRegenerate,
  onEdit,
  onRate,
  onFollowup,
  showFollowups,
}) {
  const isUser = msg.role === 'user';
  const [lightbox, setLightbox] = useState(false);
  const streaming = !isUser && isLoading && isLastAssistant;
  const waiting = streaming && !msg.content;

  if (isUser) {
    return (
      <div className="tg-msg-in group flex flex-col items-end gap-1 pl-10 sm:pl-16">
        <UserAttachments attachments={msg.attachments} />
        {msg.image?.dataUrl && !msg.attachments?.length && (
          <img src={msg.image.dataUrl} alt={msg.image.name || 'rasm'} className="mb-1.5 max-h-56 max-w-[260px] rounded-xl border border-[var(--tg-border)] object-cover" />
        )}
        {(msg.content || msg.fileNote) && (
          <div className="max-w-full rounded-[20px] rounded-tr-md border border-[var(--tg-border)] bg-[var(--tg-surface)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--tg-text-1)]">
            {msg.fileNote && !msg.attachments?.length && <div className="mb-1 text-[12px] text-[var(--tg-text-3)]">{msg.fileNote}</div>}
            {msg.content && <div className="whitespace-pre-wrap break-words">{msg.content}</div>}
          </div>
        )}
        <div className="flex items-center gap-2 px-1 text-[11px] text-[var(--tg-text-4)]">
          {msg.voice && <span>🎙 ovoz</span>}
          {msg.time && <span>{formatTime(msg.time)}</span>}
          <div className="flex items-center gap-1.5 opacity-70 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {msg.content && (
              <button type="button" onClick={() => onCopy(msg)} title="Nusxa olish" className="tg-actionbtn">
                {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
            {canEdit && (
              <button type="button" onClick={() => onEdit(msg)} title="Tahrirlash" className="tg-actionbtn">
                <Pencil size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tg-msg-in group flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">
        <BrandMark size={34} variant={streaming ? 'orbit' : 'ring'} thinking={streaming} />
      </div>

      <div className="min-w-0 flex-1">
        {/* Fikrlash (thinking) — model o'z mulohazasining qisqacha mazmunini beradi */}
        {msg.thinking && (
          <details className="tg-thinking tg-fade-in group/think mb-2 rounded-xl px-3 py-2 text-[12.5px] text-[var(--tg-text-3)]" open={streaming && !msg.content}>
            <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-[var(--tg-text-2)]">
              <Brain size={13} className={`text-[var(--tg-gold)] ${streaming && !msg.content ? 'tg-breathe' : ''}`} />
              <span className={streaming && !msg.content ? 'tg-shimmer-text' : ''}>{streaming && !msg.content ? 'Fikrlayapman…' : 'Fikrlash jarayoni'}</span>
              <ChevronDown size={12} className="ml-auto transition group-open/think:rotate-180" />
            </summary>
            <div className="mt-1.5 whitespace-pre-wrap leading-relaxed">{msg.thinking}</div>
          </details>
        )}

        {/* Holat satri — faqat yozayotganda */}
        {streaming && status && (
          <div className="tg-fade-in mb-1.5 flex items-center gap-1.5 text-[12.5px] text-[var(--tg-text-3)]">
            <Loader2 size={13} className="animate-spin text-[var(--tg-gold)]" />
            <span className="tg-shimmer-text">{status}</span>
          </div>
        )}

        {waiting && !status ? (
          <div className="flex items-center gap-1 py-2">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tg-gold)] [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tg-gold)] [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tg-gold)]" />
          </div>
        ) : (
          <div className="tg-prose text-[15px] leading-[1.7] text-[var(--tg-text-1)]">
            {msg.image?.dataUrl && (
              <button type="button" onClick={() => setLightbox(true)} className="mb-2 block overflow-hidden rounded-2xl border border-[var(--tg-border)]" title="Kattalashtirish">
                <img src={msg.image.dataUrl} alt="AI tomonidan yaratilgan rasm" className="max-h-[420px] w-auto max-w-full object-contain" />
              </button>
            )}
            {lightbox && msg.image?.dataUrl && <Lightbox src={msg.image.dataUrl} alt="AI rasm" onClose={() => setLightbox(false)} />}
            {msg.content && <MarkdownMessage content={msg.content} />}
            {streaming && msg.content && <span className="tg-caret" aria-hidden="true" />}
            {msg.file?.base64 && (
              <a
                href={`data:${msg.file.mimeType};base64,${msg.file.base64}`}
                download={msg.file.filename}
                className="mt-2.5 flex max-w-sm items-center gap-2.5 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3 py-2.5 transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-gold)]/15 text-[var(--tg-gold)]">
                  <FileDown size={16} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[var(--tg-text-1)]">{msg.file.filename}</div>
                  <div className="text-[11px] text-[var(--tg-text-3)]">Yuklab olish uchun bosing</div>
                </div>
              </a>
            )}
          </div>
        )}

        {/* Manbalar (internet qidiruvi ishlatilganda) */}
        {!streaming && msg.sources?.length > 0 && (
          <div className="tg-fade-in mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-[11px] text-[var(--tg-text-4)]">
              <Globe size={11} /> Manbalar:
            </span>
            {msg.sources.slice(0, 6).map((src, i) => (
              <a
                key={src.url || i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                title={src.title || src.url}
                className="max-w-[200px] truncate rounded-full border border-[var(--tg-border)] bg-[var(--tg-surface)] px-2.5 py-1 text-[11px] text-[var(--tg-text-2)] transition hover:border-[var(--tg-teal)]/50 hover:text-[var(--tg-teal)]"
              >
                {src.title || hostOf(src.url)}
              </a>
            ))}
          </div>
        )}

        {/* Davom-savollar */}
        {showFollowups && !streaming && msg.followups?.length > 0 && (
          <div className="tg-fade-in mt-3 flex flex-wrap gap-1.5">
            {msg.followups.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onFollowup?.(q)}
                className="group/f flex items-center gap-1.5 rounded-full border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3 py-1.5 text-left text-[12.5px] text-[var(--tg-text-2)] transition hover:border-[var(--tg-gold)]/50 hover:text-[var(--tg-text-1)]"
              >
                {q}
                <ArrowRight size={12} className="text-[var(--tg-text-4)] transition group-hover/f:translate-x-0.5 group-hover/f:text-[var(--tg-gold)]" />
              </button>
            ))}
          </div>
        )}

        {/* Amallar paneli */}
        {!streaming && (msg.content || msg.image) && (
          <div className="mt-1.5 flex items-center gap-1 opacity-80 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {msg.content && (
              <button type="button" onClick={() => onCopy(msg)} title="Nusxa olish" className="tg-actionbtn">
                {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
              </button>
            )}
            {msg.content && (
              <button
                type="button"
                onClick={() => onToggleSpeak(msg)}
                disabled={ttsLoading}
                title="Ovozda eshitish"
                className={`tg-actionbtn disabled:opacity-50 ${speakingId === msg.id ? 'text-[var(--tg-teal)]' : ''}`}
              >
                {ttsLoading ? <Loader2 size={13} className="animate-spin" /> : speakingId === msg.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            )}
            {hasAudio && (
              <button type="button" onClick={() => onDownloadAudio(msg.id)} title="MP3 sifatida yuklab olish" className="tg-actionbtn">
                <Download size={13} />
              </button>
            )}
            {canRegenerate && (
              <button type="button" onClick={() => onRegenerate(msg)} title="Qayta yozdirish" className="tg-actionbtn">
                <RefreshCw size={13} />
              </button>
            )}
            {msg.content && (
              <>
                <button type="button" onClick={() => onRate(msg, 'up')} title="Yoqdi" className={`tg-actionbtn ${msg.rating === 'up' ? 'text-[var(--tg-teal)]' : ''}`}>
                  <ThumbsUp size={13} />
                </button>
                <button type="button" onClick={() => onRate(msg, 'down')} title="Yoqmadi" className={`tg-actionbtn ${msg.rating === 'down' ? 'text-red-400' : ''}`}>
                  <ThumbsDown size={13} />
                </button>
              </>
            )}
            {msg.time && <span className="ml-1 text-[11px] text-[var(--tg-text-4)]">{formatTime(msg.time)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
