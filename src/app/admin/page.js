'use client';
 
import { useEffect, useState, useCallback, Fragment } from 'react';
import { signIn, useSession } from 'next-auth/react';
import {
  Check,
  Loader2,
  Lock,
  Eye,
  Users,
  Circle,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Shield,
  TrendingUp,
  Ban,
  Bell,
  Send,
  Type,
  Save,
  Activity,
  RefreshCw,
  ChartColumn,
  TriangleAlert,
  Trash2,
  Settings,
  Megaphone,
  Wrench,
  Cpu,
  Database,
  HardDrive,
  Bot,
  KeyRound,
  BellRing,
  Clock,
  Zap,
  Timer,
  Sparkles,
  Info,
  CircleCheck,
  CircleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { formatRelative } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { PLANS } from '@/app/plans';
 
 
// Oddiy, kutubxonasiz "ustunli grafik" — oxirgi 14 kunlik faol
// foydalanuvchilar sonini ko'rsatadi. Piksel balandliklardan foydalanamiz
// (foizli emas), chunki flexbox ichida foizli balandlik ishonchli
// ishlamaydi.
function StatsChart({ data }) {
  if (!data || data.length === 0) return null;
  const CHART_H = 110;
  const max = Math.max(1, ...data.map((d) => d.active));
 
  return (
    <div className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
        <TrendingUp size={15} /> Oxirgi 14 kun — faol foydalanuvchilar
      </h3>
      <div className="flex items-end gap-1" style={{ height: CHART_H + 18 }}>
        {data.map((d) => {
          const barPx = Math.max(Math.round((d.active / max) * CHART_H), d.active > 0 ? 6 : 2);
          const dayLabel = new Date(d.date).getDate();
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: CHART_H + 18 }}
            >
              <div className="pointer-events-none absolute -top-1 hidden -translate-y-full whitespace-nowrap rounded-md border border-[var(--tg-border)] bg-[var(--tg-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--tg-text-1)] group-hover:block">
                {d.active} faol {d.newUsers > 0 ? `· +${d.newUsers} yangi` : ''}
              </div>
              <div
                className="w-full rounded-t"
                style={{
                  height: barPx,
                  background: 'linear-gradient(180deg, #E4A93B, #2F9E96)',
                  opacity: d.active > 0 ? 1 : 0.2,
                }}
              />
              <span className="mt-1 text-[9px] text-[var(--tg-text-4)]">{dayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Umumiy kichik yordamchilar — yangi "jonli" bo'limlar uchun.
// ============================================================
const PRIMARY_BTN = 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#0D0F14] disabled:opacity-50';
const PRIMARY_BTN_STYLE = { background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' };
const GHOST_BTN =
  'flex items-center gap-1.5 rounded-lg border border-[var(--tg-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)] disabled:opacity-50';
const INPUT_CLS =
  'w-full rounded-lg border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3 py-2 text-sm text-[var(--tg-text-1)] outline-none focus:border-[var(--tg-border-strong)]';
const LABEL_CLS = 'mb-1 block text-[11px] font-medium text-[var(--tg-text-2)]';

const STATUS_COLORS = {
  ok: '#9ECE6A',
  warn: '#E4A93B',
  err: '#F87171',
};

/** a***@gmail.com — jadval va ro'yxatlarda to'liq email ko'rsatmaslik uchun. */
function maskEmail(email) {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at <= 0) return email.slice(0, 1) + '***';
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`;
}

function fmtMs(ms) {
  const n = Number(ms) || 0;
  if (n < 1000) return `${n} ms`;
  return `${(n / 1000).toFixed(1)} s`;
}

function fmtNum(n) {
  return (Number(n) || 0).toLocaleString('uz-UZ');
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// datetime-local <input> uchun ISO <-> mahalliy "YYYY-MM-DDTHH:mm" konvertatsiyasi.
function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function StatusDot({ state, size = 9 }) {
  const color = STATUS_COLORS[state] || STATUS_COLORS.err;
  return (
    <span
      className="inline-block flex-shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: state === 'ok' ? `0 0 0 3px ${color}22` : 'none',
      }}
    />
  );
}

/** Yoqish/oʻchirish tugmasi (switch). */
function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full border border-[var(--tg-border)] transition"
        style={{ background: checked ? 'linear-gradient(135deg, #E4A93B, #2F9E96)' : 'var(--tg-hover-strong)' }}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? 'calc(100% - 1rem)' : '0.125rem' }}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-[var(--tg-text-1)]">{label}</span>
        {hint && <span className="block text-[11px] leading-snug text-[var(--tg-text-3)]">{hint}</span>}
      </span>
    </label>
  );
}

function SectionHeader({ icon, title, subtitle, right }) {
  return (
    <div className="mb-3 flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          {icon} {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-[var(--tg-text-3)]">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

// ============================================================
// 1) Tizim holati — har bir tashqi xizmatning JONLI holati.
// ============================================================
const HEALTH_CARDS = [
  { id: 'gemini', label: 'Gemini AI', icon: <Sparkles size={15} />, required: true },
  { id: 'redis', label: 'Redis', icon: <Database size={15} />, required: true },
  { id: 'blob', label: 'Blob (fayllar)', icon: <HardDrive size={15} />, required: false },
  { id: 'worker', label: 'Lokal worker', icon: <Cpu size={15} />, required: false },
  { id: 'telegram', label: 'Telegram bot', icon: <Bot size={15} />, required: false },
  { id: 'auth', label: 'Google kirish', icon: <KeyRound size={15} />, required: true },
  { id: 'push', label: 'Push', icon: <BellRing size={15} />, required: false },
  { id: 'cron', label: 'Cron', icon: <Clock size={15} />, required: false },
];

function healthState(check, required) {
  if (!check) return 'err';
  if (check.ok) return 'ok';
  // Sozlanmagan ixtiyoriy xizmat — sariq; majburiy yoki ishlamayotgan — qizil.
  const notConfigured = check.configured === false || /sozlanmagan|yoʻq/i.test(check.detail || '');
  return notConfigured && !required ? 'warn' : 'err';
}

function HealthSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/health', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Xatolik');
      setData(json);
    } catch (err) {
      setError(err.message || 'Holatni olib boʻlmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Har 60 soniyada avtomatik yangilanadi.
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const checks = data?.checks || {};
  const okCount = HEALTH_CARDS.filter((c) => checks[c.id]?.ok).length;
  const env = data?.env || {};
  const envEntries = Object.entries(env);
  const envOk = envEntries.filter(([, v]) => v).length;

  return (
    <section id="holat" className="scroll-mt-20">
      <SectionHeader
        icon={<Activity size={15} />}
        title="Tizim holati"
        subtitle={
          data
            ? `${okCount}/${HEALTH_CARDS.length} xizmat ishlayapti · tekshiruv ${fmtMs(data.totalMs)} · ${fmtDateTime(data.at)}`
            : 'Serverdagi xizmatlar jonli tekshirilmoqda...'
        }
        right={
          <button onClick={load} disabled={loading} className={GHOST_BTN}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Yangilash
          </button>
        }
      />

      {error && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-red-400">
          <CircleAlert size={13} /> {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {HEALTH_CARDS.map((card) => {
          const c = checks[card.id];
          const state = loading && !data ? 'warn' : healthState(c, card.required);
          return (
            <div
              key={card.id}
              className="flex flex-col gap-1.5 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3"
              style={{ borderLeft: `3px solid ${STATUS_COLORS[state]}` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[var(--tg-text-2)]">{card.icon}</span>
                <span className="text-xs font-semibold">{card.label}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[10px] tabular-nums text-[var(--tg-text-3)]">
                  {c && c.ms > 0 && fmtMs(c.ms)}
                  <StatusDot state={state} />
                </span>
              </div>
              <p className="line-clamp-2 text-[11px] leading-snug text-[var(--tg-text-3)]" title={c?.detail || ''}>
                {!data && loading ? 'Tekshirilmoqda...' : c?.detail || 'Maʼlumot yoʻq'}
              </p>

              {/* Worker: qurilma / daraja / klip imkoniyatlari */}
              {card.id === 'worker' && c?.ok && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {c.device && <Pill>{c.device}</Pill>}
                  {c.tier && <Pill>tier: {c.tier}</Pill>}
                  {c.vramGb != null && c.vramGb > 0 && <Pill>{c.vramGb} GB VRAM</Pill>}
                  {c.clips &&
                    ['ffmpeg', 'whisper', 'yt_dlp', 'gemini'].map((k) => (
                      <Pill key={k} tone={c.clips[k] ? 'ok' : 'err'}>
                        {k}
                      </Pill>
                    ))}
                  {c.clips?.whisper_model && <Pill>whisper: {c.clips.whisper_model}</Pill>}
                </div>
              )}

              {/* Telegram: webhook manzili va kutilayotgan yangilanishlar */}
              {card.id === 'telegram' && c && (c.url || c.pendingUpdates > 0) && (
                <div className="mt-0.5 space-y-0.5 text-[10px] text-[var(--tg-text-4)]">
                  {c.url && (
                    <p className="truncate" title={c.url}>
                      {c.url.replace(/^https?:\/\//, '')}
                    </p>
                  )}
                  <p>
                    Kutilayotgan: <span className="tabular-nums text-[var(--tg-text-2)]">{c.pendingUpdates}</span>
                    {c.username && <> · @{c.username}</>}
                  </p>
                </div>
              )}

              {/* Gemini: sozlangan modellar */}
              {card.id === 'gemini' && c?.models?.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {c.models.map((m) => (
                    <Pill key={m}>{m}</Pill>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--tg-text-4)]">
          <span>
            v<span className="text-[var(--tg-text-2)]">{data.version}</span>
          </span>
          <span>·</span>
          <span>
            Region: <span className="text-[var(--tg-text-2)]">{data.region}</span>
          </span>
          <span>·</span>
          <span>
            Node <span className="text-[var(--tg-text-2)]">{data.node}</span>
          </span>
          {data.vercelEnv && (
            <>
              <span>·</span>
              <span>{data.vercelEnv}</span>
            </>
          )}
          {envEntries.length > 0 && (
            <details className="ml-auto">
              <summary className="cursor-pointer select-none text-[var(--tg-text-3)] hover:text-[var(--tg-text-1)]">
                Muhit oʻzgaruvchilari: {envOk}/{envEntries.length}
              </summary>
              <div className="mt-2 flex max-w-full flex-wrap gap-1">
                {envEntries.map(([k, v]) => (
                  <Pill key={k} tone={v ? 'ok' : 'err'}>
                    {k}
                  </Pill>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function Pill({ children, tone, onClick, active }) {
  const toneCls =
    tone === 'ok'
      ? 'border-[#9ECE6A]/40 text-[#9ECE6A]'
      : tone === 'err'
        ? 'border-red-500/30 text-red-400'
        : tone === 'warn'
          ? 'border-[#E4A93B]/40 text-[#E4A93B]'
          : 'border-[var(--tg-border)] text-[var(--tg-text-2)]';
  const cls = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${toneCls} ${
    active ? 'bg-[var(--tg-hover-strong)] text-[var(--tg-text-1)]' : ''
  }`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} transition hover:bg-[var(--tg-hover)]`}>
        {children}
      </button>
    );
  }
  return <span className={cls}>{children}</span>;
}

// ============================================================
// 2) AI foydalanish — kunlik so'rovlar (xatolar qizil), KPI'lar, taqsimot.
// ============================================================
const USAGE_PERIODS = [7, 14, 30];

const KIND_LABELS = {
  chat: 'Chat',
  rasm: 'Rasm',
  qidir: 'Qidiruv',
  kod: 'Kod',
  prezentatsiya: 'Prezentatsiya',
  klip: 'Klip',
  video: 'Video',
  tts: 'Ovozli oʻqish',
  stt: 'Ovozdan matn',
  upload: 'Yuklash',
};

const CHANNEL_LABELS = { web: 'Sayt', telegram: 'Telegram', voice: 'Ovoz', klip: 'Klip' };

function UsageChart({ days }) {
  if (!days || days.length === 0) return null;
  const CHART_H = 110;
  const max = Math.max(1, ...days.map((d) => d.total));
  const gap = days.length > 20 ? 'gap-px' : 'gap-1';

  return (
    <div className={`flex items-end ${gap}`} style={{ height: CHART_H + 18 }}>
      {days.map((d) => {
        const totalPx = Math.max(Math.round((d.total / max) * CHART_H), d.total > 0 ? 6 : 2);
        const errPx = d.total > 0 ? Math.round((d.err / d.total) * totalPx) : 0;
        const okPx = Math.max(totalPx - errPx, 0);
        const dayLabel = new Date(d.date).getDate();
        const showLabel = days.length <= 14 || dayLabel % 5 === 0 || dayLabel === 1;
        return (
          <div
            key={d.date}
            className="group relative flex flex-1 flex-col items-center justify-end"
            style={{ height: CHART_H + 18 }}
          >
            <div className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-md border border-[var(--tg-border)] bg-[var(--tg-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--tg-text-1)] group-hover:block">
              {d.date.slice(5)} · {d.total} soʻrov
              {d.err > 0 ? ` · ${d.err} xato` : ''}
              {d.avgMs > 0 ? ` · ${fmtMs(d.avgMs)}` : ''}
              {d.users > 0 ? ` · ${d.users} kishi` : ''}
            </div>
            <div className="flex w-full flex-col overflow-hidden rounded-t" style={{ height: totalPx, opacity: d.total > 0 ? 1 : 0.2 }}>
              {errPx > 0 && <div style={{ height: errPx, background: '#F87171' }} />}
              <div
                className="flex-1"
                style={{ background: d.total > 0 ? 'linear-gradient(180deg, #E4A93B, #2F9E96)' : 'var(--tg-hover-strong)' }}
              />
            </div>
            <span className="mt-1 text-[9px] text-[var(--tg-text-4)]">{showLabel ? dayLabel : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownPills({ title, data, labels = {}, total }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">{title}</p>
      {entries.length === 0 ? (
        <p className="text-[11px] text-[var(--tg-text-4)]">Hali maʼlumot yoʻq</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([k, v]) => {
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tg-border)] px-2 py-1 text-[11px] text-[var(--tg-text-2)]"
                title={`${v} ta · ${pct}%`}
              >
                {labels[k] || k}
                <span className="tabular-nums font-semibold text-[var(--tg-text-1)]">{fmtNum(v)}</span>
                {pct > 0 && <span className="text-[10px] text-[var(--tg-text-4)]">{pct}%</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UsageSection() {
  const [period, setPeriod] = useState(14);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (days) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usage?days=${days}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setUsage(json);
    } catch {
      // jim — bo'lim bo'sh ko'rinadi
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const days = usage?.days || [];
  const today = days[days.length - 1] || { total: 0, ok: 0, err: 0, avgMs: 0, users: 0 };
  const totals = usage?.totals || { total: 0, ok: 0, err: 0, avgMs: 0, channels: {}, kinds: {}, models: {}, activeUsers: 0 };
  const todayErrPct = today.total > 0 ? Math.round((today.err / today.total) * 100) : 0;
  const periodErrPct = totals.total > 0 ? Math.round((totals.err / totals.total) * 100) : 0;

  const KPIS = [
    { icon: <Zap size={16} />, value: fmtNum(today.total), label: 'bugun soʻrovlar', sub: `${period} kunda ${fmtNum(totals.total)}`, color: '#E4A93B' },
    {
      icon: <TriangleAlert size={16} />,
      value: `${todayErrPct}%`,
      label: 'bugun xatolar',
      sub: `${fmtNum(today.err)} ta · davrda ${periodErrPct}%`,
      color: todayErrPct >= 10 ? '#F87171' : todayErrPct > 0 ? '#E4A93B' : '#9ECE6A',
    },
    { icon: <Timer size={16} />, value: today.avgMs ? fmtMs(today.avgMs) : '—', label: 'oʻrtacha javob', sub: totals.avgMs ? `davrda ${fmtMs(totals.avgMs)}` : '', color: '#82AAFF' },
    { icon: <Users size={16} />, value: fmtNum(today.users), label: 'bugun faol (AI)', sub: `${period} kunda ${fmtNum(totals.activeUsers)}`, color: '#2F9E96' },
  ];

  return (
    <section id="foydalanish" className="scroll-mt-20">
      <SectionHeader
        icon={<ChartColumn size={15} />}
        title="AI foydalanish"
        subtitle="Chat, rasm, klip, ovoz — barcha AI soʻrovlari (faqat sonlar, matn saqlanmaydi)"
        right={
          <div className="flex rounded-lg border border-[var(--tg-border)] p-0.5">
            {USAGE_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                  period === p ? 'bg-[var(--tg-hover-strong)] text-[var(--tg-text-1)]' : 'text-[var(--tg-text-3)]'
                }`}
              >
                {p} kun
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPIS.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)]" style={{ color: c.color }}>
              {c.icon}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none tabular-nums">{loading && !usage ? '…' : c.value}</p>
              <p className="mt-1 text-[11px] text-[var(--tg-text-3)]">{c.label}</p>
              {c.sub && <p className="truncate text-[10px] text-[var(--tg-text-4)]">{c.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <TrendingUp size={15} /> Oxirgi {period} kun — AI soʻrovlari
          </h3>
          <div className="flex items-center gap-3 text-[10px] text-[var(--tg-text-4)]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: 'linear-gradient(180deg, #E4A93B, #2F9E96)' }} /> muvaffaqiyatli
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#F87171' }} /> xato
            </span>
          </div>
        </div>
        {days.length > 0 ? (
          <UsageChart days={days} />
        ) : (
          <p className="text-xs text-[var(--tg-text-3)]">{loading ? 'Yuklanmoqda...' : 'Hali maʼlumot yoʻq.'}</p>
        )}
        {!loading && totals.total === 0 && (
          <p className="mt-2 text-[11px] text-[var(--tg-text-4)]">
            Telemetriya hali yozilmagan — birinchi AI soʻrovidan keyin shu yerda koʻrinadi.
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4 lg:col-span-2">
          <BreakdownPills title="Kanallar" data={totals.channels} labels={CHANNEL_LABELS} total={totals.total} />
          <BreakdownPills title="Turlar" data={totals.kinds} labels={KIND_LABELS} total={totals.total} />
          <BreakdownPills title="Modellar" data={totals.models} total={totals.total} />
        </div>

        <div className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">Bugun eng faol 10</p>
          {(usage?.topUsers || []).length === 0 ? (
            <p className="text-[11px] text-[var(--tg-text-4)]">Bugun hali soʻrov boʻlmadi</p>
          ) : (
            <ol className="space-y-1">
              {usage.topUsers.map((u, i) => (
                <li key={u.email} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-right tabular-nums text-[var(--tg-text-4)]">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--tg-text-2)]" title={u.email}>
                    {maskEmail(u.email)}
                  </span>
                  <span className="tabular-nums font-semibold">{fmtNum(u.count)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 3) Oxirgi xatolar — AI so'rovlaridagi xatolar jadvali.
// ============================================================
function ErrorsSection() {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/errors?limit=50', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setErrors(json.errors || []);
    } catch {
      // jim
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function clearAll() {
    if (!window.confirm('Xatolar roʻyxati toʻliq tozalansinmi? (Statistika hisoblagichlari oʻzgarmaydi)')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/admin/errors', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Xatolik');
      setErrors([]);
      showToast('Xatolar roʻyxati tozalandi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setClearing(false);
    }
  }

  return (
    <section id="xatolar" className="scroll-mt-20">
      <SectionHeader
        icon={<TriangleAlert size={15} />}
        title="Oxirgi xatolar"
        subtitle={errors.length ? `${errors.length} ta (oxirgi 200 tasi saqlanadi)` : 'AI soʻrovlaridagi xatolar shu yerda toʻplanadi'}
        right={
          <>
            <button onClick={load} disabled={loading} className={GHOST_BTN}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Yangilash
            </button>
            <button
              onClick={clearAll}
              disabled={clearing || errors.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[11px] font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Tozalash
            </button>
          </>
        }
      />

      {loading && errors.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-[var(--tg-text-3)]">
          <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
        </div>
      )}

      {!loading && errors.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4 text-xs text-[var(--tg-text-3)]">
          <CircleCheck size={15} className="text-[#9ECE6A]" /> Xatolar yoʻq — hammasi joyida.
        </div>
      )}

      {errors.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--tg-border)]">
          <div className="overflow-x-auto tg-scroll">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--tg-border)] bg-[var(--tg-hover)] text-[11px] uppercase tracking-wide text-[var(--tg-text-3)]">
                  <th className="w-24 px-3 py-2 font-medium">Vaqt</th>
                  <th className="w-20 px-3 py-2 font-medium">Kanal</th>
                  <th className="w-24 px-3 py-2 font-medium">Tur</th>
                  <th className="w-36 px-3 py-2 font-medium">Foydalanuvchi</th>
                  <th className="px-3 py-2 font-medium">Xabar</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={`${e.t}-${i}`} className="border-b border-[var(--tg-border)] align-top last:border-0 hover:bg-[var(--tg-hover)]">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--tg-text-3)]" title={e.t}>
                      {fmtDateTime(e.t)}
                      <span className="block text-[10px] text-[var(--tg-text-4)]">{formatRelative(e.t)}</span>
                    </td>
                    <td className="px-3 py-2">{CHANNEL_LABELS[e.channel] || e.channel || '—'}</td>
                    <td className="px-3 py-2">{KIND_LABELS[e.kind] || e.kind || '—'}</td>
                    <td className="max-w-[9rem] truncate px-3 py-2 text-[var(--tg-text-2)]" title={e.email}>
                      {e.email || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <p className="break-words text-red-300">{e.message}</p>
                      {e.model && <p className="mt-0.5 text-[10px] text-[var(--tg-text-4)]">{e.model}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================
// 4) Ilova sozlamalari — e'lon, texnik ishlar, imkoniyatlar, cheklovlar.
// ============================================================
const DEFAULT_APP_SETTINGS = {
  announcement: { text: '', level: 'info', link: '', until: null, enabled: false },
  maintenance: { enabled: false, message: '' },
  features: { autoTools: true, followups: true, thinkingSummaries: true, clips: true, videoAi: true, imageGen: true },
  limits: { maxUploadMb: 5120 },
};

const ANNOUNCEMENT_LEVEL_OPTIONS = [
  { id: 'info', label: 'Maʼlumot (koʻk)' },
  { id: 'warn', label: 'Ogohlantirish (sariq)' },
  { id: 'success', label: 'Yaxshi yangilik (yashil)' },
];

const ANNOUNCEMENT_STYLES = {
  info: { border: 'rgba(130,170,255,0.4)', bg: 'rgba(130,170,255,0.1)', color: '#82AAFF', icon: <Info size={14} /> },
  warn: { border: 'rgba(228,169,59,0.45)', bg: 'rgba(228,169,59,0.1)', color: '#E4A93B', icon: <TriangleAlert size={14} /> },
  success: { border: 'rgba(158,206,106,0.45)', bg: 'rgba(158,206,106,0.1)', color: '#9ECE6A', icon: <CircleCheck size={14} /> },
};

const FEATURE_OPTIONS = [
  { id: 'autoTools', label: 'Avtomatik vositalar', hint: 'AI oʻzi kerak boʻlsa rasm, qidiruv, kod kabi vositalarni tanlaydi' },
  { id: 'followups', label: 'Davom-savollar', hint: 'Javob ostida keyingi savol uchun tayyor tugmalar' },
  { id: 'thinkingSummaries', label: 'Oʻylash izohi', hint: 'Javobdan oldin AI nima qilayotgani haqida qisqa izoh' },
  { id: 'clips', label: 'Podkast → klip', hint: '/klip sahifasi — uzun videodan qisqa subtitrli kliplar' },
  { id: 'videoAi', label: 'Rasm → video', hint: 'AI yordamida rasmdan qisqa video yaratish' },
  { id: 'imageGen', label: 'Rasm chizish', hint: '/rasm buyrugʻi — AI orqali rasm yaratish' },
];

function AnnouncementPreview({ announcement }) {
  const s = ANNOUNCEMENT_STYLES[announcement.level] || ANNOUNCEMENT_STYLES.info;
  // Hozirgi vaqtni render ichida emas, effektda olamiz (React Compiler "purity" qoidasi).
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const expired = Boolean(now && announcement.until && new Date(announcement.until).getTime() < now);
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--tg-text-4)]">
        Jonli koʻrinish {!announcement.enabled && '· (oʻchirilgan)'} {expired && '· (muddati oʻtgan)'}
      </p>
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
        style={{ borderColor: s.border, background: s.bg, opacity: announcement.enabled && !expired ? 1 : 0.5 }}
      >
        <span style={{ color: s.color }}>{s.icon}</span>
        <span className="min-w-0 flex-1 text-[var(--tg-text-1)]">{announcement.text || 'Eʼlon matni shu yerda koʻrinadi'}</span>
        {announcement.link && (
          <span className="flex-shrink-0 font-medium" style={{ color: s.color }}>
            Batafsil →
          </span>
        )}
      </div>
    </div>
  );
}

function SettingsSection() {
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.settings) setSettings(data.settings);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function patch(section, key, value) {
    setDirty(true);
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Xatolik');
      setSettings(data.settings);
      setDirty(false);
      showToast('Sozlamalar saqlandi — 20 soniya ichida hamma joyda kuchga kiradi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const a = settings.announcement;
  const m = settings.maintenance;

  return (
    <section id="sozlamalar" className="scroll-mt-20 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-4">
      <SectionHeader
        icon={<Settings size={15} />}
        title="Ilova sozlamalari"
        subtitle="Serverdan boshqariladi — kod oʻzgartirmasdan eʼlon chiqarish, imkoniyatlarni yoqish/oʻchirish"
        right={
          !loaded ? (
            <Loader2 size={14} className="animate-spin text-[var(--tg-text-3)]" />
          ) : (
            dirty && <span className="text-[10px] text-[#E4A93B]">Saqlanmagan oʻzgarishlar</span>
          )
        }
      />

      {/* --- E'lon --- */}
      <div className="mb-4 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-bold">
            <Megaphone size={14} /> Eʼlon bandi
          </h3>
          <Toggle checked={Boolean(a.enabled)} onChange={(v) => patch('announcement', 'enabled', v)} label={a.enabled ? 'Yoqilgan' : 'Oʻchirilgan'} />
        </div>

        <div className="mb-3">
          <AnnouncementPreview announcement={a} />
        </div>

        <label className={LABEL_CLS}>Matn <span className="text-[var(--tg-text-4)]">({a.text.length}/300)</span></label>
        <textarea
          value={a.text}
          onChange={(e) => patch('announcement', 'text', e.target.value.slice(0, 300))}
          rows={2}
          maxLength={300}
          placeholder="Masalan: Bugun kechqurun 22:00–23:00 texnik ishlar boʻladi"
          className={`${INPUT_CLS} mb-3 resize-none`}
        />

        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL_CLS}>Daraja</label>
            <select value={a.level} onChange={(e) => patch('announcement', 'level', e.target.value)} className={INPUT_CLS}>
              {ANNOUNCEMENT_LEVEL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>
              Havola <span className="text-[var(--tg-text-4)]">(ixtiyoriy)</span>
            </label>
            <input
              value={a.link || ''}
              onChange={(e) => patch('announcement', 'link', e.target.value)}
              placeholder="https://... yoki /klip"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>
              Muddat <span className="text-[var(--tg-text-4)]">(shu vaqtgacha)</span>
            </label>
            <input
              type="datetime-local"
              value={isoToLocalInput(a.until)}
              onChange={(e) => patch('announcement', 'until', localInputToIso(e.target.value))}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* --- Texnik ishlar --- */}
      <div
        className="mb-4 rounded-xl border bg-[var(--tg-surface)] p-3"
        style={{ borderColor: m.enabled ? 'rgba(248,113,113,0.5)' : 'var(--tg-border)' }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-bold">
            <Wrench size={14} /> Texnik ishlar rejimi
          </h3>
          <Toggle
            checked={Boolean(m.enabled)}
            onChange={(v) => patch('maintenance', 'enabled', v)}
            label={m.enabled ? 'YOQILGAN' : 'Oʻchirilgan'}
          />
        </div>
        <p className="mb-2 text-[11px] text-[var(--tg-text-3)]">
          Yoqilganda sayt, Telegram va ovozli yordamchi yangi soʻrovlarni qabul qilmaydi — foydalanuvchiga quyidagi xabar koʻrsatiladi.
        </p>
        <input
          value={m.message || ''}
          onChange={(e) => patch('maintenance', 'message', e.target.value.slice(0, 300))}
          maxLength={300}
          placeholder="Texnik ishlar ketmoqda, 30 daqiqadan soʻng qaytib keling."
          className={INPUT_CLS}
        />
        {m.enabled && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400">
            <TriangleAlert size={12} /> Diqqat: saqlasangiz hamma foydalanuvchilar uchun chat toʻxtaydi.
          </p>
        )}
      </div>

      {/* --- Imkoniyatlar --- */}
      <div className="mb-4 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold">
          <Sparkles size={14} /> Imkoniyatlar
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURE_OPTIONS.map((f) => (
            <Toggle
              key={f.id}
              checked={settings.features[f.id] !== false}
              onChange={(v) => patch('features', f.id, v)}
              label={f.label}
              hint={f.hint}
            />
          ))}
        </div>
      </div>

      {/* --- Cheklovlar --- */}
      <div className="mb-4 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold">
          <HardDrive size={14} /> Cheklovlar
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLS}>Maksimal yuklash hajmi (MB)</label>
            <input
              type="number"
              min={1}
              max={20480}
              value={settings.limits.maxUploadMb}
              onChange={(e) => patch('limits', 'maxUploadMb', Number(e.target.value))}
              className={INPUT_CLS}
            />
            <p className="mt-1 text-[10px] text-[var(--tg-text-4)]">
              Hozir: {(Number(settings.limits.maxUploadMb) / 1024).toFixed(1)} GB · bir fayl uchun yuqori chegara
            </p>
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving || !loaded} className={PRIMARY_BTN} style={PRIMARY_BTN_STYLE}>
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
        Saqlash
      </button>
    </section>
  );
}

// ============================================================
// Admin paneli — endi UCH BOSQICHLI himoya bilan:
//   1) Google orqali kirish (avvalgidek)
//   2) Email admin ro'yxatida bo'lishi kerak (asosiy yoki qo'shilgan)
//   3) YANGI: alohida parol (PIN) kiritish — sessiya davomida bir marta
// Shundan keyingina "kimlar bor", "onlayn kim" kabi nozik ma'lumotlar ochiladi.
// ============================================================
// Sarlavha uchun tanlanadigan shriftlar (layout.jsx'dagi next/font o'zgaruvchilari).
const HERO_FONTS = {
  display: 'var(--font-display)',
  sans: 'var(--font-geist-sans)',
  mono: 'var(--font-geist-mono)',
};
 
const HERO_SIZES = [
  { id: 'sm', label: 'Kichik' },
  { id: 'md', label: 'Oʻrta' },
  { id: 'lg', label: 'Katta' },
];
 
const HERO_FONT_OPTIONS = [
  { id: 'display', label: 'Bricolage (qalin)' },
  { id: 'sans', label: 'Geist (oddiy)' },
  { id: 'mono', label: 'Geist Mono' },
];
 
export default function AdminPage() {
  const { status } = useSession();
 
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
 
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
 
  // Admin panel FAQAT admin email'lari uchun mavjud — boshqa hech kim, hatto
  // to'g'ri manzilni bilsa ham, PIN kiritish oynasini ko'rmasligi kerak.
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/admin/check-access')
      .then((r) => r.json())
      .then((data) => setHasAccess(Boolean(data?.isAdmin)))
      .catch(() => setHasAccess(false))
      .finally(() => setAccessChecked(true));
  }, [status]);
 
  // MUHIM: PIN hech qachon "eslab qolinmaydi" — har safar sahifaga kirganda
  // (yoki yangilanganda) qayta so'raladi, xavfsizlik uchun ataylab shunday.
 
  async function submitPin(e) {
    e.preventDefault();
    setPinLoading(true);
    setPinError('');
    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pin }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Xatolik');
      setUnlocked(true);
    } catch (err) {
      setPinError(err.message);
    } finally {
      setPinLoading(false);
    }
  }
 
  if (status === 'loading' || (status === 'authenticated' && !accessChecked)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--tg-bg)]">
        <Loader2 size={20} className="animate-spin text-[var(--tg-text-3)]" />
      </div>
    );
  }
 
  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--tg-bg)] px-4">
        <button
          onClick={() => signIn('google')}
          className="rounded-lg border border-[var(--tg-border)] px-4 py-2 text-sm text-[var(--tg-text-1)]"
        >
          Google bilan kirish
        </button>
      </div>
    );
  }
 
  // Admin bo'lmagan foydalanuvchi uchun — bu sahifa UMUMAN mavjud emasdek
  // ko'rsatiladi (PIN oynasi ham, "ruxsat yo'q" degan aniq xabar ham emas —
  // shunchaki oddiy, hech narsa bildirmaydigan holat).
  if (!hasAccess) {
    return <div className="min-h-screen bg-[var(--tg-bg)]" />;
  }
 
  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--tg-bg)] px-4">
        <form onSubmit={submitPin} className="w-full max-w-xs rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-6">
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--tg-border)] text-[#E4A93B]">
              <Lock size={18} />
            </div>
            <h1 className="text-base font-bold text-[var(--tg-text-1)]">Admin panel</h1>
            <p className="text-xs text-[var(--tg-text-3)]">Davom etish uchun parolni kiriting</p>
          </div>
 
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="•••••"
            autoFocus
            className="w-full rounded-lg border border-[var(--tg-border)] bg-[var(--tg-bg)] px-3 py-2.5 text-center text-lg tracking-[0.4em] text-[var(--tg-text-1)] outline-none focus:border-[var(--tg-border-strong)]"
          />
 
          {pinError && <p className="mt-2 text-center text-xs text-red-400">{pinError}</p>}
 
          <button
            type="submit"
            disabled={pinLoading || !pin}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[#0D0F14] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
          >
            {pinLoading ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
            Kirish
          </button>
        </form>
      </div>
    );
  }
 
  return <Dashboard />;
}
 
