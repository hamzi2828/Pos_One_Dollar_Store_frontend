'use client';

// WhatsApp group receipt slips: gateway settings (token never shown), a test
// message and the send log (outbox) with retry.

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageCircle, Send, Loader2, RefreshCw, RotateCcw, Save, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { storeApi, apiErrorMessage, formatDate, type PageMeta } from '@/lib/storeApi';
import { useAccess } from '@/context/AccessContext';
import { Field, Toggle, ErrorBox, HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SearchSelect } from '@/components/ui/SearchSelect';

type Provider = 'ultramsg' | 'greenapi' | 'webhook';

interface WaSettings {
  enabled: boolean;
  provider: Provider;
  instanceId: string;
  token: string; // masked
  hasToken: boolean;
  apiUrl: string;
  groupId: string;
  sendOn: { sale: boolean; payment: boolean };
  header: string;
  footer: string;
}

interface OutboxRow {
  _id: string;
  to: string;
  body: string;
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  lastError: string;
  refType: string;
  refNo: string;
  event: string;
  provider: string;
  sentAt: string | null;
  createdAt: string;
}

const PROVIDERS: { value: Provider; label: string; help: string }[] = [
  {
    value: 'ultramsg',
    label: 'UltraMsg',
    help: 'ultramsg.com: scan the QR with the shop phone, then copy the Instance ID (e.g. instance12345) and Token.',
  },
  {
    value: 'greenapi',
    label: 'Green API',
    help: 'green-api.com: copy idInstance and apiTokenInstance. Set the API URL if your account shows its own host.',
  },
  {
    value: 'webhook',
    label: 'Own webhook',
    help: 'We POST JSON { to, body, meta } to your URL (token is sent as "Authorization: Bearer"). Any 2xx = sent.',
  },
];

