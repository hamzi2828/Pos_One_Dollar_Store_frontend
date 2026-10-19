'use client';

// Stock count sheet / correction: scan items, type the counted qty (or the
// pieces to add/remove), see the difference, save as draft or apply now.

import { useRef, useState } from 'react';
import { ClipboardList, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorBox, Field, HelpBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { storeApi, apiErrorMessage, formatRs } from '@/lib/storeApi';
import { ADJUSTMENT_REASONS, newRequestId, unitKey, unitTitle, type AdjustmentReason, type StockAdjustment } from '../../movements/_shared/stockOpsApi';
import { ProductPicker, cardClass, thClass, type PickedUnit } from '../../movements/_shared/StockOpsBits';
import { SearchSelect } from '@/components/ui/SearchSelect';

export interface SheetLine {
  unit: Pick<PickedUnit, 'productId' | 'variantId' | 'name' | 'variantLabel' | 'code' | 'available' | 'costPrice'> & { packQty?: number };
  value: string; // counted qty (count mode) or pieces to add/remove (qty mode)
}

export interface SheetDraft {
  id: string | null; // editing a saved draft
  reason: AdjustmentReason;
  notes: string;
  lines: SheetLine[];
}

export const emptySheet = (): SheetDraft => ({ id: null, reason: 'count_correction', notes: '', lines: [] });

/** Draft from the API -> editable sheet (system qty as saved). */
export const sheetFromAdjustment = (a: StockAdjustment): SheetDraft => ({
  id: a._id,
  reason: a.reason,
  notes: a.notes,
  lines: a.lines.map((l) => ({
    unit: { productId: l.product, variantId: l.variantId, name: l.productName, variantLabel: l.variantLabel, code: l.code, available: l.systemQty, costPrice: l.unitCost },
    value: a.reason === 'count_correction' ? String(l.countedQty ?? '') : String(a.reason === 'lost' ? -l.diff : l.diff),
  })),
});

const toInt = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));

