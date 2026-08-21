'use client';

import { useState } from 'react';
import { X, Clock, Check, Sparkles, Zap, Crown, Flame, Copy } from 'lucide-react';
import { PLANS, PLAN_ORDER, PAYMENT_CARD } from '@/app/plans';
import { formatTime } from '@/lib/format';

const TIER_ICON = { lite: Sparkles, pro: Zap, max: Crown, promax: Flame };

// ============================================================
// "Tariflar" oynasi — 3 ko'rinishga ega:
//  - list:        barcha tariflar (narx + imkoniyatlar) kartalar shaklida
//  - trial-ended: bepul sinov limiti tugaganda ko'rinadigan xabar
//  - pay:         tanlangan tarif uchun to'lov (karta raqami) ko'rsatiladi
// Qaysi ko'rinish ochiqligini OTA komponent (page.jsx) `view` orqali beradi.
// ============================================================
export default function PlansModal({
  open,
  onClose,
  view,
  currentPlanId,
  paymentPlanId,
  trialEndInfo,
  paymentStatus,
  trialStarting,
  onStartTrial,
  onOpenUpgrade,
  onRequestUpgrade,
  onGoToPayFromTrialEnd,
  onBackToList,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--tg-overlay)]" onClick={onClose} />
      <div
        className={`relative max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-5 tg-scroll ${
          view === 'list' ? 'max-w-3xl' : 'max-w-sm'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--tg-text-1)]">
            {view === 'list' ? 'Tariflar' : view === 'trial-ended' ? 'Sinov vaqti tugadi' : `${PLANS[paymentPlanId].name}ga oʻtish`}
          </h2>
          <button onClick={onClose} className="text-[var(--tg-text-3)] hover:text-[var(--tg-text-1)]">
            <X size={16} />
          </button>
        </div>

        {view === 'trial-ended' && trialEndInfo && (
          <TrialEndedView trialEndInfo={trialEndInfo} onGoToPay={onGoToPayFromTrialEnd} onClose={onClose} />
        )}

        {view === 'list' && (
          <PlansList currentPlanId={currentPlanId} trialStarting={trialStarting} onStartTrial={onStartTrial} onOpenUpgrade={onOpenUpgrade} />
        )}

        {view === 'pay' && (
          <PaymentView planId={paymentPlanId} status={paymentStatus} onSubmit={onRequestUpgrade} onBack={onBackToList} />
        )}
      </div>
    </div>
  );
}

function TrialEndedView({ trialEndInfo, onGoToPay, onClose }) {
  return (
    <div className="text-center">
      <Clock size={28} className="mx-auto mb-2 text-[#E4A93B]" />
      <p className="text-sm text-[var(--tg-text-1)]">
        {PLANS[trialEndInfo.planId]?.name || 'Pro'} bepul sinovi limitiga yetdingiz.
      </p>
      <p className="mt-1 text-xs text-[var(--tg-text-3)]">
        Soat <b className="text-[var(--tg-text-1)]">{formatTime(trialEndInfo.unlockAt)}</b>da yana bepul sinab koʻrishingiz
        mumkin. Yoki hoziroq sotib olib, cheklovsiz foydalaning.
      </p>
      <button
        onClick={() => onGoToPay(trialEndInfo.planId || 'pro')}
        className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14]"
        style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
      >
        Hoziroq sotib olish
      </button>
      <button onClick={onClose} className="mt-2 w-full text-center text-[11px] text-[var(--tg-text-3)] underline">
        Kutib turaman
      </button>
    </div>
  );
}

function PlansList({ currentPlanId, trialStarting, onStartTrial, onOpenUpgrade }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PLAN_ORDER.map((id) => (
        <PlanCard
          key={id}
          id={id}
          isCurrent={(currentPlanId || 'lite') === id}
          isFreeTier={(currentPlanId || 'lite') === 'lite'}
          trialStarting={trialStarting}
          onStartTrial={onStartTrial}
          onOpenUpgrade={onOpenUpgrade}
        />
      ))}
    </div>
  );
}

function PlanCard({ id, isCurrent, isFreeTier, trialStarting, onStartTrial, onOpenUpgrade }) {
  const plan = PLANS[id];
  const TierIcon = TIER_ICON[id];

  return (
    <div
      className={`flex flex-col rounded-2xl border p-4 transition ${
        isCurrent ? 'border-[#E4A93B]/60 bg-[#E4A93B]/[0.04]' : 'border-[var(--tg-border)] bg-[var(--tg-surface-2)]'
      }`}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#0D0F14]"
        style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
      >
        <TierIcon size={16} />
      </div>

      <p className="mt-3 text-base font-bold text-[var(--tg-text-1)]">{plan.name}</p>
      <p className="mb-3 text-xs text-[var(--tg-text-3)]">{plan.tagline}</p>

      <p className="text-2xl font-extrabold tracking-tight text-[var(--tg-text-1)]">
        {plan.priceAmount === 0 ? (
          '0 soʻm'
        ) : (
          <>
            {plan.priceAmount.toLocaleString('ru-RU')}
            <span className="text-sm font-medium text-[var(--tg-text-3)]"> soʻm/oy</span>
          </>
        )}
      </p>

      <div className="mt-4">
        {isCurrent ? (
          <span className="flex w-full items-center justify-center rounded-xl bg-[var(--tg-hover)] px-3 py-2.5 text-xs font-semibold text-[var(--tg-text-2)]">
            Joriy tarifingiz
          </span>
        ) : plan.paid ? (
          <div className="space-y-1.5">
            <button
              onClick={() => onOpenUpgrade(id)}
              className="w-full rounded-xl py-2.5 text-xs font-semibold text-[#0D0F14] transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              {plan.name} tarifini olish
            </button>
            {plan.trial && isFreeTier && (
              <button
                onClick={() => onStartTrial(id)}
                disabled={trialStarting}
                className="w-full rounded-xl border border-[var(--tg-border)] py-2 text-[11px] font-medium text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)] disabled:opacity-50"
              >
                {trialStarting ? 'Boshlanmoqda...' : 'Avval bepul sinab koʻring'}
              </button>
            )}
          </div>
        ) : (
          <span className="flex w-full items-center justify-center rounded-xl border border-[var(--tg-border)] px-3 py-2.5 text-xs font-medium text-[var(--tg-text-2)]">
            Doim mavjud
          </span>
        )}
      </div>

      <div className="my-4 h-px bg-[var(--tg-border)]" />

      <ul className="space-y-2">
        {plan.featuresIntro && <li className="text-[11px] font-medium text-[var(--tg-text-3)]">{plan.featuresIntro}</li>}
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12px] text-[var(--tg-text-2)]">
            <Check size={13} className="mt-0.5 flex-shrink-0 text-[#2F9E96]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Kartaga to'lov qismi — endi raqamlangan qadamlar va "nusxa olish" tugmasi bilan,
// shunda foydalanuvchi karta raqamini qo'lda ko'chirib yozib xato qilmaydi.
function PaymentView({ planId, status, onSubmit, onBack }) {
  const [copied, setCopied] = useState(false);
  const plan = PLANS[planId];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(PAYMENT_CARD.number.replace(/\s+/g, ''));
    } catch {
      // Clipboard ruxsati bo'lmasa ham interfeys buzilmasin — shunchaki "nusxalandi" ko'rsatilmaydi.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (status === 'sent') {
    return (
      <div className="py-4 text-center">
        <Check size={28} className="mx-auto mb-2 text-[#2F9E96]" />
        <p className="text-sm text-[var(--tg-text-1)]">Soʻrovingiz yuborildi!</p>
        <p className="mt-1 text-xs text-[var(--tg-text-3)]">
          Toʻlov tekshirilgach, {plan.name} tarifi 24 soat ichida faollashadi.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ol className="mb-4 space-y-3">
        <li className="flex gap-2.5 text-xs text-[var(--tg-text-2)]">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tg-hover)] text-[10px] font-bold text-[var(--tg-text-1)]">
            1
          </span>
          <span className="pt-0.5">
            Quyidagi kartaga <b className="text-[var(--tg-text-1)]">{plan.priceLabel}</b> miqdorida oʻtkazing.
          </span>
        </li>
        <li className="flex gap-2.5 text-xs text-[var(--tg-text-2)]">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tg-hover)] text-[10px] font-bold text-[var(--tg-text-1)]">
            2
          </span>
          <span className="pt-0.5">Pastdagi &quot;Toʻladim&quot; tugmasini bosing.</span>
        </li>
      </ol>

      <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-3">
        <div>
          <p className="text-[10.5px] uppercase tracking-wide text-[var(--tg-text-3)]">{PAYMENT_CARD.bank}</p>
          <p className="mt-1 text-base font-semibold tracking-wider text-[var(--tg-text-1)]">{PAYMENT_CARD.number}</p>
          <p className="mt-1 text-xs text-[var(--tg-text-3)]">{PAYMENT_CARD.holder}</p>
        </div>
        <button
          onClick={handleCopy}
          title="Karta raqamini nusxalash"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[#E4A93B]/40 hover:text-[#E4A93B]"
        >
          {copied ? <Check size={15} className="text-[#2F9E96]" /> : <Copy size={15} />}
        </button>
      </div>

      <button
        onClick={onSubmit}
        disabled={status === 'sending'}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
      >
        {status === 'sending' ? 'Yuborilmoqda...' : 'Toʻladim'}
      </button>
      {status === 'error' && <p className="mt-2 text-center text-xs text-red-400">Xatolik yuz berdi, qayta urinib koʻring.</p>}
      <button onClick={onBack} className="mt-2 w-full text-center text-[11px] text-[var(--tg-text-3)] underline">
        Orqaga
      </button>
    </div>
  );
}