const STATUS_BADGE = {
  sent: { cls: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { cls: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="h-3 w-3" /> },
  queued: { cls: 'bg-gray-50 text-gray-600 border-gray-200', icon: <Clock className="h-3 w-3" /> },
};

export default function WhatsAppPage() {
  const { can, loaded } = useAccess();
  const canView = can('whatsapp', 'view');

  if (!loaded) return <div className="max-w-6xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>;
  if (!canView) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">WhatsApp Slips</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">Every sale / payment slip is posted to your WhatsApp group automatically.</p>
        </div>
        <SettingsCard />
        <OutboxCard />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings + test                                                     */
/* ------------------------------------------------------------------ */

function SettingsCard() {
  const { can } = useAccess();
  const canEdit = can('whatsapp', 'edit');
  const [form, setForm] = useState<WaSettings | null>(null);
  const [newToken, setNewToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const lockRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await storeApi.get<WaSettings>('/whatsapp/settings');
      setForm(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load WhatsApp settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !form) return <LoadingCard text="Loading settings…" />;
  if (error && !form) return <ErrorBox message={error} />;
  if (!form) return null;

  const set = <K extends keyof WaSettings>(k: K, v: WaSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const provider = PROVIDERS.find((p) => p.value === form.provider) || PROVIDERS[0];

  const save = async () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await storeApi.put<WaSettings>('/whatsapp/settings', {
        enabled: form.enabled,
        provider: form.provider,
        instanceId: form.instanceId,
        apiUrl: form.apiUrl,
        groupId: form.groupId,
        sendOn: form.sendOn,
        header: form.header,
        footer: form.footer,
        ...(newToken.trim() ? { token: newToken.trim() } : {}),
      });
      setForm(res.data);
      setNewToken('');
      toast.success('WhatsApp settings saved');
    } catch (e) {
      setSaveError(apiErrorMessage(e, 'Could not save.'));
    } finally {
      lockRef.current = false;
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      await storeApi.post('/whatsapp/test', { to: testTo.trim() || undefined });
      toast.success('Test message sent. Check the WhatsApp group.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Test message failed.'), { duration: 7000 });
    } finally {
      setTesting(false);
    }
  };

  const disabled = !canEdit || saving;

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-50 text-green-600">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Gateway</h2>
          <p className="text-xs text-gray-500">{form.enabled ? 'Slips are being sent.' : 'Switched off — no slips are sent.'}</p>
        </div>
      </div>

      <HelpBox>
        The official WhatsApp Cloud API (Meta) <strong>cannot post into groups</strong>. Use a gateway that links the shop’s WhatsApp
        number (UltraMsg or Green API), or your own webhook. Group ID looks like <code>120363012345678901@g.us</code>.
      </HelpBox>

      <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Send slips to WhatsApp" disabled={disabled} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Field label="Provider" hint={provider.help}>
          <SearchSelect value={form.provider} onChange={(e) => set('provider', e.target.value as Provider)} className={inputClass} disabled={disabled}>
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label={form.provider === 'webhook' ? 'Webhook URL' : 'API URL (optional)'} required={form.provider === 'webhook'}>
          <input
            value={form.apiUrl}
            onChange={(e) => set('apiUrl', e.target.value)}
            className={inputClass}
            disabled={disabled}
            placeholder={form.provider === 'webhook' ? 'https://example.com/whatsapp' : form.provider === 'greenapi' ? 'https://api.green-api.com' : 'https://api.ultramsg.com'}
          />
        </Field>
        {form.provider !== 'webhook' && (
          <Field label="Instance ID" required>
            <input value={form.instanceId} onChange={(e) => set('instanceId', e.target.value)} className={inputClass} disabled={disabled} placeholder="instance12345" />
          </Field>
        )}
        <Field
          label={form.provider === 'webhook' ? 'Secret (optional)' : 'API token'}
          required={form.provider !== 'webhook'}
          hint={form.hasToken ? `Saved (${form.token}). Leave empty to keep it.` : 'Not saved yet.'}
        >
          <input
            type="password"
            autoComplete="new-password"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            className={inputClass}
            disabled={disabled}
            placeholder={form.hasToken ? '•••••••• (unchanged)' : 'Paste the token'}
          />
        </Field>
        <Field label="WhatsApp group ID" required>
          <input value={form.groupId} onChange={(e) => set('groupId', e.target.value)} className={inputClass} disabled={disabled} placeholder="120363012345678901@g.us" />
        </Field>
        <div className="flex flex-col gap-2 justify-end">
          <Toggle
            checked={form.sendOn.sale}
            onChange={(v) => set('sendOn', { ...form.sendOn, sale: v })}
            label="Send on every sale"
            disabled={disabled}
          />
          <Toggle
            checked={form.sendOn.payment}
            onChange={(v) => set('sendOn', { ...form.sendOn, payment: v })}
            label="Send when a credit bill is paid"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Field label="Header lines" hint="Under the shop name, e.g. address / phone.">
          <textarea value={form.header} onChange={(e) => set('header', e.target.value)} rows={2} maxLength={500} className={inputClass} disabled={disabled} />
        </Field>
        <Field label="Footer lines">
          <textarea value={form.footer} onChange={(e) => set('footer', e.target.value)} rows={2} maxLength={500} className={inputClass} disabled={disabled} />
        </Field>
      </div>

      <ErrorBox message={saveError} />

      {canEdit && (
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2 border-t border-gray-100">
          <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <Field label="Send a test to" hint="Uses the saved settings. Empty = the group above.">
                <input value={testTo} onChange={(e) => setTestTo(e.target.value)} className={inputClass} placeholder={form.groupId || '1203630…@g.us'} disabled={testing} />
              </Field>
            </div>
            <button type="button" onClick={sendTest} disabled={testing || saving} className={`${secondaryBtn} sm:mb-[18px]`}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test
            </button>
          </div>
          <button type="button" onClick={save} disabled={saving} className={`${primaryBtn} sm:mb-[18px]`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Outbox (send log)                                                   */
/* ------------------------------------------------------------------ */

function OutboxCard() {
  const { can } = useAccess();
  const canEdit = can('whatsapp', 'edit');
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { counts?: Record<string, number> }) | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await storeApi.get<OutboxRow[]>('/whatsapp/outbox', { status, search: query, page, limit: 25 });
      setRows(res.data || []);
      setMeta((res.meta as PageMeta & { counts?: Record<string, number> }) || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the send log.'));
    } finally {
      setLoading(false);
    }
  }, [status, query, page]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = async (row: OutboxRow) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusyId(row._id);
    try {
      await storeApi.post(`/whatsapp/outbox/${row._id}/retry`);
      toast.success('Sent');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Still failing.'));
    } finally {
      lockRef.current = false;
      setBusyId(null);
      load();
    }
  };

  const retryAll = async () => {
    if (retryingAll) return;
    setRetryingAll(true);
    try {
      const res = await storeApi.post<{ tried: number; sent: number }>('/whatsapp/outbox/retry-failed');
      toast.success(res.message || 'Retried');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not retry.'));
    } finally {
      setRetryingAll(false);
      load();
    }
  };

  const counts = meta?.counts || {};

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-900">Send log</h2>
          <p className="text-[11px] text-gray-500">
            {counts.sent || 0} sent · {counts.failed || 0} failed · {counts.queued || 0} queued. Failed slips are retried automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SearchSelect
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg"
            aria-label="Status"
          >
            <option value="">All</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="queued">Queued</option>
          </SearchSelect>
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Bill no…"
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg w-32"
          />
          <button type="button" onClick={load} disabled={loading} className={`${secondaryBtn} !px-2.5 !py-1.5`} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canEdit && (
            <button type="button" onClick={retryAll} disabled={retryingAll || !counts.failed} className={`${secondaryBtn} !px-3 !py-1.5`}>
              {retryingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Retry failed
            </button>
          )}
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-10 text-center">
          <Loader2 className="h-6 w-6 text-honey-700 animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="py-8 px-4 text-center text-sm text-red-700">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-400" />
          {error}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">No messages yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((r) => {
            const badge = STATUS_BADGE[r.status] || STATUS_BADGE.queued;
            return (
              <div key={r._id} className="px-4 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border rounded-full capitalize ${badge.cls}`}>
                    {badge.icon}
                    {r.status}
                  </span>
                  <span className="font-medium text-gray-900">{r.refType === 'test' ? 'Test message' : r.refNo || '—'}</span>
                  {r.event && r.refType !== 'test' && <span className="text-xs text-gray-500 capitalize">{r.event}</span>}
                  <span className="text-xs text-gray-400">{formatDate(r.createdAt, true)}</span>
                  <span className="text-xs text-gray-400">
                    {r.attempts} attempt{r.attempts === 1 ? '' : 's'}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <button type="button" onClick={() => setExpanded(expanded === r._id ? null : r._id)} className="text-xs text-gray-500 hover:text-gray-800 underline">
                      {expanded === r._id ? 'Hide' : 'View'}
                    </button>
                    {canEdit && r.status !== 'sent' && (
                      <button type="button" onClick={() => retry(r)} disabled={busyId === r._id} className={`${secondaryBtn} !px-2.5 !py-1 text-xs`}>
                        {busyId === r._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Retry
                      </button>
                    )}
                  </span>
                </div>
                {r.status === 'failed' && r.lastError && <p className="mt-1 text-xs text-red-600 break-words">{r.lastError}</p>}
                {expanded === r._id && (
                  <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 whitespace-pre-wrap break-words font-sans">
                    To: {r.to}
                    {'\n\n'}
                    {r.body}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-600">
          <span>
            Page {page} of {meta.pages}
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading} className={`${secondaryBtn} !px-3 !py-1`}>
              Previous
            </button>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.pages || loading} className={`${secondaryBtn} !px-3 !py-1`}>
              Next
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
