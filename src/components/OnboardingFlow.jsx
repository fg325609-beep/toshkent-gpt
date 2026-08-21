'use client';

import { User, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import GirihPattern from './GirihPattern';

// ============================================================
// Ro'yxatdan o'tishdagi tanishuv — Google bilan birinchi marta kirgandan keyin
// ism (va ixtiyoriy familiya) so'raladi. Natija profilga (demak, "xotira"ga) yoziladi.
// Ota komponent (page.jsx) barcha state'ni ushlaydi, bu yerga faqat props keladi.
// ============================================================
export default function OnboardingFlow({
  step,
  ism,
  familiya,
  userImage,
  onIsmChange,
  onFamiliyaChange,
  onNext,
  onBack,
  onFinish,
  onSkip,
}) {
  function handleStep1Submit(e) {
    e.preventDefault();
    if (ism.trim()) onNext();
  }

  function handleStep2Submit(e) {
    e.preventDefault();
    onFinish();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[var(--tg-bg)] px-6 text-center">
      <GirihPattern />
      <div className="relative z-10 flex w-full max-w-xs flex-col items-center">
        {userImage ? (
          <img src={userImage} alt="" className="h-16 w-16 rounded-full border-2 border-[#E4A93B]/40 object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#E4A93B]/25 bg-[#E4A93B]/10">
            <User size={24} className="text-[#E4A93B]" />
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="mt-5 w-full">
            <h1
              className="text-xl font-extrabold tracking-tight text-[var(--tg-text-1)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Tanishib olaylik!
            </h1>
            <p className="mt-2 text-sm text-[var(--tg-text-3)]">Sizni qanday chaqiray, jigar?</p>
            <input
              autoFocus
              value={ism}
              onChange={(e) => onIsmChange(e.target.value)}
              placeholder="Ismingiz"
              maxLength={40}
              className="mt-5 w-full rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] px-4 py-3 text-center text-sm text-[var(--tg-text-1)] outline-none placeholder-[var(--tg-text-3)] focus:border-[#E4A93B]/40"
            />
            <button
              type="submit"
              disabled={!ism.trim()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              Davom etish
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="mt-3 text-[11px] text-[var(--tg-text-4)] underline underline-offset-2 hover:text-[var(--tg-text-2)]"
            >
              Hozircha oʻtkazib yuborish
            </button>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} className="mt-5 w-full">
            <h1
              className="text-xl font-extrabold tracking-tight text-[var(--tg-text-1)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Rahmat, {ism.trim()}!
            </h1>
            <p className="mt-2 text-sm text-[var(--tg-text-3)]">Familiyangizni ham qoldirasizmi? (ixtiyoriy)</p>
            <input
              autoFocus
              value={familiya}
              onChange={(e) => onFamiliyaChange(e.target.value)}
              placeholder="Familiyangiz"
              maxLength={40}
              className="mt-5 w-full rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] px-4 py-3 text-center text-sm text-[var(--tg-text-1)] outline-none placeholder-[var(--tg-text-3)] focus:border-[#E4A93B]/40"
            />
            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-[#0D0F14] transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              <Check size={15} />
              Boshlaymiz
            </button>
            <button
              type="button"
              onClick={onBack}
              className="mt-3 flex w-full items-center justify-center gap-1 text-[11px] text-[var(--tg-text-4)] hover:text-[var(--tg-text-2)]"
            >
              <ArrowLeft size={12} />
              Orqaga
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center gap-1.5">
          <span className={`h-1.5 rounded-full transition-all ${step === 1 ? 'w-5 bg-[#E4A93B]' : 'w-1.5 bg-[var(--tg-border-strong)]'}`} />
          <span className={`h-1.5 rounded-full transition-all ${step === 2 ? 'w-5 bg-[#E4A93B]' : 'w-1.5 bg-[var(--tg-border-strong)]'}`} />
        </div>
      </div>
    </div>
  );
}
