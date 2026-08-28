'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Sparkles, Zap, Crown, Flame } from 'lucide-react';
import { PLANS, PLAN_ORDER, PAYMENT_CARD } from '@/app/plans';
import GirihPattern from '@/components/GirihPattern';

const TIER_ICON = { lite: Sparkles, pro: Zap, max: Crown, promax: Flame };

// ============================================================
// "Tariflar" — avval oyna (modal) edi, endi alohida manzilli sahifa
// (/tariflar). Shunday qilingani sababi: haqiqiy link — brauzerda ochilishi,
// tushunilishi va tekshirilishi ancha oson, oyna esa faqat JS orqali
// ochiladigan holat edi.
// ============================================================
export default function TariflarPage() {
  const { status } = useSession();
  const router = useRouter();

  const [planInfo, setPlanInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | pay
  const [paymentPlanId, setPaymentPlanId] = useState('pro');
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | sending | sent | error
  const [trialStarting, setTrialStarting] = useState(false);

  // Tizimga kirmagan bo'lsa — bosh sahifaga qaytaramiz (u yerda kirish ekrani chiqadi).
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/plan')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPlanInfo(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  async function startTrial(planId) {
    setTrialStarting(true);
    try {
      const res = await fetch('/api/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Xato');
      setPlanInfo({
        id: planId,
        name: PLANS[planId].name,
        mode: 'trial',
        limit: PLANS[planId].trial.limit,
        used: 0,
        remaining: PLANS[planId].trial.limit,
        resetAt: null,
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setTrialStarting(false);
    }
  }

  function openUpgrade(planId) {
    setPaymentPlanId(planId);
    setPaymentStatus('idle');
    setView('pay');
  }

  async function requestUpgrade() {
    setPaymentStatus('sending');
    try {
      const res = await fetch('/api/upgrade-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: paymentPlanId }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Xato');
      setPaymentStatus('sent');
    } catch {
      setPaymentStatus('error');
    }
  }

  if (status !== 'authenticated') return null;

  return (
    <div className="relative min-h-dvh bg-[var(--tg-bg)] text-[var(--tg-text-1)]">
      <GirihPattern />

      <header className="relative z-10 flex items-center gap-3 border-b border-[var(--tg-border)] bg-[var(--tg-bg)]/90 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          href="/"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
        >
          <ArrowLeft size={17} />
        </Link>
        <h1 className="text-base font-bold">
          {view === 'pay' ? `${PLANS[paymentPlanId].name}ga oʻtish` : 'Tariflar'}
        </h1>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {loading ? (
          <p className="text-center text-sm text-[var(--tg-text-3)]">Yuklanmoqda...</p>
        ) : view === 'pay' ? (
          <div className="mx-auto max-w-sm">
            <PaymentView
              planId={paymentPlanId}
              status={paymentStatus}
              onSubmit={requestUpgrade}
              onBack={() => setView('list')}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PLAN_ORDER.map((id) => (
              <PlanCard
                key={id}
                id={id}
                isCurrent={(planInfo?.id || 'lite') === id}
                isFreeTier={(planInfo?.id || 'lite') === 'lite'}
                trialStarting={trialStarting}
                onStartTrial={startTrial}
                onOpenUpgrade={openUpgrade}
              />
            ))}
          </div>
        )}
      </main>
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
              type="button"
              onClick={() => onOpenUpgrade(id)}
              className="w-full rounded-xl py-2.5 text-xs font-semibold text-[#0D0F14] transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              {plan.name} tarifini olish
            </button>
            {plan.trial && isFreeTier && (
              <button
                type="button"
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

function PaymentView({ planId, status, onSubmit, onBack }) {
  const [copied, setCopied] = useState(false);
  const plan = PLANS[planId];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(PAYMENT_CARD.number.replace(/\s+/g, ''));
    } catch {
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
          type="button"
          onClick={handleCopy}
          title="Karta raqamini nusxalash"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[#E4A93B]/40 hover:text-[#E4A93B]"
        >
          {copied ? <Check size={15} className="text-[#2F9E96]" /> : <Copy size={15} />}
        </button>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={status === 'sending'}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
      >
        {status === 'sending' ? 'Yuborilmoqda...' : 'Toʻladim'}
      </button>
      {status === 'error' && <p className="mt-2 text-center text-xs text-red-400">Xatolik yuz berdi, qayta urinib koʻring.</p>}
      <button type="button" onClick={onBack} className="mt-2 w-full text-center text-[11px] text-[var(--tg-text-3)] underline">
        Orqaga
      </button>
    </div>
  );
}