export default function CountSheet({ sheet, setSheet, onSaved }: { sheet: SheetDraft; setSheet: (s: SheetDraft) => void; onSaved: (a: StockAdjustment) => void }) {
  const [saving, setSaving] = useState<'draft' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(newRequestId());
  const countMode = sheet.reason === 'count_correction';
  const reasonInfo = ADJUSTMENT_REASONS.find((r) => r.value === sheet.reason);

  // Signed difference of a line (+ in, - out), null when not typed yet.
  const diffOf = (l: SheetLine): number | null => {
    const n = toInt(l.value);
    if (n === null) return null;
    if (countMode) return n - l.unit.available;
    if (sheet.reason === 'lost') return -Math.abs(n);
    if (sheet.reason === 'found' || sheet.reason === 'opening') return Math.abs(n);
    return n;
  };

  const add = (u: PickedUnit) => {
    setError(null);
    const step = Math.max(1, u.packQty || 1);
    const i = sheet.lines.findIndex((l) => unitKey(l.unit) === unitKey(u));
    if (i >= 0) {
      // Scanning again counts one more (or adds one more piece).
      const lines = sheet.lines.map((l, j) => (j === i ? { ...l, value: String((toInt(l.value) || 0) + step) } : l));
      setSheet({ ...sheet, lines });
    } else {
      setSheet({ ...sheet, lines: [...sheet.lines, { unit: u, value: countMode ? String(step) : String(step) }] });
    }
  };

  const setValue = (i: number, value: string) => setSheet({ ...sheet, lines: sheet.lines.map((l, j) => (j === i ? { ...l, value } : l)) });

  let piecesIn = 0;
  let piecesOut = 0;
  let valueIn = 0;
  let valueOut = 0;
  for (const l of sheet.lines) {
    const d = diffOf(l) || 0;
    if (d > 0) {
      piecesIn += d;
      valueIn += d * (l.unit.costPrice || 0);
    } else if (d < 0) {
      piecesOut += -d;
      valueOut += -d * (l.unit.costPrice || 0);
    }
  }

  const save = async (apply: boolean) => {
    if (saving) return;
    if (!sheet.lines.length) return setError('Scan at least one item');
    const missing = sheet.lines.find((l) => toInt(l.value) === null || (!countMode && toInt(l.value) === 0));
    if (missing) return setError(`Enter a number for ${unitTitle(missing.unit)}`);
    if (countMode && sheet.lines.some((l) => (toInt(l.value) ?? 0) < 0)) return setError('Counted qty cannot be negative');
    if (apply && !window.confirm(`Apply now? Stock changes: +${piecesIn} / −${piecesOut} pieces.`)) return;
    setSaving(apply ? 'apply' : 'draft');
    setError(null);
    const body = {
      reason: sheet.reason,
      notes: sheet.notes,
      apply,
      lines: sheet.lines.map((l) =>
        countMode
          ? { productId: l.unit.productId, variantId: l.unit.variantId, countedQty: toInt(l.value) }
          : { productId: l.unit.productId, variantId: l.unit.variantId, diff: diffOf(l) }
      ),
      requestId: sheet.id ? undefined : requestId.current,
    };
    try {
      const res = sheet.id ? await storeApi.put<StockAdjustment>(`/stock-adjustments/${sheet.id}`, body) : await storeApi.post<StockAdjustment>('/stock-adjustments', body);
      toast.success(res.message || (apply ? 'Applied' : 'Saved'));
      requestId.current = newRequestId();
      onSaved(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the sheet.'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardClass} p-3 sm:p-4`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Reason" hint={reasonInfo?.hint}>
            <SearchSelect
              value={sheet.reason}
              onChange={(e) => setSheet({ ...sheet, reason: e.target.value as AdjustmentReason, lines: sheet.lines.map((l) => ({ ...l, value: '' })) })}
              disabled={!!saving}
              className={inputClass}
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </SearchSelect>
          </Field>
          <div className="md:col-span-2">
            <Field label="Add items" hint={countMode ? 'Scan every piece you count — each scan adds 1 — or type the count.' : 'Scan or type a name.'}>
              <ProductPicker onPick={add} autoFocus disabled={!!saving} />
            </Field>
          </div>
        </div>
        {sheet.id && <p className="mt-2 text-xs text-blue-700">Editing a saved draft. System qty is read again when you save.</p>}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass}>Item</th>
                <th className={`${thClass} text-right`}>System</th>
                <th className={`${thClass} text-right`}>{countMode ? 'Counted' : sheet.reason === 'lost' ? 'Remove' : sheet.reason === 'other' ? '+ / −' : 'Add'}</th>
                <th className={`${thClass} text-right`}>Difference</th>
                <th className={`${thClass} text-right`}>Value</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sheet.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    Scan items to start the sheet.
                  </td>
                </tr>
              ) : (
                sheet.lines.map((l, i) => {
                  const d = diffOf(l);
                  return (
                    <tr key={unitKey(l.unit)}>
                      <td className="px-3 sm:px-4 py-2 text-sm">
                        <div className="font-medium text-gray-900 max-w-[240px] truncate">{unitTitle(l.unit)}</div>
                        <div className="text-[11px] text-gray-500 font-mono">{l.unit.code}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-right text-sm text-gray-700">{l.unit.available}</td>
                      <td className="px-3 sm:px-4 py-2 text-right">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={countMode || sheet.reason !== 'other' ? 0 : undefined}
                          value={l.value}
                          onChange={(e) => setValue(i, e.target.value)}
                          disabled={!!saving}
                          className={`${inputClass} w-20 text-right px-2 inline-block`}
                          aria-label="Quantity"
                        />
                      </td>
                      <td className={`px-3 sm:px-4 py-2 text-right text-sm font-semibold ${d === null ? 'text-gray-400' : d > 0 ? 'text-green-700' : d < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {d === null ? '—' : d > 0 ? `+${d}` : d === 0 ? '0 ✓' : d}
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-right text-xs text-gray-600 whitespace-nowrap">{d ? formatRs(Math.abs(d) * (l.unit.costPrice || 0), { decimals: 2 }) : '—'}</td>
                      <td className="px-3 sm:px-4 py-2 text-right">
                        <button type="button" onClick={() => setSheet({ ...sheet, lines: sheet.lines.filter((_, j) => j !== i) })} disabled={!!saving} className="p-1.5 text-gray-400 hover:text-red-600" aria-label="Remove line">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${cardClass} p-3 sm:p-4 space-y-3`}>
        <Field label="Notes">
          <input type="text" value={sheet.notes} onChange={(e) => setSheet({ ...sheet, notes: e.target.value })} maxLength={1000} placeholder="e.g. Monthly count, rack A" className={inputClass} disabled={!!saving} />
        </Field>
        <HelpBox>
          Stock in: <strong className="text-green-700">+{piecesIn}</strong> pcs ({formatRs(valueIn, { decimals: 2 })}) · Stock out: <strong className="text-red-600">−{piecesOut}</strong> pcs (
          {formatRs(valueOut, { decimals: 2 })}) at average cost. The server reads the system qty again when you save.
        </HelpBox>
        <ErrorBox message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          {(sheet.id || sheet.lines.length > 0) && (
            <button type="button" onClick={() => setSheet(emptySheet())} disabled={!!saving} className={secondaryBtn}>
              Clear
            </button>
          )}
          <button type="button" onClick={() => save(false)} disabled={!!saving || !sheet.lines.length} className={secondaryBtn}>
            {saving === 'draft' && <Loader2 className="h-4 w-4 animate-spin" />}
            Save draft
          </button>
          <button type="button" onClick={() => save(true)} disabled={!!saving || !sheet.lines.length} className={primaryBtn}>
            {saving === 'apply' && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply now
          </button>
        </div>
      </div>
    </div>
  );
}
