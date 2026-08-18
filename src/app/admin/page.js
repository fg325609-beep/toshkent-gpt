'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { Check, Loader2 } from 'lucide-react';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/requests');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Xatolik');
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'authenticated') load();
    if (status === 'unauthenticated') setLoading(false);
  }, [status]);

  async function approve(id) {
    setApprovingId(id);
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, months: 1 }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Xatolik');
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err.message);
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--tg-bg)] px-4 py-8 text-[var(--tg-text-1)]">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-lg font-bold">To'lov so'rovlari</h1>

        {status === 'unauthenticated' && (
          <button
            onClick={() => signIn('google')}
            className="rounded-lg border border-[var(--tg-border)] px-4 py-2 text-sm"
          >
            Google bilan kirish
          </button>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--tg-text-3)]">
            <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && status === 'authenticated' && requests.length === 0 && (
          <p className="text-sm text-[var(--tg-text-3)]">Hozircha kutilayotgan so'rov yo'q.</p>
        )}

        <ul className="space-y-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3"
            >
              <div>
                <p className="text-sm font-semibold">{r.planName}</p>
                <p className="text-xs text-[var(--tg-text-3)]">
                  {r.name ? `${r.name} — ` : ''}
                  {r.email}
                </p>
                <p className="text-[10px] text-[var(--tg-text-4)]">{new Date(r.createdAt).toLocaleString('uz-UZ')}</p>
              </div>
              <button
                onClick={() => approve(r.id)}
                disabled={approvingId === r.id}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0D0F14] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
              >
                {approvingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Tasdiqlash
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
