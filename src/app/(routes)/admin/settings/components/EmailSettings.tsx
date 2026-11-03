'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, Mail, Send, CheckCircle2, XCircle } from 'lucide-react';
import { getAuthHeader } from '@/helper/helper';

const API = process.env.NEXT_PUBLIC_BACKEND_URL;
const DEFAULT_TEST_TO = 'hamzahashmi640@gmail.com';

interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  testTo: string;
  lastTest: { at: string; ok: boolean; to: string; message: string } | null;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || `Request failed (${res.status})`);
  return json.data as T;
}

const input =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';

export default function EmailSettings() {
  const [s, setS] = useState<SmtpSettings | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);

  useEffect(() => {
    call<SmtpSettings>('GET', '/settings/smtp')
      .then((d) => setS({ ...d, testTo: d.testTo || DEFAULT_TEST_TO }))
      .catch((e) => toast.error(e.message || 'Failed to load email settings'));
  }, []);

  if (!s) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading email settings…
      </div>
    );
  }

  const set = <K extends keyof SmtpSettings>(k: K, v: SmtpSettings[K]) => setS((p) => (p ? { ...p, [k]: v } : p));

  const body = () => ({
    enabled: s.enabled,
    host: s.host,
    port: Number(s.port),
    secure: s.secure,
    user: s.user,
    fromName: s.fromName,
    fromEmail: s.fromEmail,
    testTo: s.testTo,
    ...(password.trim() ? { password } : {}),
  });

  const save = async () => {
    setBusy('save');
    try {
      const d = await call<SmtpSettings>('PUT', '/settings/smtp', body());
      setS(d);
      setPassword('');
      toast.success('Email settings saved');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    try {
      // Save first so the test uses what is on screen.
      await call<SmtpSettings>('PUT', '/settings/smtp', body());
      setPassword('');
      const r = await call<{ ok: boolean; message: string; settings: SmtpSettings }>('POST', '/settings/smtp/test', { to: s.testTo });
      setS(r.settings);
      if (r.ok) toast.success(`Test email sent to ${r.settings.lastTest?.to}`);
      else toast.error(`Test failed: ${r.message}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const gmail = () => {
    setS((p) => (p ? { ...p, host: 'smtp.gmail.com', port: 587, secure: false } : p));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email (SMTP)
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            The server sends emails with these details. The password is saved encrypted and is never shown again.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input type="checkbox" className="h-4 w-4" checked={s.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          Email on
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 flex items-center gap-2 text-xs text-gray-500">
          <button type="button" onClick={gmail} className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-700">
            Use Gmail settings
          </button>
          Gmail needs an App Password (Google Account → Security → App passwords).
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">SMTP host</span>
          <input className={input} value={s.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.gmail.com" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Port</span>
            <input
              className={input}
              type="number"
              value={s.port}
              onChange={(e) => {
                const port = Number(e.target.value);
                setS((p) => (p ? { ...p, port, secure: port === 465 ? true : port === 587 ? false : p.secure } : p));
              }}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Security</span>
            <select className={input} value={s.secure ? 'ssl' : 'tls'} onChange={(e) => set('secure', e.target.value === 'ssl')}>
              <option value="tls">TLS / STARTTLS (587)</option>
              <option value="ssl">SSL (465)</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Username (email)</span>
          <input className={input} value={s.user} onChange={(e) => set('user', e.target.value)} placeholder="you@gmail.com" autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Password / App Password</span>
          <input
            className={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={s.hasPassword ? '•••••••• saved (leave empty to keep)' : '16-character app password'}
            autoComplete="new-password"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">From name</span>
          <input className={input} value={s.fromName} onChange={(e) => set('fromName', e.target.value)} placeholder="DOLLAR & Co" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">From email</span>
          <input className={input} value={s.fromEmail} onChange={(e) => set('fromEmail', e.target.value)} placeholder="Same as username if empty" />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-60"
        >
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </button>
      </div>

      <div className="border-t border-gray-200 pt-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Send a test email</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className={input} value={s.testTo} onChange={(e) => set('testTo', e.target.value)} placeholder={DEFAULT_TEST_TO} />
          <button
            onClick={test}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 disabled:opacity-60 whitespace-nowrap"
          >
            {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Save &amp; send test
          </button>
        </div>
        {s.lastTest && (
          <div
            className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
              s.lastTest.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {s.lastTest.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span className="break-all">
              Last test {new Date(s.lastTest.at).toLocaleString()}: {s.lastTest.message}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
