'use client';
 
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Download, Inbox } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
import { storageKey, loadJSON } from '@/lib/storage';
 
// ============================================================
// "Fayllar tarixi" — barcha suhbatlar (localStorage'dagi barcha
// sessiyalar) bo'ylab yurib, yuklangan va bot yaratgan rasm/fayllarni
// bitta ro'yxatga yig'adi. Ma'lumotlar serverda emas, shu qurilmaning
// localStorage'ida saqlanadi — shuning uchun bu sahifa ham to'g'ridan-to'g'ri
// shu yerdan o'qiydi (aynan chat sahifasi qanday saqlasa, shundan).
// ============================================================
export default function FayllarPage() {
  const { status, data: authData } = useSession();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
 
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
 
  useEffect(() => {
    if (status !== 'authenticated') return;
    const userEmail = authData?.user?.email;
    const SESSIONS_KEY = storageKey('toshkentgpt.sessions.v1', userEmail);
    const sessions = loadJSON(SESSIONS_KEY, []);
 
    const collected = [];
    for (const s of sessions) {
      for (const msg of s.messages || []) {
        if (msg.image?.dataUrl) {
          collected.push({
            id: msg.id,
            kind: 'image',
            source: msg.role === 'user' ? 'Yuklangan' : 'Bot yaratgan',
            name: msg.image.name || 'rasm.png',
            dataUrl: msg.image.dataUrl,
            sessionTitle: s.title,
            time: msg.time,
          });
        }
        if (msg.file?.base64) {
          collected.push({
            id: msg.id,
            kind: 'file',
            source: 'Bot yaratgan',
            name: msg.file.filename || 'fayl',
            dataUrl: `data:${msg.file.mimeType};base64,${msg.file.base64}`,
            sessionTitle: s.title,
            time: msg.time,
          });
        }
      }
    }
 
    collected.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
    setItems(collected);
    setLoaded(true);
  }, [status, authData]);
 
  function download(item) {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
        <h1 className="text-base font-bold">Fayllar tarixi</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-lg px-4 py-8 sm:px-6">
        {!loaded && <p className="text-sm text-[var(--tg-text-3)]">Yuklanmoqda...</p>}
 
        {loaded && items.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <Inbox size={28} className="mb-3 text-[var(--tg-text-4)]" />
            <p className="text-sm text-[var(--tg-text-3)]">
              Hozircha fayl yoʻq — yuklagan yoki bot yaratgan rasm/prezentatsiyalar shu yerda koʻrinadi.
            </p>
          </div>
        )}
 
        {loaded && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3"
              >
                {item.kind === 'image' ? (
                  <img src={item.dataUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)]">
                    <FileText size={20} className="text-[var(--tg-text-3)]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--tg-text-1)]">{item.name}</p>
                  <p className="truncate text-[11px] text-[var(--tg-text-4)]">
                    {item.source} · {item.sessionTitle} · {item.time ? new Date(item.time).toLocaleDateString('uz-UZ') : ''}
                  </p>
                </div>
                <button
                  onClick={() => download(item)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--tg-text-3)] transition hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
                >
                  <Download size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
 