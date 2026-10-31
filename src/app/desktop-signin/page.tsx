'use client';

// The desktop app's Sales button opens /desktop-signin#code=...&next=/admin/pos.
// The one-time code (in the # part, so it never reaches server logs) is swapped
// for the same sign-in as the login page, so the POS shows that person's
// permissions. No code, offline, or an old code: go on with the saved sign-in.
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { setRole, setToken } from '@/helper/helper';
import { accessCan, setStoredAccess, type AccessInfo } from '@/helper/access';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

/** Only a path on this site (never another host). */
const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '/admin/pos');

export default function DesktopSignIn() {
  const [note, setNote] = useState('Signing you in...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = params.get('code');
    const next = safeNext(params.get('next'));
    // Drop the code from the address bar / history straight away.
    try {
      window.history.replaceState(null, '', '/desktop-signin');
    } catch {}
    if (!code) {
      window.location.replace(next);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/public/desktop/pos-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          token?: string;
          message?: string;
          data?: { role?: 'user' | 'admin' | 'moderator' };
          access?: AccessInfo;
        };
        if (!res.ok || !body.token) throw new Error(body.message || 'Could not sign in');
        setToken(body.token);
        if (body.data?.role) setRole(body.data.role);
        setStoredAccess(body.access ?? null);
        const canPos = !body.access || accessCan(body.access, 'pos', 'view');
        window.location.replace(next.startsWith('/admin/pos') && !canPos ? '/admin' : next);
      } catch (err) {
        setNote(`${err instanceof Error ? err.message : 'Could not sign in'} Opening the POS...`);
        setTimeout(() => window.location.replace(next), 1500);
      }
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <p className="flex items-center gap-2 text-sm text-gray-700">
        <Loader2 className="h-4 w-4 animate-spin" /> {note}
      </p>
    </main>
  );
}
