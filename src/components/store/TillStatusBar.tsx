'use client';

// Till status strip shown at the top of the POS screen.
// OWNER: Cash & Notifications module. USED BY: POS page, /admin/till.
//
// Contract (keep stable):
//   <TillStatusBar onStatusChange={(s) => ...} />
//   s = { open: boolean; required: boolean; sessionId: string | null; counterName: string | null }
//   - Shows "Till open · Counter 1 · since 10:02" or an "Open till" button
//     (opening float by denomination) when no session is open.
//   - When required && !open the POS should block "Complete sale".
//
// Also exported for /admin/till: tillApi, DenominationCounter, OpenTillModal,
// CloseTillModal and the till types. The cashier never sees expected cash or
// sales here: the close is a BLIND count, the admin verifies it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Banknote, Loader2, Lock, LockOpen, RefreshCw, AlertTriangle, Coins } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs } from '@/lib/storeApi';
import { Modal, Field, ErrorBox, HelpBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SearchSelect } from '@/components/ui/SearchSelect';

export interface TillStatus {
  open: boolean;
  required: boolean;
  sessionId: string | null;
  counterName: string | null;
}

export interface CashCount {
  denominations: Record<string, number>;
  total: number;
}

export type TillSessionStatus = 'open' | 'closed' | 'verified' | 'disputed';

export interface TillExpected {
  float: number;
  cashSales: number;
  cashReceivedOnCredit: number;
  cashRefunds: number;
  expectedCash: number;
  billCount: number;
}

export interface TillSession {
  _id: string;
  sessionNo: string;
  counter?: string | null;
  counterName: string;
  cashier: string;
  cashierName: string;
  status: TillSessionStatus;
  openedAt: string;
  openingFloat: CashCount | null;
  openNote?: string;
  lateOpen?: boolean;
  closedAt?: string | null;
  closingCount: CashCount | null;
  closeNote?: string;
  lateClose?: boolean;
  verifiedAt?: string | null;
  verifyNote?: string;
  // Only for till_verify viewers:
  expected?: TillExpected | null;
  variance?: number | null;
  history?: { at: string; by?: { firstName?: string; lastName?: string } | string; action: string; note?: string }[];
}

export interface TillCounterOption {
  _id: string;
  name: string;
  code: string;
  defaultFloat: number;
  openCutoff: string;
  closeCutoff: string;
  busy: boolean;
  busyBy: string;
  mine: boolean;
  allowed: boolean;
}

export interface MyTill {
  required: boolean;
  open: boolean;
  openElsewhere: boolean;
  session: TillSession | null;
  denominations: number[];
  counters: TillCounterOption[];
  canOpen: boolean;
  canClose: boolean;
}

export const tillApi = {
  my: () => storeApi.get<MyTill>('/till-sessions/my'),
  open: (body: { counterId?: string; denominations: Record<string, number>; note?: string }) =>
    storeApi.post<TillSession>('/till-sessions/open', body),
  close: (id: string, body: { denominations: Record<string, number>; note?: string }) =>
    storeApi.post<TillSession>(`/till-sessions/${id}/close`, body),
};

export const DEFAULT_DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1];

/** 10:02 (browser time). */
export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function countTotal(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((s, [v, c]) => s + Number(v) * (Number(c) || 0), 0);
}

/** Only the notes/coins with a count, as the API expects. */
export function cleanCounts(counts: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [v, c] of Object.entries(counts)) if (Number(c) > 0) out[v] = Math.floor(Number(c));
  return out;
}

/* ------------------------------------------------------------------ */
/* Denomination counter: notes / coins x count = live total            */
/* ------------------------------------------------------------------ */

