'use client';

// Create / edit a vendor return (debit note). Pick the vendor, scan or search
// products, set qty + reason. Price defaults to the vendor's last price to us
// (else our cost). "Save & complete" takes the stock out and posts the debit note.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Undo2, Loader2, Check, Trash2, Save, AlertTriangle } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs } from '@/lib/storeApi';
import VendorPicker from '@/components/store/VendorPicker';
import { Modal, Field, ErrorBox, HelpBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { vendorApi, RETURN_REASONS, type LookupProduct, type LookupUnit, type ReturnReason, type VendorReturn } from '../services/vendorApi';
import ProductSearch from './ProductSearch';
import { SearchSelect } from '@/components/ui/SearchSelect';

interface Line {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  label: string;
  code: string;
  stock: number;
  isConsignment: boolean;
  defaultCost: number;
  costSource: LookupUnit['defaultCostSource'];
  shelves: LookupUnit['shelves'];
  qty: string;
  unitCost: string;
  costTouched: boolean;
  reason: ReturnReason;
  fromShelfId: string;
}

const lineKey = (productId: string, variantId: string | null) => `${productId}|${variantId || ''}`;
const COST_SOURCE: Record<string, string> = { vendor_last_price: "vendor's last price", cost_price: 'our cost', none: 'no price known' };

function toLine(p: LookupProduct, u: LookupUnit, extra: Partial<Line> = {}): Line {
  return {
    key: `${lineKey(p._id, u.variantId)}|${Math.random().toString(36).slice(2, 7)}`,
    productId: p._id,
    variantId: u.variantId,
    name: p.name,
    label: u.label,
    code: u.code,
    stock: u.stock,
    isConsignment: p.isConsignment,
    defaultCost: u.defaultUnitCost,
    costSource: u.defaultCostSource,
    shelves: u.shelves,
    qty: '1',
    unitCost: String(u.defaultUnitCost),
    costTouched: false,
    reason: 'slow_moving',
    fromShelfId: '',
    ...extra,
  };
}

export default function ReturnFormModal({
  draft,
  prefill,
  onClose,
  onSaved,
}: {
  draft?: VendorReturn | null;
  prefill?: { vendorId?: string | null; productId?: string | null; variantId?: string | null; qty?: number | null };
  onClose: () => void;
  onSaved: (r: VendorReturn) => void;
}) {
  const { can } = useAccess();
  const [vendorId, setVendorId] = useState<string | null>(draft?.vendor ?? prefill?.vendorId ?? null);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState(draft?.notes ?? '');
  const [savedId, setSavedId] = useState<string | null>(draft?._id ?? null);
  const [loadingLines, setLoadingLines] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  // Load the draft's lines or the prefilled product (slow-moving report link).
  useEffect(() => {
    const ids = draft ? [...new Set(draft.lines.map((l) => l.product))] : prefill?.productId ? [prefill.productId] : [];
    if (!ids.length) return;
    let alive = true;
    setLoadingLines(true);
    vendorApi
      .searchProducts({ productId: ids.join(','), vendorId: draft?.vendor ?? prefill?.vendorId ?? undefined, limit: 50 })
      .then((found) => {
        if (!alive) return;
        const byId = new Map(found.map((p) => [p._id, p]));
        if (draft) {
          setLines(
            draft.lines
              .map((l) => {
                const p = byId.get(l.product);
                const u = p?.units.find((x) => x.variantId === (l.variantId || null));
                if (!p || !u) return null;
                return toLine(p, u, { qty: String(l.qty), unitCost: String(l.unitCost), costTouched: true, reason: l.reason });
              })
              .filter((x): x is Line => !!x),
          );
        } else {
          const p = byId.get(prefill!.productId!);
          const u = p?.units.find((x) => x.variantId === (prefill?.variantId || null)) || (p && p.units.length === 1 ? p.units[0] : null);
          if (p && u) {
            const want = Math.max(1, Math.floor(Number(prefill?.qty) || 1));
            setLines([toLine(p, u, { qty: String(Math.min(want, Math.max(1, u.stock))) })]);
          } else if (p) setError('Choose the variant to return below.');
        }
      })
      .catch((e) => alive && setError(apiErrorMessage(e, 'Could not load the products.')))
      .finally(() => alive && setLoadingLines(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vendor changed: refresh default prices of lines the user did not price by hand.
  const prevVendor = useRef(vendorId);
  useEffect(() => {
    if (prevVendor.current === vendorId) return;
    prevVendor.current = vendorId;
    const ids = [...new Set(lines.map((l) => l.productId))];
    if (!ids.length) return;
    vendorApi
      .searchProducts({ productId: ids.join(','), vendorId: vendorId || undefined, limit: 50 })
      .then((found) => {
        setLines((cur) =>
          cur.map((l) => {
            const u = found.find((p) => p._id === l.productId)?.units.find((x) => x.variantId === l.variantId);
            if (!u) return l;
            return { ...l, defaultCost: u.defaultUnitCost, costSource: u.defaultCostSource, unitCost: l.costTouched ? l.unitCost : String(u.defaultUnitCost) };
          }),
        );
      })
      .catch(() => undefined);
  }, [vendorId, lines]);

  const addProduct = (p: LookupProduct, u: LookupUnit) => {
    setError(null);
    const existing = lines.find((l) => l.productId === p._id && l.variantId === u.variantId);
    if (existing) {
      setLines(lines.map((l) => (l === existing ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l)));
      return;
    }
    setLines([...lines, toLine(p, u)]);
  };

  const update = (key: string, patch: Partial<Line>) => setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const preview = useMemo(() => {
    let qty = 0;
    let total = 0;
    for (const l of lines) {
      const q = Math.max(0, Math.floor(Number(l.qty) || 0));
      const c = Math.max(0, Number(l.unitCost) || 0);
      qty += q;
      total += Math.round(q * c * 100) / 100;
    }
    return { qty, total: Math.round(total * 100) / 100 };
  }, [lines]);

  const problems = lines.filter((l) => (Number(l.qty) || 0) > l.stock);
  const consignmentLine = lines.find((l) => l.isConsignment);

  const save = async (complete: boolean) => {
    if (lock.current) return;
    if (!vendorId) return setError('Choose the vendor.');
    if (!lines.length) return setError('Add at least one product.');
    for (const l of lines) {
      const q = Number(l.qty);
      if (!Number.isInteger(q) || q < 1) return setError(`Enter a whole quantity for ${l.name}.`);
      const c = Number(l.unitCost);
      if (l.unitCost === '' || !Number.isFinite(c) || c < 0) return setError(`Enter the price for ${l.name}.`);
    }
    lock.current = true;
    setSaving(complete ? 'complete' : 'draft');
    setError(null);
    const body = {
      vendorId,
      notes: notes.trim(),
      lines: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        qty: Number(l.qty),
        unitCost: Number(l.unitCost),
        reason: l.reason,
        fromShelfId: l.fromShelfId || null,
      })),
    };
    try {
      // Save first (so a failed completion keeps the draft), then complete.
      let id = savedId;
      let saved: VendorReturn | null = null;
      try {
        saved = id ? await vendorApi.updateReturn(id, body) : await vendorApi.createReturn(body);
        id = saved._id;
        setSavedId(id);
      } catch (e) {
        // Part of it already left stock (an earlier try): just finish it.
        const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
        if (!(complete && id && code === 'PARTLY_POSTED')) throw e;
      }
      if (complete && id) saved = await vendorApi.completeReturn(id);
      if (saved) onSaved(saved);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the return.'));
    } finally {
      lock.current = false;
      setSaving(null);
    }
  };

  const busy = !!saving;

  return (
    <Modal
      wide
      title={draft ? `Edit ${draft.returnNo}` : 'Return goods to vendor'}
      subtitle="Debit note: the vendor's bill goes down"
      icon={<Undo2 className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => save(false)} disabled={busy} aria-busy={saving === 'draft'} className={secondaryBtn}>
            {saving === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </button>
          {can('vendor_returns', 'edit') && (
            <button type="button" onClick={() => save(true)} disabled={busy || problems.length > 0} aria-busy={saving === 'complete'} className={primaryBtn}>
              {saving === 'complete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save &amp; complete
            </button>
          )}
        </>
      }
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <ErrorBox message={error} />
        {savedId && !draft && <p className="text-xs text-amber-700">Saved as a draft. Fix the problem and try again — the same return will be updated.</p>}
        <Field label="Vendor" required>
          <VendorPicker value={vendorId} onChange={(id) => setVendorId(id)} includeInactive />
        </Field>
        <Field label="Add products" hint="Scan a barcode or type a name. Stock shown is the shop's.">
          <ProductSearch vendorId={vendorId} onPick={addProduct} />
        </Field>

        {loadingLines ? (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading items…
          </p>
        ) : lines.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">No items yet.</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l) => {
              const q = Math.max(0, Math.floor(Number(l.qty) || 0));
              const amount = Math.round(q * (Number(l.unitCost) || 0) * 100) / 100;
              const tooMany = q > l.stock;
              return (
                <div key={l.key} className={`rounded-lg border p-3 ${tooMany || l.isConsignment ? 'border-red-200 bg-red-50/40' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {l.name}
                        {l.label && <span className="text-gray-500"> · {l.label}</span>}
                      </p>
                      <p className={`text-[11px] ${tooMany ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {l.code && <span className="font-mono">{l.code} · </span>}
                        {l.stock} in stock{tooMany && ' — not enough'}
                      </p>
                    </div>
                    <button type="button" onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="p-1 text-gray-400 hover:text-red-500" aria-label="Remove line">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="text-[11px] text-gray-500">
                      Qty
                      <input value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value.replace(/[^0-9]/g, '') })} className={inputClass} inputMode="numeric" />
                    </label>
                    <label className="text-[11px] text-gray-500">
                      Price / pc
                      <input
                        value={l.unitCost}
                        onChange={(e) => update(l.key, { unitCost: e.target.value.replace(/[^0-9.]/g, ''), costTouched: true })}
                        className={inputClass}
                        inputMode="decimal"
                      />
                      <span className="block text-[10px] text-gray-400 truncate">
                        {COST_SOURCE[l.costSource]}: {formatRs(l.defaultCost)}
                      </span>
                    </label>
                    <label className="text-[11px] text-gray-500">
                      Reason
                      <SearchSelect value={l.reason} onChange={(e) => update(l.key, { reason: e.target.value as ReturnReason })} className={inputClass}>
                        {RETURN_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </SearchSelect>
                    </label>
                    <div className="text-[11px] text-gray-500">
                      Line total
                      <p className="px-3 py-2 text-sm font-semibold text-gray-900 tabular-nums">{formatRs(amount)}</p>
                    </div>
                  </div>
                  {l.shelves.length > 0 && (
                    <label className="mt-2 block text-[11px] text-gray-500">
                      Take from
                      <SearchSelect value={l.fromShelfId} onChange={(e) => update(l.key, { fromShelfId: e.target.value })} className={`${inputClass} sm:w-72`}>
                        <option value="">Warehouse first (default)</option>
                        {l.shelves.map((s) => (
                          <option key={s.shelfId} value={s.shelfId}>
                            Shelf {s.code} ({s.qty} pcs)
                          </option>
                        ))}
                      </SearchSelect>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {consignmentLine && (
          <p className="flex items-start gap-1.5 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {consignmentLine.name} is consignment stock — give it back from Consignment → Vendor visit instead.
          </p>
        )}

        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="e.g. Vendor collected on 18 Oct" />
        </Field>

        <div className="flex items-center justify-between rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5">
          <span className="text-sm text-orange-900">
            Debit note · {preview.qty} pc{preview.qty === 1 ? '' : 's'}
          </span>
          <span className="text-lg font-semibold text-orange-900 tabular-nums">{formatRs(preview.total)}</span>
        </div>
        <HelpBox>Completing takes the pieces out of stock (warehouse first) and lowers what we owe this vendor by the debit-note total.</HelpBox>
      </fieldset>
    </Modal>
  );
}
