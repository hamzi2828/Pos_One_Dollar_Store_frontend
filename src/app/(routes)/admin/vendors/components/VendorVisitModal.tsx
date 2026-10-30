'use client';

// Consignment "vendor visit" in one screen, done in this order:
//   1. Settle what sold since the last visit (optionally pay now)
//   2. Give back old / unsold pieces (swap out)
//   3. Receive new pieces at the vendor's fixed rate
// Each step is saved on its own; if one fails, the steps already done stay
// done and "Save" retries only the rest.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Handshake, Loader2, Check, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs, formatDate } from '@/lib/storeApi';
import { Modal, Field, ErrorBox, LoadingCard, inputClass, primaryBtn, secondaryBtn, Toggle } from '@/components/admin/FormBits';
import MoneyInput from '@/components/ui/MoneyInput';
import {
  vendorApi,
  PAYMENT_METHODS,
  type LookupProduct,
  type LookupUnit,
  type PaymentMethod,
  type VendorStockSheet,
} from '../services/vendorApi';
import ProductSearch from './ProductSearch';
import { BalanceText } from './ui';
import { SearchSelect } from '@/components/ui/SearchSelect';

type StepState = 'todo' | 'done' | 'failed' | 'skip';

interface NewItem {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  label: string;
  rate: string;
  qty: string;
  warning: string;
}

const intOf = (s: string) => Math.max(0, Math.floor(Number(s) || 0));

