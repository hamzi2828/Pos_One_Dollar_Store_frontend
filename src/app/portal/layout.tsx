'use client';

// Employee Portal: a staff login sees only its own attendance, salary, money
// and details. Lives outside /admin with its own phone-first layout.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { endPreview, previewAs } from './_lib/portalApi';
import { CalendarDays, Home, LayoutDashboard, Loader2, LogOut, UserRound, Banknote, Coins, UserX } from 'lucide-react';
import { Wordmark } from '@/components/ui/wordmark';
import { isPortalHost } from '@/lib/portalHost';
import { AccessProvider, useAccess } from '@/context/AccessContext';
import { clearAllAuth, getAuthToken, getRole, isAuthenticated, isPortalToken } from '@/helper/helper';
import axios from 'axios';
import { apiErrorMessage } from '@/lib/storeApi';
import { Avatar } from '@/app/(routes)/admin/hr/attendance/components/AttendanceBits';
import { NO_EMPLOYEE_MESSAGE, isNoEmployee, portalApi, type PortalProfile } from './_lib/portalApi';
import { ErrorCard, Loading, PortalContext, cardClass } from './_lib/PortalBits';

const TABS = [
  { href: '/portal', label: 'Home', Icon: Home },
  { href: '/portal/attendance', label: 'Attendance', Icon: CalendarDays },
  { href: '/portal/cuts', label: 'Cuts / Tips', Icon: Coins },
  { href: '/portal/salary', label: 'Payslips', Icon: Banknote },
  { href: '/portal/details', label: 'Me', Icon: UserRound },
];

const isActive = (path: string, href: string) => (href === '/portal' ? path === '/portal' : path === href || path.startsWith(`${href}/`));

function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/portal';
  const { access } = useAccess();

  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [noEmployee, setNoEmployee] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.profile();
      setProfile(res.data);
      setNoEmployee(false);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 401) {
        // Token expired / employee no longer active: back to sign in.
        clearAllAuth();
        router.replace('/authentication?next=/portal');
        return;
      }
      if (isNoEmployee(e)) setNoEmployee(true);
      else setError(apiErrorMessage(e, 'Could not load your details. Check the internet and try again.'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  // Same as the admin sign out: lock the button until the page goes.
  const [signingOut, setSigningOut] = useState(false);
  const navLockRef = useRef(false);
  const signOut = () => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    setSigningOut(true);
    clearAllAuth();
    router.replace('/authentication?next=/portal');
  };

  // "Admin panel" only for logins that can open something there.
  const role = getRole();
  // employee.dollarandco.org: portal only, no link to the admin panel.
  const [onPortalHost, setOnPortalHost] = useState(false);
  useEffect(() => setOnPortalHost(isPortalHost()), []);
  const hasAdmin =
    role === 'admin' &&
    (!access || access.isSuperAdmin || Object.values(access.permissions || {}).some((list) => Array.isArray(list) && list.length > 0));

  // Admin preview of someone else's portal (opened from the employee page).
  const [previewId, setPreviewId] = useState<string | null>(null);
  useEffect(() => {
    setPreviewId(previewAs());
  }, []);
  const exitPreview = () => {
    const id = previewId;
    endPreview();
    router.replace(id ? `/admin/hr/employees/${id}` : '/admin');
  };

  const emp = profile?.employee;
  const name = emp?.name || `${access?.user?.firstName || ''} ${access?.user?.lastName || ''}`.trim() || 'Employee';
  const ctx = useMemo(() => (profile ? { profile, reload: load } : null), [profile, load]);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {previewId && (
        <div className="print:hidden bg-amber-400 text-gray-900 text-xs sm:text-sm">
          <div className="mx-auto max-w-3xl px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
            <span>
              Admin view: you are seeing <b>{profile?.employee?.name || 'this employee'}</b>&apos;s portal (read only).
            </span>
            <button type="button" onClick={exitPreview} className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-gray-800">
              Close
            </button>
          </div>
        </div>
      )}
      <header className="print:hidden sticky top-0 z-30 bg-brand-ink text-white shadow">
        <div className="mx-auto max-w-3xl px-3 sm:px-4 h-14 flex items-center gap-3">
          <Link href="/portal" className="flex-shrink-0" aria-label="Employee Portal home">
            <Wordmark className="text-xl" />
          </Link>
          <span className="hidden sm:inline text-sm font-bold uppercase tracking-[0.15em] text-brand-yellow">Employee Portal</span>
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {hasAdmin && !onPortalHost && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
                title="Admin panel"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Admin panel</span>
              </Link>
            )}
            {emp && (
              <div className="flex items-center gap-2 min-w-0">
                <Avatar url={emp.photo} name={name} size="sm" />
                <span className="hidden sm:block text-sm font-medium truncate max-w-[140px]">{name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-busy={signingOut}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 hover:bg-red-500/20 hover:text-white disabled:opacity-60"
              aria-label="Sign out"
            >
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </div>
        {/* Tabs on bigger screens */}
        {ctx && (
          <nav className="hidden sm:block border-t border-white/10" aria-label="Portal sections">
            <div className="mx-auto max-w-3xl px-4 flex gap-1">
              {TABS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 ${
                    isActive(pathname, t.href) ? 'border-brand-yellow text-brand-yellow' : 'border-transparent text-white/70 hover:text-white'
                  }`}
                >
                  <t.Icon className="h-4 w-4" />
                  {t.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-3 sm:px-4 py-4 pb-24 sm:pb-8 print:p-0 print:max-w-none">
        {loading && !profile ? (
          <Loading text="Opening your portal…" />
        ) : noEmployee ? (
          <div className={`${cardClass} py-12 px-5 text-center`}>
            <UserX className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h1 className="text-base font-semibold text-gray-900">No employee record</h1>
            <p className="mt-1 text-sm text-gray-600">{NO_EMPLOYEE_MESSAGE}</p>
            {hasAdmin && !onPortalHost && (
              <Link href="/admin" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-honey-700 hover:underline">
                <LayoutDashboard className="h-4 w-4" /> Go to the admin panel
              </Link>
            )}
          </div>
        ) : error && !profile ? (
          <ErrorCard message={error} onRetry={load} />
        ) : ctx ? (
          <PortalContext.Provider value={ctx}>{children}</PortalContext.Provider>
        ) : null}
      </main>

      {/* Bottom tab bar on phones */}
      {ctx && (
        <nav
          className="print:hidden sm:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]"
          aria-label="Portal sections"
        >
          <div className="grid grid-cols-5">
            {TABS.map((t) => {
              const on = isActive(pathname, t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium ${on ? 'text-brand-ink' : 'text-gray-500'}`}
                  aria-current={on ? 'page' : undefined}
                >
                  <span className={`flex items-center justify-center h-7 w-12 rounded-full ${on ? 'bg-brand-yellow' : ''}`}>
                    <t.Icon className="h-[18px] w-[18px]" />
                  </span>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/portal';
  const [ready, setReady] = useState(false);

  // Client-side guard (middleware does the same by cookie): any valid login.
  // No internet: keep the session if a token is there.
  useEffect(() => {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const authed = isAuthenticated() || (offline && !!getAuthToken());
    if (!authed) {
      router.replace(`/authentication?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
  }, [router, pathname]);

  if (!ready) return null;

  // Email-code sign in: portal only, no staff permissions to load (/me/access).
  if (isPortalToken()) return <PortalShell>{children}</PortalShell>;

  return (
    <AccessProvider>
      <PortalShell>{children}</PortalShell>
    </AccessProvider>
  );
}
