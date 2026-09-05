'use client';
 
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, Upload, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
import { fileToDataUrl } from '@/lib/files';
import { showToast } from '@/lib/toast';
 
// ============================================================
// "Men nimani o'rganishim kerak?" — foydalanuvchi o'z kasbini (masalan
// "Stomatologiya", "Yurist") va shu sohaga oid hujjat(lar)ini bersa, AI
// o'sha materialdan qisqa yo'riqnoma tuzib, profiliga saqlaydi. Shundan
// keyin HAR BIR suhbatda bot o'sha soha bo'yicha maxsus yordamchiga
// aylanadi — dasturchi har bir sohani alohida o'rgatib o'tirishi shart emas.
// ============================================================
export default function MutaxassislikPage() {
  const { status } = useSession();
  const router = useRouter();
 
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [field, setField] = useState('');
  const [file, setFile] = useState(null);
  const [teaching, setTeaching] = useState(false);
  const [clearing, setClearing] = useState(false);
 
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
 
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/expertise')
      .then((r) => r.json())
      .then((data) => {
        if (data?.mutaxassislik) {
          setCurrent(data.mutaxassislik);
          setField(data.mutaxassislik.soha || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);
 
  async function handleFilePicked(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 15_000_000) {
      showToast('Fayl juda katta (15 MB dan oshmasin).', 'error');
      return;
    }
    const dataUrl = await fileToDataUrl(f);
    setFile({ data: dataUrl.split(',')[1], name: f.name });
  }
 
  async function handleTeach() {
    if (!field.trim()) {
      showToast('Avval soha nomini kiriting (masalan: Stomatologiya).', 'error');
      return;
    }
    setTeaching(true);
    try {
      const res = await fetch('/api/expertise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: field.trim(), file }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Xatolik yuz berdi.');
      setCurrent(data.mutaxassislik);
      setFile(null);
      showToast(`🎓 Tayyor! Endi "${data.mutaxassislik.soha}" sohasi boʻyicha maxsus yordam bera olaman.`, 'success', 6000);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTeaching(false);
    }
  }
 
  async function handleClear() {
    if (!confirm("Sohaviy bilimni butunlay oʻchirishni xohlaysizmi?")) return;
    setClearing(true);
    try {
      await fetch('/api/expertise', { method: 'DELETE' });
      setCurrent(null);
      setField('');
      setFile(null);
      showToast("Oʻchirildi.", 'success');
    } finally {
      setClearing(false);
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
        <h1 className="text-base font-bold">Men nimani oʻrganishim kerak?</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-sm px-4 py-8 sm:px-6">
        <div className="mb-6 flex gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
          <GraduationCap size={18} className="mt-0.5 flex-shrink-0 text-[#2F9E96]" />
          <p className="text-xs leading-relaxed text-[var(--tg-text-3)]">
            Qaysi sohada ishlashingizni ayting (masalan: stomatologiya, yurist, buxgalteriya) va xohlasangiz shu
            sohaga oid hujjat (PDF, Word, Excel) yuklang — men oʻsha materialdan oʻrganib, sizga xuddi shu soha
            boʻyicha maxsus yordamchi boʻlib xizmat qilaman.
          </p>
        </div>
 
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--tg-text-3)]">
            <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
          </div>
        ) : (
          <>
            {current && (
              <div className="mb-5 rounded-xl border border-[#2F9E96]/30 bg-[#2F9E96]/10 p-3.5">
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#2F9E96]">
                  <CheckCircle2 size={14} />
                  Hozirgi soha: {current.soha}
                </div>
                <p className="text-[11px] text-[var(--tg-text-3)]">
                  {new Date(current.updatedAt).toLocaleDateString('uz-UZ')}da oʻrgatilgan
                </p>
              </div>
            )}
 
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
              Soha / kasb
            </label>
            <input
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="Masalan: Stomatologiya"
              className="mb-4 w-full rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3.5 py-2.5 text-sm text-[var(--tg-text-1)] placeholder-[var(--tg-text-4)] outline-none focus:border-[var(--tg-border-strong)]"
            />
 
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
              Hujjat (ixtiyoriy — PDF, Word yoki Excel)
            </label>
            <label className="mb-5 flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-[var(--tg-border)] bg-[var(--tg-surface)] px-3.5 py-3 text-sm text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)]">
              <Upload size={16} className="flex-shrink-0 text-[#E4A93B]" />
              <span className="min-w-0 flex-1 truncate">{file ? file.name : 'Fayl tanlash uchun bosing'}</span>
              <input type="file" accept=".pdf,.docx,.xlsx,.xls" onChange={handleFilePicked} className="hidden" />
            </label>
 
            <button
              onClick={handleTeach}
              disabled={teaching}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              {teaching ? <Loader2 size={15} className="animate-spin" /> : <GraduationCap size={15} />}
              {teaching ? "Oʻrganmoqda..." : "Oʻrgat"}
            </button>
 
            {current && (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Sohaviy bilimni oʻchirish
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
 