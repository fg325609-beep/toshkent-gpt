'use client';
 
import { User, Check, Copy, Volume2, VolumeX, RefreshCw, Pencil, ThumbsUp, ThumbsDown, FileDown } from 'lucide-react';
import MarkdownMessage from '@/app/markdown-message';
import { formatTime } from '@/lib/format';
 
// ============================================================
// Bitta xabar "pufakchasi" — foydalanuvchi yoki AI tomonidan yozilgan.
// Xabarlar ro'yxati (ChatMessages) har bir xabar uchun shuni chizadi.
// ============================================================
export default function MessageBubble({
  msg,
  userImage,
  isLastAssistant,
  isLoading,
  copiedId,
  speakingId,
  ttsSupported,
  onCopy,
  onToggleSpeak,
  canRegenerate,
  canEdit,
  onRegenerate,
  onEdit,
  onRate,
}) {
  const isUser = msg.role === 'user';
 
  return (
    <div className={`group flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${
          isUser ? 'bg-[var(--tg-hover-strong)] text-[var(--tg-text-2)]' : 'border border-[#E4A93B]/25 bg-[#E4A93B]/10'
        }`}
      >
        {isUser ? (
          userImage ? (
            <img src={userImage} alt="" className="h-full w-full object-cover" />
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
          {msg.image?.dataUrl &&
            (isUser ? (
              <img src={msg.image.dataUrl} alt={msg.image.name || 'rasm'} className="max-h-64 w-full object-cover" />
            ) : (
              <img src={msg.image.dataUrl} alt="AI tomonidan yaratilgan rasm" className="w-full rounded-t-2xl object-contain" />
            ))}
          {!isUser && !msg.content && isLoading && isLastAssistant ? (
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
                {msg.file?.base64 && (
                  <a
                    href={`data:${msg.file.mimeType};base64,${msg.file.base64}`}
                    download={msg.file.filename}
                    className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3 py-2.5 transition hover:bg-[var(--tg-hover-strong)]"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#E4A93B]/15 text-[#E4A93B]">
                      <FileDown size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-[var(--tg-text-1)]">{msg.file.filename}</div>
                      <div className="text-[11px] text-[var(--tg-text-3)]">Yuklab olish uchun bosing</div>
                    </div>
                  </a>
                )}
              </div>
            )
          )}
        </div>
 
        <div className="mt-1 flex items-center gap-2 px-1">
          {msg.time && <span className="text-[11px] text-[var(--tg-text-4)]">{formatTime(msg.time)}</span>}
          <div className="flex items-center gap-1.5 opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {msg.content && (
              <button
                onClick={() => onCopy(msg)}
                title="Nusxa olish"
                className="text-[var(--tg-text-3)] transition-colors hover:text-[var(--tg-text-1)]"
              >
                {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
            {!isUser && ttsSupported && msg.content && (
              <button
                onClick={() => onToggleSpeak(msg)}
                title="Ovozda eshitish"
                className={`transition-colors hover:text-[var(--tg-text-1)] ${
                  speakingId === msg.id ? 'text-[#2F9E96]' : 'text-[var(--tg-text-3)]'
                }`}
              >
                {speakingId === msg.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
            )}
            {isUser && canEdit && (
              <button
                onClick={() => onEdit(msg)}
                title="Tahrirlash"
                className="text-[var(--tg-text-3)] transition-colors hover:text-[var(--tg-text-1)]"
              >
                <Pencil size={12} />
              </button>
            )}
            {!isUser && canRegenerate && (
              <button
                onClick={() => onRegenerate(msg)}
                title="Qayta yozdirish"
                className="text-[var(--tg-text-3)] transition-colors hover:text-[var(--tg-text-1)]"
              >
                <RefreshCw size={12} />
              </button>
            )}
            {!isUser && msg.content && (
              <>
                <button
                  onClick={() => onRate(msg, 'up')}
                  title="Yoqdi"
                  className={`transition-colors hover:text-[var(--tg-text-1)] ${
                    msg.rating === 'up' ? 'text-[#2F9E96]' : 'text-[var(--tg-text-3)]'
                  }`}
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  onClick={() => onRate(msg, 'down')}
                  title="Yoqmadi"
                  className={`transition-colors hover:text-[var(--tg-text-1)] ${
                    msg.rating === 'down' ? 'text-red-400' : 'text-[var(--tg-text-3)]'
                  }`}
                >
                  <ThumbsDown size={12} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
 