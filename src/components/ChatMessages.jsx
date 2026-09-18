'use client';
 
import MessageBubble from './MessageBubble';
 
// ============================================================
// O'rtadagi aylanadigan (scroll) xabarlar maydoni.
//
// Suhbat boshlanmagan holatdagi ekran endi alohida StartScreen
// komponentida — bu yer faqat xabarlarni chizadi.
// ============================================================
export default function ChatMessages({
  messages,
  userImage,
  isLoading,
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
  scrollAnchorRef,
}) {
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
            ttsLoading={ttsLoadingId === msg.id}
            hasAudio={Boolean(audioCache?.[msg.id])}
            onCopy={onCopy}
            onToggleSpeak={onToggleSpeak}
            onDownloadAudio={onDownloadAudio}
            canRegenerate={!isLoading && msg.id === lastAssistantMsg?.id}
            canEdit={!isLoading && msg.id === lastUserMsg?.id}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            onRate={onRate}
          />
        ))}
 
        <div ref={scrollAnchorRef} />
      </div>
    </main>
  );
}
 