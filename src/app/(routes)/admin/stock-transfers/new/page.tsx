'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Search,
  Loader2,
  Trash2,
  Package,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  ScanLine,
} from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { ErrorBox, HelpBox, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { branchService, type Branch } from '../../branches/services/branchService';
import {
  transferService,
  variantText,
  type BranchProduct,
  type BranchVariant,
  type BranchBatch,
  type CreateTransferResult,
} from '../services/transferService';
import { TransferDetailModal } from '../components/TransferBits';

interface Line {
  key: string;
  product: BranchProduct;
  variantId: string; // '' for single products
  batchNo: string; // '' = any batch (oldest first)
  quantity: number;
}

const unitOf = (p: BranchProduct, variantId: string): { stock: number; batches: BranchBatch[]; variant: BranchVariant | null } => {
  if (p.productType === 'variant') {
    const v = (p.variants || []).find((x) => x.variantId === variantId || x._id === variantId) || null;
    return { stock: Math.max(0, Number(v?.stock) || 0), batches: (v?.batches || []).filter((b) => (b.quantity || 0) > 0), variant: v };
  }
  return { stock: Math.max(0, Number(p.stock) || 0), batches: (p.batches || []).filter((b) => (b.quantity || 0) > 0), variant: null };
};

const availableFor = (line: Line) => {
  const u = unitOf(line.product, line.variantId);
  if (line.batchNo) {
    const b = u.batches.find((x) => x.batchNo === line.batchNo);
    return Math.max(0, Number(b?.quantity) || 0);
  }
  return u.stock;
};

let lineSeq = 0;

export default function NewStockTransferPage() {
  const { can, isSuperAdmin, branch: ownBranch, currentBranchId } = useAccess();
  const canCreate = can('stock_transfers', 'create');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BranchProduct[]>([]);
  const [resultsHaveStock, setResultsHaveStock] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [adding, setAdding] = useState(false);
  const searchSeq = useRef(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateTransferResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Branches: from = own (staff) or picked; to = any other active branch.
  useEffect(() => {
    branchService
      .list({ isActive: 'true' })
      .then((list) => {
        const active = list.filter((b) => b.isActive);
        setBranches(active);
        if (!isSuperAdmin) {
          setFromId(ownBranch?.id || '');
        } else {
          const start = (currentBranchId && active.find((b) => b.id === currentBranchId)) || active.find((b) => b.isMain) || active[0];
          setFromId(start?.id || '');
        }
      })
      .catch((e) => setBranchesError(apiErrorMessage(e, 'Could not load branches.')));
  }, [isSuperAdmin, ownBranch?.id, currentBranchId]);

  const fromBranch = branches.find((b) => b.id === fromId) || (ownBranch && ownBranch.id === fromId ? { ...ownBranch } : null);
  const fromName = fromBranch?.name || 'this branch';
  const toOptions = branches.filter((b) => b.id !== fromId);

  useEffect(() => {
    if (toId && toId === fromId) setToId('');
  }, [fromId, toId]);

  // Product search (stock of the FROM branch).
  useEffect(() => {
    const q = query.trim();
    if (!fromId || q.length < 2) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await transferService.searchProducts(q, fromId);
        if (seq !== searchSeq.current) return;
        setResults(res.items);
        setResultsHaveStock(res.branchStock);
        setShowResults(true);
      } catch (e) {
        if (seq === searchSeq.current) {
          setResults([]);
          toast.error(apiErrorMessage(e, 'Search failed.'));
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, fromId]);

  const changeFrom = (id: string) => {
    if (id === fromId) return;
    if (lines.length && !window.confirm('Changing the "From" branch clears the item list. Continue?')) return;
    setLines([]);
    setFromId(id);
  };

  const addLine = (product: BranchProduct, variantId?: string | null, batchNo?: string | null) => {
    let vid = '';
    if (product.productType === 'variant') {
      const vs = product.variants || [];
      vid =
        (variantId && vs.find((v) => v.variantId === variantId || v._id === variantId)?.variantId) ||
        vs.find((v) => (Number(v.stock) || 0) > 0)?.variantId ||
        vs[0]?.variantId ||
        '';
    }
    const batch = (batchNo || '').toUpperCase();
    setLines((prev) => {
      const same = prev.find((l) => l.product._id === product._id && l.variantId === vid && l.batchNo === batch);
      if (same) return prev.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key: `l${++lineSeq}`, product, variantId: vid, batchNo: batch, quantity: 1 }];
    });
  };

  const pickProduct = async (p: BranchProduct, variantId?: string | null, batchNo?: string | null) => {
    if (!fromId) return;
    try {
      setAdding(true);
      // Fresh copy with this branch's stock, variants and batches.
      const full = await transferService.getProduct(p._id, fromId);
      addLine(full || p, variantId, batchNo);
      setQuery('');
      setResults([]);
      setShowResults(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not load this product.'));
    } finally {
      setAdding(false);
    }
  };

  // Enter in the search box: try it as a scanned code first, else take the first result.
  const onSearchEnter = async () => {
    const code = query.trim();
    if (!code || !fromId) return;
    try {
      setAdding(true);
      const found = await transferService.lookupCode(code, fromId);
      if (found?.product) {
        addLine(found.product, found.match?.variantId, found.match?.batchNo);
        setQuery('');
        setResults([]);
        setShowResults(false);
        return;
      }
    } catch {
      // fall through to the search results
    } finally {
      setAdding(false);
    }
    if (results.length) pickProduct(results[0]);
  };

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const totalPieces = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0), [lines]);
  const tooMany = lines.some((l) => l.quantity > availableFor(l));

  const submit = async () => {
    setError(null);
    if (!fromId) return setError('Choose the branch to send stock from.');
    if (!toId) return setError('Choose the branch to send stock to.');
    if (fromId === toId) return setError('"From" and "To" must be different branches.');
    if (!lines.length) return setError('Add at least one product.');
    const bad = lines.find((l) => !Number.isInteger(l.quantity) || l.quantity < 1);
    if (bad) return setError(`Enter a whole number of pieces for ${bad.product.name}.`);
    const noVariant = lines.find((l) => l.product.productType === 'variant' && !l.variantId);
    if (noVariant) return setError(`Choose a variant for ${noVariant.product.name}.`);
    if (tooMany && !window.confirm(`Some quantities are more than what ${fromName} has. Those lines will fail. Send anyway?`)) return;

    try {
      setSubmitting(true);
      const res = await transferService.create({
        fromBranchId: fromId,
        toBranchId: toId,
        note: note.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.product._id,
          ...(l.variantId ? { variantId: l.variantId } : {}),
          quantity: l.quantity,
          ...(l.batchNo ? { batchNo: l.batchNo } : {}),
        })),
      });
      setResult(res);
      if (res.data?.status === 'completed') toast.success(res.message || 'Stock moved');
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the transfer.'));
    } finally {
      setSubmitting(false);
    }
  };

  const startAgain = () => {
    setResult(null);
    setLines([]);
    setNote('');
    setError(null);
  };

  if (!canCreate) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  /* ---------- result screen ---------- */
  if (result) {
    const status = result.data?.status || (result.success ? 'completed' : 'failed');
    const tone =
      status === 'completed'
        ? { box: 'border-green-200 bg-green-50', icon: <CheckCircle2 className="h-8 w-8 text-green-600" />, title: 'Stock moved' }
        : status === 'partial'
        ? { box: 'border-amber-200 bg-amber-50', icon: <AlertTriangle className="h-8 w-8 text-amber-600" />, title: 'Partly done' }
        : { box: 'border-red-200 bg-red-50', icon: <XCircle className="h-8 w-8 text-red-600" />, title: 'Nothing was moved' };
    const items = result.data?.items || [];
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className={`rounded-xl border p-5 sm:p-6 ${tone.box}`}>
            <div className="flex items-start gap-3">
              {tone.icon}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{tone.title}</h1>
                <p className="text-sm text-gray-700 mt-0.5">{result.message}</p>
                {result.data?.transferNo && (
                  <p className="text-xs text-gray-500 mt-1">
                    Transfer no: <span className="font-mono font-semibold">{result.data.transferNo}</span>
                  </p>
                )}
              </div>
            </div>
            {items.length > 0 && (
              <ul className="mt-4 divide-y divide-white/60 bg-white rounded-lg border border-gray-200">
                {items.map((i, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {i.productName}
                        {i.variantLabel ? <span className="text-gray-500"> ({i.variantLabel})</span> : null}
                      </p>
                      {i.status === 'failed' && <p className="text-xs text-red-700">{i.error}</p>}
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs font-semibold ${i.status === 'failed' ? 'text-red-600' : 'text-green-700'}`}
                    >
                      {i.status === 'failed' ? 'Not moved' : `${i.quantity} moved`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {status !== 'completed' && (
                <button type="button" onClick={() => setResult(null)} className={secondaryBtn}>
                  <ArrowLeft className="h-4 w-4" /> Back to the form
                </button>
              )}
              <button type="button" onClick={startAgain} className={primaryBtn}>
                <Plus className="h-4 w-4" /> New transfer
              </button>
              {result.data && (
                <button type="button" onClick={() => setShowDetail(true)} className={secondaryBtn}>
                  See details
                </button>
              )}
              <Link href="/admin/stock-transfers" className={secondaryBtn}>
                All transfers
              </Link>
            </div>
          </div>
        </div>
        {showDetail && result.data && <TransferDetailModal transfer={result.data} onClose={() => setShowDetail(false)} />}
      </div>
    );
  }

  /* ---------- form ---------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
          <Link href="/admin/stock-transfers" className="hover:text-honey-600 transition-colors">
            Stock Transfers
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">New</span>
        </div>

        <div className="mb-4 sm:mb-6 flex items-center gap-3">
          <Link
            href="/admin/stock-transfers"
            className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:text-honey-600 hover:bg-honey-50 border border-gray-200 bg-white transition-colors"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">New Stock Transfer</h1>
            <p className="text-xs sm:text-sm text-gray-500">Send pieces from one branch to another. The stock moves as soon as you save.</p>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <ErrorBox message={branchesError} />

          {/* Branches */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">From branch (stock goes out)</label>
                {isSuperAdmin ? (
                  <select value={fromId} onChange={(e) => changeFrom(e.target.value)} className={inputClass}>
                    <option value="">Choose…</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className={`${inputClass} flex items-center gap-2 bg-gray-50`}>
                    <Building2 className="h-4 w-4 text-honey-500" /> {ownBranch?.name || 'My branch'}
                  </div>
                )}
              </div>
              <div className="hidden md:flex items-center justify-center pb-2">
                <ArrowRight className="h-5 w-5 text-honey-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">To branch (stock comes in)</label>
                <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputClass}>
                  <option value="">Choose…</option>
                  {toOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {branches.length > 0 && toOptions.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-700">There is no other active branch to send to.</p>
                )}
              </div>
            </div>
          </div>

          {/* Product search */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Add products</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={query}
                disabled={!fromId}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSearchEnter();
                  }
                }}
                placeholder={fromId ? 'Type a product name, or scan a barcode and press Enter' : 'Choose the "From" branch first'}
                className={`${inputClass} pl-9 pr-9`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {searching || adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              </span>

              {showResults && query.trim().length >= 2 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  {results.length === 0 && !searching ? (
                    <p className="px-3 py-3 text-sm text-gray-500">No product with stock in {fromName} matches “{query.trim()}”.</p>
                  ) : (
                    results.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickProduct(p)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-honey-50 border-b border-gray-50 last:border-0"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-gray-900 truncate">{p.name}</span>
                            {p.productType === 'variant' && (
                              <span className="block text-[11px] text-gray-500">{(p.variants || []).length} variants</span>
                            )}
                          </span>
                        </span>
                        {resultsHaveStock && (
                          <span className="flex-shrink-0 text-xs text-gray-600 tabular-nums">
                            {Math.max(0, Number(p.stock) || 0)} in {fromName}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Lines */}
            {lines.length === 0 ? (
              <div className="mt-4 border border-dashed border-gray-200 rounded-lg py-8 text-center">
                <ArrowLeftRight className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No products added yet.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {lines.map((l) => {
                  const u = unitOf(l.product, l.variantId);
                  const available = availableFor(l);
                  const over = l.quantity > available;
                  return (
                    <div key={l.key} className={`rounded-lg border p-3 ${over ? 'border-red-200 bg-red-50/40' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Package className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm font-semibold text-gray-900">{l.product.name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                          className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px] gap-2">
                        {l.product.productType === 'variant' ? (
                          <select
                            value={l.variantId}
                            onChange={(e) => updateLine(l.key, { variantId: e.target.value, batchNo: '' })}
                            className={inputClass}
                            aria-label="Variant"
                          >
                            <option value="">Choose variant…</option>
                            {(l.product.variants || []).map((v) => (
                              <option key={v.variantId} value={v.variantId}>
                                {variantText(v)} — {Math.max(0, Number(v.stock) || 0)} in stock
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="hidden sm:block" />
                        )}
                        {u.batches.length > 0 ? (
                          <select
                            value={l.batchNo}
                            onChange={(e) => updateLine(l.key, { batchNo: e.target.value })}
                            className={inputClass}
                            aria-label="Batch"
                          >
                            <option value="">Any batch (oldest first)</option>
                            {u.batches.map((b) => (
                              <option key={b._id || b.batchNo} value={b.batchNo}>
                                Batch {b.batchNo} — {b.quantity} pcs
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="hidden sm:block" />
                        )}
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={Number.isFinite(l.quantity) ? l.quantity : ''}
                          onChange={(e) => updateLine(l.key, { quantity: Math.floor(Number(e.target.value)) })}
                          className={`${inputClass} text-right tabular-nums ${over ? 'border-red-300' : ''}`}
                          aria-label="Quantity"
                        />
                      </div>
                      <p className={`mt-1.5 text-xs ${over ? 'text-red-700 font-medium' : 'text-gray-500'}`}>
                        Available in {fromName}
                        {l.batchNo ? ` (batch ${l.batchNo})` : ''}: <span className="font-semibold tabular-nums">{available}</span>
                        {over ? ' — not enough stock' : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="e.g. for weekend sale"
              className={`${inputClass} resize-none`}
            />
          </div>

          <HelpBox>Stock leaves {fromName} and is added to the other branch straight away. To undo, make a transfer the other way.</HelpBox>

          <ErrorBox message={error} />

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600">
              {lines.length} product{lines.length === 1 ? '' : 's'} · <span className="font-semibold tabular-nums">{totalPieces}</span> pieces
            </p>
            <div className="flex gap-2">
              <Link href="/admin/stock-transfers" className={secondaryBtn}>
                Cancel
              </Link>
              <button type="button" onClick={submit} disabled={submitting || !lines.length} className={primaryBtn}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                {submitting ? 'Moving stock…' : 'Move Stock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