export function DenominationCounter({
  denominations,
  counts,
  onChange,
  disabled,
}: {
  denominations: number[];
  counts: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled?: boolean;
}) {
  const total = countTotal(counts);
  const set = (value: number, raw: string) => {
    const n = raw === '' ? 0 : Math.max(0, Math.min(100000, Math.floor(Number(raw) || 0)));
    onChange({ ...counts, [String(value)]: n });
  };
  const notes = denominations.filter((d) => d >= 10);
  const coins = denominations.filter((d) => d < 10);

  const row = (value: number) => {
    const count = counts[String(value)] || 0;
    return (
      <div key={value} className="flex items-center gap-2">
        <span className="w-16 flex-shrink-0 text-sm font-medium text-gray-700 tabular-nums">Rs {value.toLocaleString('en-PK')}</span>
        <span className="text-gray-400 text-xs">×</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={count === 0 ? '' : count}
          placeholder="0"
          onChange={(e) => set(value, e.target.value)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`Number of Rs ${value}`}
          className={`${inputClass} !w-20 !py-1.5 text-right tabular-nums`}
        />
        <span className="ml-auto text-sm text-gray-600 tabular-nums">{count ? formatRs(value * count) : '—'}</span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5 flex items-center gap-1">
          <Banknote className="h-3.5 w-3.5" /> Notes
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">{notes.map(row)}</div>
      </div>
      {coins.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5 flex items-center gap-1">
            <Coins className="h-3.5 w-3.5" /> Coins
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">{coins.map(row)}</div>
        </div>
      )}
      <div className="flex items-center justify-between rounded-lg bg-gray-900 text-white px-4 py-2.5">
        <span className="text-sm">Total counted</span>
        <span className="text-lg font-bold tabular-nums">{formatRs(total)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Open till (float)                                                   */
/* ------------------------------------------------------------------ */

export function OpenTillModal({
  status,
  onClose,
  onOpened,
}: {
  status: MyTill;
  onClose: () => void;
  onOpened: (session: TillSession) => void;
}) {
  const choices = status.counters.filter((c) => c.allowed && !c.busy);
  const [counterId, setCounterId] = useState<string>(choices.length === 1 ? choices[0]._id : '');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const counter = status.counters.find((c) => c._id === counterId) || null;
  const total = countTotal(counts);
  const needsCounter = status.counters.length > 0;
  const denoms = status.denominations?.length ? status.denominations : DEFAULT_DENOMINATIONS;

  const submit = async () => {
    if (lockRef.current) return;
    if (needsCounter && !counterId) {
      setError('Pick the counter you are opening.');
      return;
    }
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await tillApi.open({ counterId: counterId || undefined, denominations: cleanCounts(counts), note: note.trim() || undefined });
      toast.success('Till opened');
      onOpened(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not open the till.'));
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Open till"
      subtitle="Count the change money (float) you put in the drawer"
      icon={<LockOpen className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy || (needsCounter && !choices.length)} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
            Open till · {formatRs(total)}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {needsCounter && (
          <Field label="Counter" required>
            {choices.length ? (
              <SearchSelect value={counterId} onChange={(e) => setCounterId(e.target.value)} disabled={busy} className={inputClass}>
                {choices.length > 1 && <option value="">Choose a counter…</option>}
                {status.counters.map((c) => (
                  <option key={c._id} value={c._id} disabled={!c.allowed || c.busy}>
                    {c.name}
                    {c.busy ? ` — open by ${c.busyBy}` : !c.allowed ? ' — not assigned to you' : ''}
                  </option>
                ))}
              </SearchSelect>
            ) : (
              <ErrorBox message="Every counter is busy or not assigned to you. Ask the admin." />
            )}
          </Field>
        )}
        {counter && counter.defaultFloat > 0 && (
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm bg-honey-50 border border-honey-200 rounded-lg px-3 py-2">
            <span>
              Usual float for {counter.name}: <strong>{formatRs(counter.defaultFloat)}</strong>
              {counter.openCutoff ? ` · open by ${counter.openCutoff}` : ''}
            </span>
            {total !== counter.defaultFloat && total > 0 && (
              <span className="text-amber-700 font-medium">
                {total > counter.defaultFloat ? '+' : '−'}
                {formatRs(Math.abs(total - counter.defaultFloat))}
              </span>
            )}
          </div>
        )}
        <HelpBox>The float is only for giving change. It is not counted as sales.</HelpBox>
        <DenominationCounter denominations={denoms} counts={counts} onChange={setCounts} disabled={busy} />
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={busy} className={inputClass} placeholder="e.g. float from the safe" />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Close till (blind count)                                            */
/* ------------------------------------------------------------------ */

export function CloseTillModal({
  session,
  denominations,
  onClose,
  onClosed,
  title = 'Close till',
}: {
  session: Pick<TillSession, '_id' | 'sessionNo' | 'counterName' | 'cashierName' | 'openedAt'>;
  denominations?: number[];
  onClose: () => void;
  onClosed: (session: TillSession) => void;
  title?: string;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);
  const total = countTotal(counts);
  const denoms = denominations?.length ? denominations : DEFAULT_DENOMINATIONS;

  const submit = async () => {
    if (lockRef.current) return;
    if (!window.confirm(`Submit a cash count of ${formatRs(total)}?\n\nYou cannot change it after closing.`)) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await tillApi.close(session._id, { denominations: cleanCounts(counts), note: note.trim() || undefined });
      toast.success('Till closed. The admin will verify the cash.');
      onClosed(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not close the till.'));
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      subtitle={`${session.sessionNo}${session.counterName ? ` · ${session.counterName}` : ''} · open since ${formatTime(session.openedAt)}`}
      icon={<Lock className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Close till · {formatRs(total)}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <HelpBox>
          Count <strong>all</strong> the cash in the drawer, including the opening float, and enter it note by note. The
          admin checks your count against the system.
        </HelpBox>
        <DenominationCounter denominations={denoms} counts={counts} onChange={setCounts} disabled={busy} />
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={busy} className={inputClass} placeholder="e.g. Rs 500 paid to the delivery boy" />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* POS strip                                                           */
/* ------------------------------------------------------------------ */

const REFRESH_MS = 5 * 60 * 1000;

export default function TillStatusBar({ onStatusChange }: { onStatusChange?: (status: TillStatus) => void }) {
  const [data, setData] = useState<MyTill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'open' | 'close' | null>(null);
  const callbackRef = useRef(onStatusChange);
  const lastLoadRef = useRef(0);

  useEffect(() => {
    callbackRef.current = onStatusChange;
  }, [onStatusChange]);

  const load = useCallback(async () => {
    lastLoadRef.current = Date.now();
    try {
      setError(null);
      const res = await tillApi.my();
      setData(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not check the till.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    // Coming back to the tab: refresh (at most once a minute).
    const onFocus = () => {
      if (Date.now() - lastLoadRef.current > 60 * 1000) load();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const status = useMemo<TillStatus>(
    () => ({
      open: !!data?.open,
      // Unknown (error) -> do not block on the client; the server still checks.
      required: !!data?.required,
      sessionId: data?.open && data.session ? data.session._id : null,
      counterName: data?.open && data.session ? data.session.counterName || null : null,
    }),
    [data],
  );

  // Tell the POS only when something actually changed.
  const reportedRef = useRef('');
  useEffect(() => {
    if (loading) return;
    const key = JSON.stringify(status);
    if (key === reportedRef.current) return;
    reportedRef.current = key;
    callbackRef.current?.(status);
  }, [status, loading]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking till…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg">
        <span className="text-gray-500 truncate">{error}</span>
        <button type="button" onClick={load} className="inline-flex items-center gap-1 text-honey-700 font-medium hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  // The shop does not use tills: stay out of the way.
  if (!data.open && !data.required && !data.openElsewhere && data.counters.length === 0) return null;

  const s = data.session;
  return (
    <>
      {data.open && s ? (
        <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs sm:text-sm">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <span className="min-w-0 truncate text-green-900">
            <strong>Till open</strong>
            {s.counterName ? ` · ${s.counterName}` : ''} · since {formatTime(s.openedAt)}
            {s.lateOpen ? <span className="ml-1 text-amber-700">(late)</span> : null}
          </span>
          {data.canClose && (
            <button
              type="button"
              onClick={() => setModal('close')}
              className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex-shrink-0"
            >
              <Lock className="h-3.5 w-3.5" /> Close till
            </button>
          )}
        </div>
      ) : (
        <div
          className={`flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm border ${
            data.required ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-gray-200 text-gray-600'
          }`}
        >
          {data.required ? <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" /> : <Lock className="h-4 w-4 flex-shrink-0 text-gray-400" />}
          <span className="min-w-0 truncate">
            {data.openElsewhere
              ? 'Your till is already open on another counter.'
              : data.required
                ? 'Till closed — open your till to start selling.'
                : 'No till open.'}
          </span>
          {data.canOpen && !data.openElsewhere ? (
            <button type="button" onClick={() => setModal('open')} className={`${primaryBtn} ml-auto !px-3 !py-1 !text-xs flex-shrink-0`}>
              <LockOpen className="h-3.5 w-3.5" /> Open till
            </button>
          ) : (
            !data.openElsewhere && <span className="ml-auto text-[11px] text-gray-500 flex-shrink-0">Ask the admin for Till permission</span>
          )}
        </div>
      )}

      {modal === 'open' && (
        <OpenTillModal
          status={data}
          onClose={() => setModal(null)}
          onOpened={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {modal === 'close' && s && (
        <CloseTillModal
          session={s}
          denominations={data.denominations}
          onClose={() => setModal(null)}
          onClosed={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </>
  );
}
