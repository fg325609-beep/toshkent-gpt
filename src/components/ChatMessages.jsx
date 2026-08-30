'use client';
 
import MessageBubble from './MessageBubble';
 
const SUGGESTIONS = [
  'Aka, ishlar qalay?',
  '/prezentatsiya fotosintez jarayoni',
  'Bitta kulgili gap ayt',
  '/rasm gitara chalayotgan mushuk',
];
 
// ============================================================
// O'rtadagi aylanadigan (scroll) xabarlar maydoni: barcha xabarlar +
// birinchi suhbatda ko'rinadigan tayyor savol takliflari.
// ============================================================
export default function ChatMessages({
  messages,
  userImage,
  isLoading,
  copiedId,
  speakingId,
  ttsSupported,
  onCopy,
  onToggleSpeak,
  onRegenerate,
  onEdit,
  onRate,
  onSuggestionClick,
  scrollAnchorRef,
}) {
  const showSuggestions = messages.length === 1;
  const lastMessageId = messages[messages.length - 1]?.id;
 
  // "Qayta generatsiya" faqat ENG OXIRGI AI javobida, "Tahrirlash" esa faqat
  // ENG OXIRGI foydalanuvchi xabarida ko'rinadi — aks holda suhbat tarixi
  // va AI xotirasi (interactionId) chalkashib ketadi.
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
 
  return (
    <main className="relative z-10 flex-1 overflow-y-auto px-3 py-6 sm:px-6 tg-scroll">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            userImage={userImage}
            isLastAssistant={msg.id === lastMessageId}
            isLoading={isLoading}
            copiedId={copiedId}
            speakingId={speakingId}
            ttsSupported={ttsSupported}
            onCopy={onCopy}
            onToggleSpeak={onToggleSpeak}
            canRegenerate={!isLoading && msg.id === lastAssistantMsg?.id}
            canEdit={!isLoading && msg.id === lastUserMsg?.id}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            onRate={onRate}
          />
        ))}
 
        {showSuggestions && !isLoading && (
          <div className="ml-11 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestionClick(s)}
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
  );
}
 