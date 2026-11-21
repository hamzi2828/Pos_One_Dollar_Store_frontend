'use client';

// Activity Log -> Data Changes: every create / update / delete on any record,
// with the values before and after and who did it (backend: /admin/change-logs).
import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { getAuthHeader } from '@/helper/helper';
import { SearchSelect } from '@/components/ui/SearchSelect';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface Change { path: string; from: unknown; to: unknown }
interface ChangeLog {
  _id: string;
  model: string;
  docId: string | null;
  operation: 'create' | 'update' | 'delete';
  op: string | null;
  changedFields?: string[];
  changes: Change[] | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  filter?: string | null;
  update?: string | null;
  truncated?: boolean;
  source: string;
  actorName: string | null;
  actorEmail: string | null;
  actorKind: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  method: string | null;
  path: string | null;
  requestId: string | null;
  createdAt: string;
}

const OP_STYLE: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
};

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function Value({ v, tone }: { v: unknown; tone: 'from' | 'to' }) {
  const text = show(v);
  const cls = tone === 'from' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800';
  return (
    <pre className={`whitespace-pre-wrap break-all text-[11px] leading-snug rounded px-1.5 py-1 max-h-48 overflow-auto ${text === '—' ? 'text-gray-400' : cls}`}>
      {text}
    </pre>
  );
}

