'use client';

import MessageBubble from './MessageBubble';

const SUGGESTIONS = [
  'Aka, ishlar qalay?',
  'Bugun nima qilsam boʻladi zerikmasdan?',
  'Bitta kulgili gap ayt',
  'Dasturlashni qayerdan boshlasam boʻladi?',
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
  onSuggestionClick,
  scrollAnchorRef,
}) {
  const showSuggestions = messages.length === 1;
  const lastMessageId = messages[messages.length - 1]?.id;

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
