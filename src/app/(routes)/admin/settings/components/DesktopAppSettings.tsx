'use client';

// Desktop app page: download the counter PC app (fingerprint attendance + Sales
// button + label printing), the fingerprint reader driver, the counter PCs with
// the app version each one runs, and the one-time setup steps for a new PC.
// The installer lives in public/downloads; rebuild it with pos_desktop\build.cmd /installer
// and copy installer\Output\DollarCoPos-Setup.exe there (then update VERSION / BUILT / SIZE).
import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Fingerprint, MonitorDown, RefreshCw, ShoppingCart } from 'lucide-react';
import { storeApi } from '@/lib/storeApi';

const FILE = '/downloads/DollarCoPos-Setup.exe';
const VERSION = '1.5.0';
const BUILT = '31 Oct 2026';
const SIZE = '3.6 MB';
const DRIVER_FILE = '/downloads/SecuGen-Fingerprint-Driver.zip';
const DRIVER_SIZE = '45 MB';

interface DeviceRow {
  id: string;
  name: string;
  version: string;
  userName: string;
  lastSeenAt: string | null;
}

/** -1 / 0 / 1 for "1.4.0" vs "1.5.0". */
const compareVersion = (a: string, b: string) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
};

const seen = (iso: string | null) => {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Install the fingerprint reader driver',
    text: 'SecuGen reader: download "Fingerprint reader driver" above, unzip, run Windows\\SgDrvSetupUniversal.exe, then unplug and replug the reader. DigitalPersona reader: "One Touch for Windows runtime (64-bit)".',
  },
  { title: 'Run DollarCoPos-Setup.exe', text: 'Click through. Windows may say "Windows protected your PC": click More info → Run anyway.' },
  { title: 'Stop the PC sleeping', text: 'Settings → System → Power → Sleep when plugged in: Never.' },
  {
    title: 'Sign in once',
    text: 'Use a POS account whose role has Desktop app → Attendance and/or Sales. It stays signed in until someone presses Sign out. Settings and Enroll fingerprints need their own permission (super admin by default).',
  },
  { title: 'Name the PC', text: 'Press "PC name" in the app, e.g. "Counter 2". Internet is needed for the first sign-in; after that it also works offline.' },
];

export default function DesktopAppSettings() {
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await storeApi.get<DeviceRow[]>('/desktop/devices');
      setDevices(Array.isArray(r.data) ? r.data : []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-honey-300 bg-honey-50 p-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-honey-500 text-gray-900">
          <MonitorDown className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-gray-900">
            DollarCoPos desktop app <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-800">Latest {VERSION}</span>
          </p>
          <p className="text-xs text-gray-600">
            Version {VERSION} · built {BUILT} · {SIZE} · Windows 10 / 11 (64-bit)
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
            <span className="inline-flex items-center gap-1">
              <Fingerprint className="h-3.5 w-3.5" /> Fingerprint attendance (SecuGen or DigitalPersona) · Sticker printing on the label printer
            </span>
            <span className="inline-flex items-center gap-1">
              <ShoppingCart className="h-3.5 w-3.5" /> Sales button (signs in as the same person, works offline)
            </span>
          </p>
        </div>
        <a
          href={FILE}
          download
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Download className="h-4 w-4" /> Download installer
        </a>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
          <Fingerprint className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Fingerprint reader driver (SecuGen)</p>
          <p className="text-xs text-gray-600">
            SecuGen Universal Driver v3.0.0.3 · ZIP · {DRIVER_SIZE} · Hamster Pro 20 / HU20 / U20. Install it before the app.
          </p>
        </div>
        <a
          href={DRIVER_FILE}
          download
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Download driver (ZIP)
        </a>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Counter PCs and their app version</h3>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {devices === null ? (
          <p className="text-xs text-gray-500">Loading...</p>
        ) : devices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-xs text-gray-500">
            No counter PC has reported yet. PCs show here after they run version 1.5.0 or newer.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {devices.map((d) => {
              const old = compareVersion(d.version, VERSION) < 0;
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{d.name}</span>
                    <span className="block truncate text-[11px] text-gray-500">
                      {d.userName || '—'} · seen {seen(d.lastSeenAt)}
                    </span>
                  </span>
                  {old ? (
                    <span className="whitespace-nowrap rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{d.version} · update</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {d.version}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Set up a new PC (once)</h3>
        <ol className="space-y-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{s.title}</span>
                <span className="block text-xs text-gray-600">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-gray-500">
        Updating: download the installer and run it over the old one. The PC keeps its sign-in, settings and any attendance saved offline. Website changes
        (sales screen, products, receiving) reach the app by themselves, so no reinstall is needed for those.
      </p>
    </div>
  );
}