function Detail({ id }: { id: string }) {
  const [row, setRow] = useState<ChangeLog | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let off = false;
    fetch(`${API}/admin/change-logs/${id}`, { headers: getAuthHeader() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load'))))
      .then((j) => { if (!off) setRow(j.data); })
      .catch((e) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [id]);

  if (err) return <p className="text-xs text-red-600 p-3">{err}</p>;
  if (!row) return <div className="p-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;

  const snapshot = row.operation === 'create' ? row.after : row.operation === 'delete' ? row.before : null;
  return (
    <div className="p-3 space-y-3 bg-gray-50/60">
      {row.changes && row.changes.length > 0 && (
        <table className="w-full text-xs table-fixed">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="w-1/4 py-1 pr-2 font-medium">Field</th>
              <th className="w-[37.5%] py-1 pr-2 font-medium">Before</th>
              <th className="w-[37.5%] py-1 font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {row.changes.map((c, i) => (
              <tr key={i} className="align-top border-t border-gray-100">
                <td className="py-1 pr-2 font-mono text-[11px] text-gray-700 break-all">{c.path}</td>
                <td className="py-1 pr-2"><Value v={c.from} tone="from" /></td>
                <td className="py-1"><Value v={c.to} tone="to" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {snapshot && (
        <div>
          <p className="text-[11px] font-medium text-gray-500 mb-1">{row.operation === 'delete' ? 'Record as it was before deletion' : 'Record as created'}</p>
          <pre className="text-[11px] bg-white border border-gray-200 rounded p-2 max-h-96 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(snapshot, null, 2)}</pre>
        </div>
      )}
      {(row.filter || row.update) && (
        <div className="grid sm:grid-cols-2 gap-2">
          {row.filter && <div><p className="text-[11px] font-medium text-gray-500 mb-1">Filter</p><pre className="text-[11px] bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap break-all">{row.filter}</pre></div>}
          {row.update && <div><p className="text-[11px] font-medium text-gray-500 mb-1">Update sent</p><pre className="text-[11px] bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap break-all">{row.update}</pre></div>}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span>Call: <b className="text-gray-700">{row.op || '—'}</b></span>
        <span>Request: <b className="text-gray-700">{row.method} {row.path || '—'}</b></span>
        <span>IP: <b className="text-gray-700">{row.ipAddress || '—'}</b></span>
        {row.actorEmail && <span>Email: <b className="text-gray-700">{row.actorEmail}</b></span>}
        {row.truncated && <span className="text-amber-600">Some large values were shortened</span>}
      </div>
      {row.userAgent && <p className="text-[11px] text-gray-400 break-all">{row.userAgent}</p>}
    </div>
  );
}

export default function ChangesTab() {
  const [rows, setRows] = useState<ChangeLog[]>([]);
  const [models, setModels] = useState<Array<{ model: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const [model, setModel] = useState('');
  const [operation, setOperation] = useState('');
  const [docId, setDocId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    fetch(`${API}/admin/change-logs/models`, { headers: getAuthHeader() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setModels(j.data || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (model) params.set('model', model);
      if (operation) params.set('operation', operation);
      if (docId) params.set('docId', docId);
      if (requestId) params.set('requestId', requestId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (search) params.set('search', search);
      const res = await fetch(`${API}/admin/change-logs?${params}`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Could not load data changes');
      const json = await res.json();
      setRows(json.data || []);
      setTotal(json.pagination.total);
      setTotalPages(json.pagination.totalPages);
      setPage(json.pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load data changes');
    } finally {
      setLoading(false);
    }
  }, [model, operation, docId, requestId, from, to, search]);

  useEffect(() => { load(1); }, [load]);

  const hasFilters = model || operation || docId || requestId || from || to || searchInput;
  const clearAll = () => { setModel(''); setOperation(''); setDocId(''); setRequestId(''); setFrom(''); setTo(''); setSearchInput(''); };

  const input = 'px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-400';

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search user, record id, path…" className={`${input} pl-7 w-56`} />
        </div>
        <SearchSelect value={model} onChange={(e) => setModel(e.target.value)} className={input}>
          <option value="">All records</option>
          {models.map((m) => <option key={m.model} value={m.model}>{m.model} ({m.count.toLocaleString()})</option>)}
        </SearchSelect>
        <SearchSelect value={operation} onChange={(e) => setOperation(e.target.value)} className={input}>
          <option value="">Create / edit / delete</option>
          <option value="create">Created</option>
          <option value="update">Edited</option>
          <option value="delete">Deleted</option>
        </SearchSelect>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} aria-label="From" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} aria-label="To" />
        {docId && (
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-1">
            Record {docId.slice(-6)} <button onClick={() => setDocId('')} aria-label="Clear record filter"><X className="w-3 h-3" /></button>
          </span>
        )}
        {requestId && (
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-1">
            One request <button onClick={() => setRequestId('')} aria-label="Clear request filter"><X className="w-3 h-3" /></button>
          </span>
        )}
        {hasFilters && <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-800 underline">Clear</button>}
        <button
          onClick={() => load(page)}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {total.toLocaleString()} changes · click a row to see before / after · click a record id to see its full history
      </p>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr className="text-left">
              <th className="w-6" />
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Who</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Record</th>
              <th className="px-3 py-2 font-medium">What changed</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 inline" /></td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">No changes found</td></tr>
            )}
            {rows.map((r) => {
              const isOpen = open === r._id;
              const fields = r.changes && r.changes.length
                ? r.changes.map((c) => c.path).join(', ')
                : r.operation === 'create' ? 'New record' : r.operation === 'delete' ? 'Record removed' : (r.changedFields || []).join(', ');
              return (
                <Fragment key={r._id}>
                  <tr className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${isOpen ? 'bg-gray-50' : ''}`} onClick={() => setOpen(isOpen ? null : r._id)}>
                    <td className="pl-2 text-gray-400">{isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {when(r.createdAt)}
                      {r.requestId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRequestId(r.requestId as string); }}
                          className="block text-[10px] text-gray-400 hover:text-gray-700 underline"
                          title="Show every change made by this same request"
                        >same request</button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-800">{r.actorName || (r.source === 'system' ? 'System' : 'Unknown')}</span>
                      {r.actorKind === 'portal' && <span className="ml-1 text-[10px] text-purple-600">portal</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-medium capitalize ${OP_STYLE[r.operation] || ''}`}>
                        {r.operation === 'update' ? 'edited' : r.operation === 'create' ? 'created' : 'deleted'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-800">{r.model}</span>
                      {r.docId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDocId(r.docId as string); }}
                          className="ml-1 font-mono text-[11px] text-blue-600 hover:underline"
                          title="Show the full history of this record"
                        >…{r.docId.slice(-8)}</button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[320px] truncate" title={fields}>{fields || '—'}</td>
                  </tr>
                  {isOpen && (
                    <tr><td colSpan={6} className="border-t border-gray-100 p-0"><Detail id={r._id} /></td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-3">
          <button disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="p-1.5 border border-gray-200 rounded-lg bg-white disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages || loading} onClick={() => load(page + 1)} className="p-1.5 border border-gray-200 rounded-lg bg-white disabled:opacity-40" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </>
  );
}
