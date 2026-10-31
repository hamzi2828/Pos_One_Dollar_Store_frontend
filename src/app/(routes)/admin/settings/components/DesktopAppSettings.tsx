'use client';

// Settings → Desktop app: download the counter PC app (fingerprint attendance +
// Sales button) and the one-time setup steps for a new PC.
// The installer lives in public/downloads; rebuild it with pos_desktop\build.cmd /installer
// and copy installer\Output\DollarCoPos-Setup.exe there (then update VERSION / BUILT).
import { Download, Fingerprint, MonitorDown, ShoppingCart } from 'lucide-react';

const FILE = '/downloads/DollarCoPos-Setup.exe';
const VERSION = '1.3.0';
const BUILT = '31 Oct 2026';
const SIZE = '3.6 MB';

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Install the fingerprint reader software',
    text: 'SecuGen reader: "SecuGen Windows Driver" from secugen.com/drivers. DigitalPersona reader: "One Touch for Windows runtime (64-bit)". Then plug in the reader.',
  },
  { title: 'Run DollarCoPos-Setup.exe', text: 'Click through. Windows may say "Windows protected your PC": click More info → Run anyway.' },
  { title: 'Stop the PC sleeping', text: 'Settings → System → Power → Sleep when plugged in: Never.' },
  {
    title: 'Sign in once',
    text: 'Use a manager or admin POS account. A manager role needs Desktop app → Attendance and Sales on the counter PC (View + Create). Admin has everything.',
  },
  { title: 'Name the PC', text: "In the app's Settings, e.g. \"Counter 2\". Internet is needed for the first sign-in; after that it also works offline." },
];

export default function DesktopAppSettings() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-honey-300 bg-honey-50 p-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-honey-500 text-gray-900">
          <MonitorDown className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-gray-900">DollarCoPos desktop app</p>
          <p className="text-xs text-gray-600">
            Version {VERSION} · built {BUILT} · {SIZE} · Windows 10 / 11 (64-bit)
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
            <span className="inline-flex items-center gap-1">
              <Fingerprint className="h-3.5 w-3.5" /> Fingerprint attendance (SecuGen or DigitalPersona)
            </span>
            <span className="inline-flex items-center gap-1">
              <ShoppingCart className="h-3.5 w-3.5" /> Sales button (works offline)
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
        Updating: run the new installer over the old one. The PC keeps its sign-in, settings and any attendance saved offline. Website changes
        (sales screen, products, receiving) reach the app by themselves, so no reinstall is needed for those.
      </p>
    </div>
  );
}
