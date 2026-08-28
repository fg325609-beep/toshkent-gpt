'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Check } from 'lucide-react';
import { LinkedinGlyph, InstagramGlyph } from '@/components/icons/BrandIcons';
import GirihPattern from '@/components/GirihPattern';

// ============================================================
// "Shikoyat va takliflar" — avval oyna (modal) edi, endi alohida
// manzilli sahifa (/shikoyat).
// ============================================================
export default function ShikoyatPage() {
  const { status } = useSession();
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle'); // idle | sending | sent | error

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  async function submitFeedback(e) {
    e.preventDefault();
    const text = message.trim();
    if (!text || feedbackStatus === 'sending') return;

    setFeedbackStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error('Xato');
      setFeedbackStatus('sent');
      setMessage('');
    } catch {
      setFeedbackStatus('error');
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
        <h1 className="text-base font-bold">Shikoyat va takliflar</h1>
      </header>

      <main className="relative z-10 mx-auto max-w-sm px-4 py-8 sm:px-6">
        {feedbackStatus === 'sent' ? (
          <div className="py-8 text-center">
            <Check size={32} className="mx-auto mb-3 text-[#2F9E96]" />
            <p className="text-sm text-[var(--tg-text-1)]">Rahmat! Xabaringiz yuborildi.</p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0D0F14]"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              Suhbatga qaytish
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-[var(--tg-text-3)]">
              Fikringiz, taklifingiz yoki xatolik haqida xabaringiz bevosita ishlab chiquvchiga yetadi.
            </p>
            <form onSubmit={submitFeedback}>
              <textarea
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Fikringizni shu yerga yozing..."
                className="w-full resize-none rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-3 text-sm text-[var(--tg-text-1)] outline-none placeholder-[var(--tg-text-3)] focus:border-[#E4A93B]/40"
              />
              <button
                type="submit"
                disabled={!message.trim() || feedbackStatus === 'sending'}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
              >
                <Send size={15} />
                {feedbackStatus === 'sending' ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
              {feedbackStatus === 'error' && (
                <p className="mt-2 text-center text-xs text-red-400">Xatolik yuz berdi, qayta urinib koʻring.</p>
              )}
            </form>

            <div className="mt-8 border-t border-[var(--tg-border)] pt-5">
              <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
                Ijtimoiy tarmoqlarda
              </p>
              <div className="flex gap-2">
                <a
                  href="https://linkedin.com/in/farhod-gofurov-frontend-aa45a63b7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
                >
                  <LinkedinGlyph />
                </a>
                <a
                  href="https://instagram.com/code.farhod"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
                >
                  <InstagramGlyph />
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