export default function VendorVisitModal({ vendorId, onClose, onDone }: { vendorId: string; onClose: () => void; onDone: () => void }) {
  const { can } = useAccess();
  const canPay = can('vendor_payments', 'create');
  const [sheet, setSheet] = useState<VendorStockSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 1. settle: position id -> qty to settle
  const [settleQty, setSettleQty] = useState<Record<string, string>>({});
  const [payNow, setPayNow] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payRef, setPayRef] = useState('');
  // 2. give back: position id -> qty
  const [backQty, setBackQty] = useState<Record<string, string>>({});
  // 3. receive
  const [items, setItems] = useState<NewItem[]>([]);
  const [notes, setNotes] = useState('');

  const [steps, setSteps] = useState<{ settle: StepState; back: StepState; intake: StepState }>({ settle: 'todo', back: 'todo', intake: 'todo' });
  const [results, setResults] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const s = await vendorApi.vendorStock(vendorId);
      setSheet(s);
      setSettleQty(Object.fromEntries(s.items.filter((i) => i.unsettled > 0).map((i) => [i._id, String(i.unsettled)])));
      setBackQty({});
    } catch (e) {
      setLoadError(apiErrorMessage(e, 'Could not load the vendor stock.'));
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  const toSettle = useMemo(() => (sheet ? sheet.items.filter((i) => i.unsettled > 0) : []), [sheet]);
  const unsoldItems = useMemo(() => (sheet ? sheet.items.filter((i) => i.unsold > 0 && (i.currentStock ?? 0) > 0) : []), [sheet]);

  const settleTotal = useMemo(
    () => Math.round(toSettle.reduce((s, i) => s + Math.min(intOf(settleQty[i._id] || '0'), i.unsettled) * i.rate, 0) * 100) / 100,
    [toSettle, settleQty],
  );
  const backTotal = useMemo(() => unsoldItems.reduce((s, i) => s + intOf(backQty[i._id] || '0'), 0), [unsoldItems, backQty]);
  const intakeTotal = useMemo(() => items.reduce((s, i) => s + Math.round(intOf(i.qty) * (Number(i.rate) || 0) * 100) / 100, 0), [items]);

  const addItem = (p: LookupProduct, u: LookupUnit) => {
    setError(null);
    if (items.some((i) => i.productId === p._id && i.variantId === u.variantId)) return;
    const other = p.isConsignment && p.consignmentVendor && p.consignmentVendor !== vendorId;
    const ownStock = !p.isConsignment && u.stock > 0;
    setItems([
      ...items,
      {
        key: `${p._id}|${u.variantId || ''}`,
        productId: p._id,
        variantId: u.variantId,
        name: p.name,
        label: u.label,
        rate: String(u.vendorLastPrice ?? p.consignmentRate ?? ''),
        qty: '1',
        warning: other
          ? "Another vendor's consignment product."
          : ownStock
            ? `${u.stock} pcs of our own stock — make a separate product for the vendor's pieces.`
            : '',
      },
    ]);
  };

  const save = async () => {
    if (lock.current || !sheet) return;
    // validate
    for (const i of toSettle) {
      const q = intOf(settleQty[i._id] || '0');
      if (q > i.unsettled) return setError(`${i.productName}: only ${i.unsettled} sold pieces to settle.`);
    }
    for (const i of unsoldItems) {
      const q = intOf(backQty[i._id] || '0');
      if (q > Math.min(i.unsold, i.currentStock ?? i.unsold)) return setError(`${i.productName}: only ${Math.min(i.unsold, i.currentStock ?? 0)} pieces can go back.`);
    }
    for (const it of items) {
      if (!(Number(it.rate) > 0)) return setError(`Enter the vendor's rate for ${it.name}.`);
      if (intOf(it.qty) < 1) return setError(`Enter the quantity for ${it.name}.`);
    }
    const settleLines = toSettle
      .map((i) => ({ productId: i.product, variantId: i.variantId, soldQty: intOf(settleQty[i._id] || '0') }))
      .filter((l) => l.soldQty > 0);
    const backLines = unsoldItems.map((i) => ({ productId: i.product, variantId: i.variantId, qty: intOf(backQty[i._id] || '0') })).filter((l) => l.qty > 0);
    const intakeLines = items.map((i) => ({ productId: i.productId, variantId: i.variantId, rate: Number(i.rate), qty: intOf(i.qty) }));
    const pay = payNow && canPay && Number(payAmount) > 0 ? { amount: Number(payAmount), method: payMethod, reference: payRef.trim() } : null;
    if (pay && payMethod === 'cheque' && !pay.reference) return setError('Enter the cheque number.');
    if (!settleLines.length && !backLines.length && !intakeLines.length) return setError('Nothing to save: settle, give back or receive something.');

    lock.current = true;
    setSaving(true);
    setError(null);
    const next = { ...steps };
    const done: string[] = [...results];
    try {
      if (next.settle !== 'done') {
        if (!settleLines.length) next.settle = 'skip';
        else {
          next.settle = 'failed';
          const s = await vendorApi.settle({ vendorId, lines: settleLines, notes: notes.trim(), payNow: pay });
          next.settle = 'done';
          done.push(`${s.settlementNo}: ${s.totalQty} sold pcs = ${formatRs(s.total)} payable${s.paidAmount ? `, paid ${formatRs(s.paidAmount)}` : ''}`);
          if (s.paymentError) done.push(`Payment not saved: ${s.paymentError} — record it on Vendor Payments.`);
        }
      }
      if (next.back !== 'done') {
        if (!backLines.length) next.back = 'skip';
        else {
          next.back = 'failed';
          const r = await vendorApi.giveBack({ vendorId, items: backLines, notes: notes.trim() });
          next.back = 'done';
          done.push(`${r.consignmentNo}: ${r.totalQty} pcs given back`);
        }
      }
      if (next.intake !== 'done') {
        if (!intakeLines.length) next.intake = 'skip';
        else {
          next.intake = 'failed';
          const r = await vendorApi.intake({ vendorId, items: intakeLines, notes: notes.trim() });
          next.intake = 'done';
          done.push(`${r.consignmentNo}: ${r.totalQty} new pcs received (${formatRs(r.totalValue)} at vendor rate)`);
        }
      }
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save this step.'));
    } finally {
      setSteps(next);
      setResults(done);
      lock.current = false;
      setSaving(false);
    }
  };

  const allDone = (['settle', 'back', 'intake'] as const).every((k) => steps[k] === 'done' || steps[k] === 'skip');

  const StepIcon = ({ s }: { s: StepState }) =>
    s === 'done' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : s === 'failed' ? <AlertCircle className="h-4 w-4 text-red-500" /> : null;

  return (
    <Modal
      wide
      title="Vendor visit"
      subtitle={sheet ? sheet.vendor.name : 'Consignment'}
      icon={<Handshake className="h-5 w-5" />}
      onClose={allDone && results.length ? onDone : onClose}
      busy={saving}
      footer={
        allDone && results.length ? (
          <button type="button" onClick={onDone} className={primaryBtn}>
            <Check className="h-4 w-4" /> Done
          </button>
        ) : (
          <>
            <button type="button" onClick={results.length ? onDone : onClose} disabled={saving} className={secondaryBtn}>
              {results.length ? 'Close' : 'Cancel'}
            </button>
            {can('consignment', 'create') && (
              <button type="button" onClick={save} disabled={saving || loading || !sheet} aria-busy={saving} className={primaryBtn}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {results.length ? 'Retry remaining' : 'Save visit'}
              </button>
            )}
          </>
        )
      }
    >
      {loading ? (
        <LoadingCard text="Loading vendor stock…" />
      ) : loadError ? (
        <div className="space-y-3">
          <ErrorBox message={loadError} />
          <button type="button" onClick={load} className={secondaryBtn}>
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : sheet ? (
        <fieldset disabled={saving || (allDone && results.length > 0)} className="min-w-0 space-y-5">
          <ErrorBox message={error} />
          {results.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800 space-y-0.5">
              {results.map((r) => (
                <p key={r}>✓ {r}</p>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2">
              <p className="text-[10px] uppercase text-gray-500">In shop (unsold)</p>
              <p className="text-sm font-semibold">{sheet.totals.unsold} pcs</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2">
              <p className="text-[10px] uppercase text-gray-500">Sold, not settled</p>
              <p className="text-sm font-semibold">{formatRs(sheet.totals.unsettledAmount)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2">
              <p className="text-[10px] uppercase text-gray-500">Account</p>
              <BalanceText amount={sheet.vendor.balance} className="text-sm" />
            </div>
          </div>

          {/* 1. Settle */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-honey-500 text-[11px] text-gray-900">1</span>
              Settle sold pieces <StepIcon s={steps.settle} />
              {sheet.lastSettlement && (
                <span className="ml-auto text-[11px] font-normal text-gray-500">
                  last {sheet.lastSettlement.settlementNo} · {formatDate(sheet.lastSettlement.createdAt)}
                </span>
              )}
            </h3>
            {toSettle.length === 0 ? (
              <p className="text-xs text-gray-500">Nothing sold since the last settlement.</p>
            ) : (
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                {toSettle.map((i) => (
                  <div key={i._id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {i.productName}
                        {i.variantLabel && <span className="text-gray-500"> · {i.variantLabel}</span>}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {i.unsettled} sold since last visit · rate {formatRs(i.rate)}
                      </p>
                    </div>
                    <input
                      value={settleQty[i._id] ?? ''}
                      onChange={(e) => setSettleQty({ ...settleQty, [i._id]: e.target.value.replace(/[^0-9]/g, '') })}
                      className={`${inputClass} !w-16 text-right`}
                      inputMode="numeric"
                      aria-label={`Settle qty ${i.productName}`}
                    />
                    <span className="w-24 text-right tabular-nums text-gray-900">{formatRs(Math.min(intOf(settleQty[i._id] || '0'), i.unsettled) * i.rate)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-purple-50 text-sm font-semibold text-purple-900">
                  <span>Now payable to vendor</span>
                  <span className="tabular-nums">{formatRs(settleTotal)}</span>
                </div>
              </div>
            )}
            {toSettle.length > 0 && canPay && steps.settle !== 'done' && (
              <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                <Toggle
                  checked={payNow}
                  onChange={(v) => {
                    setPayNow(v);
                    if (v && !payAmount) setPayAmount(String(settleTotal));
                  }}
                  label="Pay the vendor now"
                  hint="Records a vendor payment right away."
                />
                {payNow && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Field label="Amount (Rs)">
                      <MoneyInput value={payAmount} onValue={setPayAmount} className={inputClass} />
                    </Field>
                    <Field label="Method">
                      <SearchSelect value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className={inputClass}>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </SearchSelect>
                    </Field>
                    <Field label={payMethod === 'cheque' ? 'Cheque no.' : 'Reference'} required={payMethod === 'cheque'}>
                      <input value={payRef} onChange={(e) => setPayRef(e.target.value)} className={inputClass} />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 2. Give back */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-honey-500 text-[11px] text-gray-900">2</span>
              Give back old pieces (swap) <StepIcon s={steps.back} />
            </h3>
            {unsoldItems.length === 0 ? (
              <p className="text-xs text-gray-500">No unsold pieces of this vendor in the shop.</p>
            ) : (
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                {unsoldItems.map((i) => {
                  const max = Math.min(i.unsold, i.currentStock ?? i.unsold);
                  return (
                    <div key={i._id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">
                          {i.productName}
                          {i.variantLabel && <span className="text-gray-500"> · {i.variantLabel}</span>}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {i.unsold} unsold · {i.currentStock ?? '?'} in stock · since {formatDate(i.firstIntakeAt)} · sold {i.sold} of {i.placed}
                        </p>
                      </div>
                      <button type="button" onClick={() => setBackQty({ ...backQty, [i._id]: String(max) })} className="text-[11px] text-honey-700 hover:underline">
                        All {max}
                      </button>
                      <input
                        value={backQty[i._id] ?? ''}
                        onChange={(e) => setBackQty({ ...backQty, [i._id]: e.target.value.replace(/[^0-9]/g, '') })}
                        placeholder="0"
                        className={`${inputClass} !w-16 text-right`}
                        inputMode="numeric"
                        aria-label={`Give back qty ${i.productName}`}
                      />
                    </div>
                  );
                })}
                {backTotal > 0 && <p className="px-3 py-2 text-xs text-orange-800 bg-orange-50">{backTotal} pcs go back to the vendor (no debit note — they were never billed).</p>}
              </div>
            )}
          </section>

          {/* 3. Receive */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-honey-500 text-[11px] text-gray-900">3</span>
              Receive new pieces <StepIcon s={steps.intake} />
            </h3>
            {steps.intake !== 'done' && (
              <>
                <ProductSearch vendorId={vendorId} onPick={addItem} placeholder="Search or scan the vendor's product…" />
                <p className="text-[11px] text-gray-500">
                  New design? Create it first on{' '}
                  <Link href="/admin/products/create" target="_blank" className="underline">
                    Products → Add
                  </Link>{' '}
                  with stock 0, then pick it here. No payable now — we pay only for what sells.
                </p>
              </>
            )}
            {items.length > 0 && (
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                {items.map((it) => (
                  <div key={it.key} className="px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">
                          {it.name}
                          {it.label && <span className="text-gray-500"> · {it.label}</span>}
                        </p>
                        {it.warning && <p className="text-[11px] text-red-600">{it.warning}</p>}
                      </div>
                      <label className="text-[10px] text-gray-500">
                        Rate
                        <MoneyInput
                          value={it.rate}
                          onValue={(v) => setItems(items.map((x) => (x.key === it.key ? { ...x, rate: v } : x)))}
                          className={`${inputClass} !w-20 text-right`}
                        />
                      </label>
                      <label className="text-[10px] text-gray-500">
                        Qty
                        <input
                          value={it.qty}
                          onChange={(e) => setItems(items.map((x) => (x.key === it.key ? { ...x, qty: e.target.value.replace(/[^0-9]/g, '') } : x)))}
                          className={`${inputClass} !w-16 text-right`}
                          inputMode="numeric"
                        />
                      </label>
                      {steps.intake !== 'done' && (
                        <button type="button" onClick={() => setItems(items.filter((x) => x.key !== it.key))} className="mt-3 p-1 text-gray-400 hover:text-red-500" aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <p className="px-3 py-2 text-xs text-blue-800 bg-blue-50">
                  {items.reduce((s, i) => s + intOf(i.qty), 0)} pcs worth {formatRs(intakeTotal)} at the vendor&apos;s rate (stock value, not a bill).
                </p>
              </div>
            )}
          </section>

          <Field label="Visit notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="e.g. Vendor will bring winter designs next week" />
          </Field>
        </fieldset>
      ) : null}
    </Modal>
  );
}