// ============================================================
// PIN ochilgandan keyingina render bo'ladigan asosiy panel.
// ============================================================
function Dashboard() {
  const [stats, setStats] = useState({ total: 0, onlineCount: 0 });
  const [dailyStats, setDailyStats] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [expandedEmail, setExpandedEmail] = useState(null);
 
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
 
  const [admins, setAdmins] = useState({ primary: '', extra: [] });
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');
 
  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Xatolik');
      setUsers(data.users || []);
      setStats({ total: data.total || 0, onlineCount: data.onlineCount || 0 });
    } catch {
      // Jimgina — jadval bo'sh ko'rinadi
    } finally {
      setUsersLoading(false);
    }
  }
 
  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (res.ok) setDailyStats(data.days || []);
    } catch {
      // jim — grafik shunchaki ko'rinmaydi
    }
  }
 
  const [blockingEmail, setBlockingEmail] = useState(null);
 
  // --- Boshlanish ekranidagi katta sarlavha ---
  const [hero, setHero] = useState({
    text: 'Xoʻsh, nimadan boshlaymiz?',
    subtitle: '',
    colorMode: 'gradient',
    color: '#E4A93B',
    gradientFrom: '#F3EEE2',
    gradientTo: '#E4A93B',
    font: 'display',
    size: 'md',
  });
  const [heroSaving, setHeroSaving] = useState(false);
 
  useEffect(() => {
    fetch('/api/hero')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.text) setHero(data);
      })
      .catch(() => {});
  }, []);
 
  function setHeroField(key, value) {
    setHero((prev) => ({ ...prev, [key]: value }));
  }
 
  async function saveHero() {
    if (!hero.text.trim()) {
      showToast('Sarlavha matnini kiriting.', 'error');
      return;
    }
    setHeroSaving(true);
    try {
      const res = await fetch('/api/hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hero),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Xatolik');
      setHero(data.hero);
      showToast('Saqlandi — bosh sahifada koʻrinadi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setHeroSaving(false);
    }
  }
 
  const heroPreviewStyle =
    hero.colorMode === 'solid'
      ? { color: hero.color, fontFamily: HERO_FONTS[hero.font] }
      : {
          backgroundImage: `linear-gradient(90deg, ${hero.gradientFrom}, ${hero.gradientTo})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
          fontFamily: HERO_FONTS[hero.font],
        };
 
  const [broadcastTitle, setBroadcastTitle] = useState('ToshkentGPT');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
 
  async function sendBroadcast() {
    if (!broadcastMessage.trim()) {
      showToast('Xabar matnini kiriting.', 'error');
      return;
    }
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: broadcastTitle, message: broadcastMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Xatolik');
      showToast(`Yuborildi: ${data.sent} ta qurilmaga (${data.totalUsers} foydalanuvchi obuna).`, 'success');
      setBroadcastMessage('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSendingBroadcast(false);
    }
  }
 
  async function toggleBlock(email, currentlyBlocked) {
    setBlockingEmail(email);
    try {
      const res = await fetch('/api/admin/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: currentlyBlocked ? 'unblock' : 'block' }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Xatolik');
      setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, blocked: !currentlyBlocked } : u)));
      showToast(currentlyBlocked ? `${email} blokdan chiqarildi.` : `${email} bloklandi.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBlockingEmail(null);
    }
  }
 
  async function loadRequests() {
    setRequestsLoading(true);
    try {
      const res = await fetch('/api/admin/requests');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Xatolik');
      setRequests(data.requests || []);
    } catch {
      // jim
    } finally {
      setRequestsLoading(false);
    }
  }
 
  async function loadAdmins() {
    try {
      const res = await fetch('/api/admin/admins');
      const data = await res.json();
      if (res.ok) setAdmins({ primary: data.primary || '', extra: data.extra || [] });
    } catch {
      // jim
    }
  }
 
  useEffect(() => {
    loadUsers();
    loadStats();
    loadRequests();
    loadAdmins();
    // Onlayn holatni yangilab turish uchun har 30 soniyada ro'yxatni qayta yuklaymiz.
    const interval = setInterval(loadUsers, 30000);
    return () => clearInterval(interval);
  }, []);
 
  const [amounts, setAmounts] = useState({}); // { [requestId]: "20000" }
 
  async function approve(id, months) {
    setApprovingId(id);
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, months }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Xatolik');
      setRequests((prev) => prev.filter((r) => r.id !== id));
      showToast(`Tasdiqlandi — ${months} oylik tarif berildi.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setApprovingId(null);
    }
  }
 
  async function addAdmin(e) {
    e.preventDefault();
    setAddingAdmin(true);
    setAdminError('');
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Xatolik');
      setNewAdminEmail('');
      loadAdmins();
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setAddingAdmin(false);
    }
  }
 
  // Bugungi faol va yangi foydalanuvchilar — kunlik statistikaning oxirgi kuni.
  const today = dailyStats[dailyStats.length - 1] || { active: 0, newUsers: 0 };
  const pendingRequests = requests.filter((r) => r.status === 'pending' || !r.status).length;
 
  const NAV = [
    { id: 'holat', label: 'Holat' },
    { id: 'statistika', label: 'Statistika' },
    { id: 'foydalanish', label: 'AI foydalanish' },
    { id: 'xatolar', label: 'Xatolar' },
    { id: 'bildirishnoma', label: 'Bildirishnoma' },
    { id: 'sarlavha', label: 'Sarlavha' },
    { id: 'sozlamalar', label: 'Sozlamalar' },
    { id: 'foydalanuvchilar', label: 'Foydalanuvchilar' },
    { id: 'tolovlar', label: `Toʻlovlar${pendingRequests ? ` · ${pendingRequests}` : ''}` },
    { id: 'adminlar', label: 'Adminlar' },
  ];
 
  return (
    <div className="min-h-screen bg-[var(--tg-bg)] text-[var(--tg-text-1)]">
      {/* Yopishqoq sarlavha + bo'limlar navigatsiyasi */}
      <header className="sticky top-0 z-20 border-b border-[var(--tg-border)] bg-[var(--tg-bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
            title="Saytga qaytish"
          >
            <ChevronDown size={15} className="rotate-90" />
          </Link>
          <h1 className="text-base font-bold">Admin panel</h1>
          <nav className="ml-auto flex gap-1 overflow-x-auto tg-scroll">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="whitespace-nowrap rounded-full border border-[var(--tg-border)] px-2.5 py-1 text-[11px] text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
 
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {/* --- Tizim holati (jonli tekshiruvlar) --- */}
        <HealthSection />

        {/* --- Statistika kartochkalari --- */}
        <div id="statistika" className="grid scroll-mt-20 grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <Eye size={17} />, value: stats.total, label: 'jami foydalanuvchi', color: '#E4A93B' },
            { icon: <Circle size={12} fill="currentColor" />, value: stats.onlineCount, label: 'hozir onlayn', color: '#2F9E96' },
            { icon: <Users size={17} />, value: today.active, label: 'bugun faol', color: '#82AAFF' },
            { icon: <Check size={17} />, value: today.newUsers, label: 'bugun yangi', color: '#9ECE6A' },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)]" style={{ color: c.color }}>
                {c.icon}
              </div>
              <div>
                <p className="text-xl font-bold leading-none tabular-nums">{c.value}</p>
                <p className="mt-1 text-[11px] text-[var(--tg-text-3)]">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
 
        <StatsChart data={dailyStats} />

        {/* --- AI foydalanish (serverdagi telemetriya) --- */}
        <UsageSection />

        {/* --- Oxirgi xatolar --- */}
        <ErrorsSection />

        <div id="bildirishnoma" className="scroll-mt-20 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Bell size={15} /> Hammaga bildirishnoma yuborish
          </h3>
          <input
            value={broadcastTitle}
            onChange={(e) => setBroadcastTitle(e.target.value)}
            placeholder="Sarlavha"
            className="mb-2 w-full rounded-lg border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3 py-2 text-xs text-[var(--tg-text-1)] outline-none focus:border-[var(--tg-border-strong)]"
          />
          <textarea
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder="Xabar matni..."
            rows={2}
            className="mb-2 w-full resize-none rounded-lg border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3 py-2 text-xs text-[var(--tg-text-1)] outline-none focus:border-[var(--tg-border-strong)]"
          />
          <button
            onClick={sendBroadcast}
            disabled={sendingBroadcast}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#0D0F14] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
          >
            {sendingBroadcast ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Yuborish
          </button>
        </div>
 
        {/* --- Bosh sahifadagi katta sarlavha --- */}
        <section id="sarlavha" className="scroll-mt-20 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Type size={15} /> Bosh sahifadagi sarlavha
          </h2>
          <p className="mb-3 text-[11px] text-[var(--tg-text-3)]">
            Foydalanuvchi ilovani ochganda oʻrtada koʻrinadigan katta yozuv. Har kuni boshqa soʻz yozib qoʻysangiz boʻladi.
          </p>
 
          {/* Jonli koʻrinish */}
          <div className="mb-4 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-bg)] px-4 py-6 text-center">
            <p className="text-[26px] font-extrabold leading-tight" style={heroPreviewStyle}>
              {hero.text || 'Sarlavha matni'}
            </p>
            {hero.subtitle && (
              <p className="mt-2 text-xs text-[var(--tg-text-2)]">{hero.subtitle}</p>
            )}
          </div>
 
          <label className="mb-1 block text-[11px] font-medium text-[var(--tg-text-2)]">Sarlavha matni</label>
          <input
            value={hero.text}
            onChange={(e) => setHeroField('text', e.target.value)}
            maxLength={120}
            placeholder="Xoʻsh, nimadan boshlaymiz?"
            className="mb-3 w-full rounded-lg border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3 py-2 text-sm text-[var(--tg-text-1)] outline-none focus:border-[var(--tg-border-strong)]"
          />
 
          <label className="mb-1 block text-[11px] font-medium text-[var(--tg-text-2)]">
            Ostidagi kichik yozuv <span className="text-[var(--tg-text-4)]">(boʻsh qoldirsangiz — odatdagi salomlashuv)</span>
          </label>
          <input
            value={hero.subtitle}
            onChange={(e) => setHeroField('subtitle', e.target.value)}
            maxLength={200}
            placeholder="Masalan: Bugun nimani bilmoqchisiz?"
            className="mb-3 w-full rounded-lg border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3 py-2 text-sm text-[var(--tg-text-1)] outline-none focus:border-[var(--tg-border-strong)]"
          />
 
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--tg-text-2)]">Shrift</label>
              <select
                value={hero.font}
                onChange={(e) => setHeroField('font', e.target.value)}
                className="w-full rounded-lg border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3 py-2 text-sm text-[var(--tg-text-1)] outline-none"
              >
                {HERO_FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--tg-text-2)]">Oʻlcham</label>
              <select
                value={hero.size}
                onChange={(e) => setHeroField('size', e.target.value)}
                className="w-full rounded-lg border border-[var(--tg-border)] bg-[var(--tg-hover)] px-3 py-2 text-sm text-[var(--tg-text-1)] outline-none"
              >
                {HERO_SIZES.map((z) => (
                  <option key={z.id} value={z.id}>{z.label}</option>
                ))}
              </select>
            </div>
          </div>
 
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-[var(--tg-border)] p-0.5">
              {[
                { id: 'gradient', label: 'Gradient' },
                { id: 'solid', label: 'Bitta rang' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setHeroField('colorMode', m.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                    hero.colorMode === m.id
                      ? 'bg-[var(--tg-hover-strong)] text-[var(--tg-text-1)]'
                      : 'text-[var(--tg-text-3)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
 
            {hero.colorMode === 'solid' ? (
              <label className="flex items-center gap-2 text-[11px] text-[var(--tg-text-2)]">
                Rang
                <input
                  type="color"
                  value={hero.color}
                  onChange={(e) => setHeroField('color', e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border border-[var(--tg-border)] bg-transparent"
                />
              </label>
            ) : (
              <>
                <label className="flex items-center gap-2 text-[11px] text-[var(--tg-text-2)]">
                  Boshi
                  <input
                    type="color"
                    value={hero.gradientFrom}
                    onChange={(e) => setHeroField('gradientFrom', e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border border-[var(--tg-border)] bg-transparent"
                  />
                </label>
                <label className="flex items-center gap-2 text-[11px] text-[var(--tg-text-2)]">
                  Oxiri
                  <input
                    type="color"
                    value={hero.gradientTo}
                    onChange={(e) => setHeroField('gradientTo', e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border border-[var(--tg-border)] bg-transparent"
                  />
                </label>
              </>
            )}
          </div>
 
          <button
            onClick={saveHero}
            disabled={heroSaving}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#0D0F14] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
          >
            {heroSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Saqlash
          </button>
        </section>

        {/* --- Ilova sozlamalari (e'lon, texnik ishlar, imkoniyatlar) --- */}
        <SettingsSection />

        {/* --- Foydalanuvchilar jadvali --- */}
        <section id="foydalanuvchilar" className="scroll-mt-20">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Users size={15} /> Foydalanuvchilar
          </h2>
 
          {usersLoading && (
            <div className="flex items-center gap-2 text-sm text-[var(--tg-text-3)]">
              <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
            </div>
          )}
 
          {!usersLoading && users.length === 0 && (
            <p className="text-sm text-[var(--tg-text-3)]">Hozircha hech kim roʻyxatga tushmagan.</p>
          )}
 
          {!usersLoading && users.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-[var(--tg-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--tg-border)] bg-[var(--tg-hover)] text-[11px] uppercase tracking-wide text-[var(--tg-text-3)]">
                    <th className="px-3 py-2 font-medium">Ism familiya</th>
                    <th className="w-20 px-3 py-2 font-medium">Holat</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isOpen = expandedEmail === u.email;
                    const profileEntries = Object.entries(u.profile || {}).filter(([, v]) => v);
                    return (
                      <Fragment key={u.email}>
                        <tr
                          onClick={() => setExpandedEmail(isOpen ? null : u.email)}
                          className="cursor-pointer border-b border-[var(--tg-border)] transition hover:bg-[var(--tg-hover)] last:border-0"
                        >
                          <td className="px-3 py-2.5">
                            {u.name || u.profile?.ism || u.profile?.familiya
                              ? `${u.profile?.ism || u.name || ''} ${u.profile?.familiya || ''}`.trim()
                              : u.email}
                            {u.blocked && (
                              <span className="ml-2 rounded-full border border-red-500/30 px-1.5 py-0.5 text-[10px] text-red-400">
                                Bloklangan
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs ${
                                u.online ? 'text-[#2F9E96]' : 'text-[var(--tg-text-4)]'
                              }`}
                            >
                              <Circle size={7} fill="currentColor" />
                              {u.online ? 'Onlayn' : 'Offlayn'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[var(--tg-text-3)]">
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-[var(--tg-border)] bg-[var(--tg-hover)]/40 last:border-0">
                            <td colSpan={3} className="px-3 py-3">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-[var(--tg-text-4)]">Email:</span> {u.email}
                                </div>
                                <div>
                                  <span className="text-[var(--tg-text-4)]">Birinchi kirgan:</span>{' '}
                                  {formatRelative(u.firstSeen)}
                                </div>
                                <div>
                                  <span className="text-[var(--tg-text-4)]">Oxirgi faollik:</span>{' '}
                                  {formatRelative(u.lastSeen)}
                                </div>
                              </div>
 
                              {profileEntries.length > 0 && (
                                <div className="mt-3 border-t border-[var(--tg-border)] pt-3">
                                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
                                    Chatdan yigʻilgan maʼlumotlar
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {profileEntries.map(([k, v]) => (
                                      <span
                                        key={k}
                                        className="rounded-full border border-[var(--tg-border)] px-2 py-1 text-[11px] text-[var(--tg-text-2)]"
                                      >
                                        <span className="text-[var(--tg-text-4)]">{k}:</span> {String(v)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
 
                              <div className="mt-3 border-t border-[var(--tg-border)] pt-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleBlock(u.email, u.blocked);
                                  }}
                                  disabled={blockingEmail === u.email}
                                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                                    u.blocked
                                      ? 'border-[#2F9E96]/30 text-[#2F9E96] hover:bg-[#2F9E96]/10'
                                      : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                  }`}
                                >
                                  {blockingEmail === u.email ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <Ban size={13} />
                                  )}
                                  {u.blocked ? 'Blokdan chiqarish' : 'Bloklash'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
 
        {/* --- To'lov so'rovlari --- */}
        <section id="tolovlar" className="scroll-mt-20">
          <h2 className="mb-3 text-sm font-bold">Toʻlov soʻrovlari</h2>
 
          {requestsLoading && (
            <div className="flex items-center gap-2 text-sm text-[var(--tg-text-3)]">
              <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
            </div>
          )}
 
          {!requestsLoading && requests.length === 0 && (
            <p className="text-sm text-[var(--tg-text-3)]">Hozircha kutilayotgan soʻrov yoʻq.</p>
          )}
 
          <ul className="space-y-2">
            {requests.map((r) => {
              const planPrice = PLANS[r.plan]?.priceAmount || 0;
              const enteredAmount = amounts[r.id] ?? String(planPrice || '');
              const computedMonths = planPrice > 0 ? Math.max(1, Math.round(Number(enteredAmount) / planPrice)) : 1;
 
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3"
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{r.planName}</p>
                      <p className="text-xs text-[var(--tg-text-3)]">
                        {r.name ? `${r.name} — ` : ''}
                        {r.email}
                      </p>
                      <p className="text-[10px] text-[var(--tg-text-4)]">{new Date(r.createdAt).toLocaleString('uz-UZ')}</p>
                    </div>
                  </div>
 
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] text-[var(--tg-text-4)]">
                        Kelgan summa (soʻm) — {planPrice.toLocaleString('uz-UZ')} soʻm/oy
                      </label>
                      <input
                        type="number"
                        value={enteredAmount}
                        onChange={(e) => setAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="w-full rounded-lg border border-[var(--tg-border)] bg-[var(--tg-hover)] px-2.5 py-1.5 text-xs text-[var(--tg-text-1)] outline-none focus:border-[var(--tg-border-strong)]"
                      />
                    </div>
                    <button
                      onClick={() => approve(r.id, computedMonths)}
                      disabled={approvingId === r.id}
                      title={`${computedMonths} oylik tarif beriladi`}
                      className="flex flex-shrink-0 items-center gap-1.5 self-end rounded-lg px-3 py-2 text-xs font-semibold text-[#0D0F14] disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
                    >
                      {approvingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {computedMonths} oy
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
 
        {/* --- Adminlarni boshqarish --- */}
        <section id="adminlar" className="scroll-mt-20">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Shield size={15} /> Adminlar
          </h2>
 
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[#E4A93B]/40 px-2.5 py-1 text-xs text-[#E4A93B]">
              {admins.primary} (asosiy)
            </span>
            {admins.extra.map((e) => (
              <span key={e} className="rounded-full border border-[var(--tg-border)] px-2.5 py-1 text-xs text-[var(--tg-text-2)]">
                {e}
              </span>
            ))}
          </div>
 
          <form onSubmit={addAdmin} className="flex gap-2">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="yangi-admin@gmail.com"
              className="flex-1 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3 py-2 text-sm text-[var(--tg-text-1)] outline-none focus:border-[var(--tg-border-strong)]"
            />
            <button
              type="submit"
              disabled={addingAdmin || !newAdminEmail}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--tg-border)] px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              {addingAdmin ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Qoʻshish
            </button>
          </form>
          {adminError && <p className="mt-2 text-xs text-red-400">{adminError}</p>}
        </section>
      </div>
    </div>
  );
}
 