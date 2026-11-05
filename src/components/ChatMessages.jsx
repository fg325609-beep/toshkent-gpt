'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import MessageBubble from './MessageBubble';

// ============================================================
// O'rtadagi aylanadigan (scroll) xabarlar maydoni.
//
// Foydalanuvchi yuqoriga ko'tarilgan bo'lsa, yangi matn kelganda uni
// majburan pastga tushirmaymiz — o'ng pastda "pastga" tugmasi chiqadi.
// ============================================================
export default function ChatMessages({
  messages,
  userImage,
  isLoading,
  assistantStatus,
  copiedId,
  speakingId,
  ttsLoadingId,
  audioCache,
  onCopy,
  onToggleSpeak,
  onDownloadAudio,
  onRegenerate,
  onEdit,
  onRate,
  onFollowup,
  scrollAnchorRef,
}) {
  const mainRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);
  const lastMessageId = messages[messages.length - 1]?.id;

  // "Qayta generatsiya" faqat ENG OXIRGI AI javobida, "Tahrirlash" esa faqat
  // ENG OXIRGI foydalanuvchi xabarida ko'rinadi — aks holda suhbat tarixi
  // va AI xotirasi (interactionId) chalkashib ketadi.
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    function onScroll() {
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToBottom() {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <main ref={mainRef} className="relative z-10 flex-1 overflow-y-auto px-3 pb-4 pt-6 sm:px-6 tg-scroll">
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            userImage={userImage}
            isLastAssistant={msg.id === lastMessageId}
            isLoading={isLoading}
            status={assistantStatus}
            copiedId={copiedId}
            speakingId={speakingId}
            ttsLoading={ttsLoadingId === msg.id}
            hasAudio={Boolean(audioCache?.[msg.id])}
            canRegenerate={!isLoading && msg.id === lastAssistantMsg?.id}
            canEdit={!isLoading && msg.id === lastUserMsg?.id}
            showFollowups={msg.id === lastAssistantMsg?.id && msg.id === lastMessageId}
            onCopy={onCopy}
            onToggleSpeak={onToggleSpeak}
            onDownloadAudio={onDownloadAudio}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            onRate={onRate}
            onFollowup={onFollowup}
          />
        ))}

        <div ref={scrollAnchorRef} className="h-px" />
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Pastga"
          className="tg-pop-in sticky bottom-2 z-20 mx-auto mt-2 flex w-fit rounded-full border border-[var(--tg-border)] bg-[var(--tg-surface)] p-2 text-[var(--tg-text-2)] shadow-[var(--tg-shadow-md)] transition hover:text-[var(--tg-text-1)]"
        >
          <ArrowDown size={15} />
        </button>
      )}
    </main>
  );
}
