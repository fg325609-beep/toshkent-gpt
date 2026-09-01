'use client';
 
import { useEffect, useState, Fragment } from 'react';
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
} from 'lucide-react';
import { formatRelative } from '@/lib/format';
 
const PIN_SESSION_KEY = 'tg-admin-unlocked';
 
// ============================================================
// Admin paneli — endi UCH BOSQICHLI himoya bilan:
//   1) Google orqali kirish (avvalgidek)
//   2) Email admin ro'yxatida bo'lishi kerak (asosiy yoki qo'shilgan)
//   3) YANGI: alohida parol (PIN) kiritish — sessiya davomida bir marta
// Shundan keyingina "kimlar bor", "onlayn kim" kabi nozik ma'lumotlar ochiladi.
// ============================================================
export default function AdminPage() {
  const { status } = useSession();
 
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
 
  useEffect(() => {
    if (sessionStorage.getItem(PIN_SESSION_KEY) === '1') setUnlocked(true);
  }, []);
 
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
      sessionStorage.setItem(PIN_SESSION_KEY, '1');
      setUnlocked(true);
    } catch (err) {
      setPinError(err.message);
    } finally {
      setPinLoading(false);
    }
  }
 
  if (status === 'loading') {
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
    loadRequests();
    loadAdmins();
    // Onlayn holatni yangilab turish uchun har 30 soniyada ro'yxatni qayta yuklaymiz.
    const interval = setInterval(loadUsers, 30000);
    return () => clearInterval(interval);
  }, []);
 
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
 
  return (
    <div className="min-h-screen bg-[var(--tg-bg)] px-4 py-8 text-[var(--tg-text-1)]">
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-lg font-bold">Admin panel</h1>
 
        {/* --- Statistika kartochkalari --- */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[#E4A93B]">
              <Eye size={17} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{stats.total}</p>
              <p className="mt-1 text-[11px] text-[var(--tg-text-3)]">jami foydalanuvchi</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2F9E96]/30 text-[#2F9E96]">
              <Circle size={12} fill="currentColor" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{stats.onlineCount}</p>
              <p className="mt-1 text-[11px] text-[var(--tg-text-3)]">hozir onlayn</p>
            </div>
          </div>
        </div>
 
        {/* --- Foydalanuvchilar jadvali --- */}
        <section>
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
        <section>
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
        </section>
 
        {/* --- Adminlarni boshqarish --- */}
        <section>
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
 