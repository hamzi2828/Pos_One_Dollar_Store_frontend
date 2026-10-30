'use client';

// One asset: details, value, photos, maintenance log, sell / scrap, delete.
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Ban, Check, Edit2, Loader2, Package, RotateCcw, Trash2, UploadCloud, Wrench } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { STATUS_LABEL, STATUS_STYLE, assetApi, fileUrl, type Asset } from '../services/assetApi';
import { SearchSelect } from '@/components/ui/SearchSelect';
import MoneyInput from '@/components/ui/MoneyInput';

type Panel = null | 'maintenance' | 'dispose';

const Info = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="mt-0.5 text-sm text-gray-900 break-words">{children || <span className="text-gray-400">—</span>}</dd>
  </div>
);

export default function AssetDetailModal({
  asset: initial,
  onClose,
  onChanged,
  onEdit,
  onDeleted,
}: {
  asset: Asset;
  onClose: () => void;
  onChanged: (a: Asset) => void;
  onEdit: (a: Asset) => void;
  onDeleted: () => void;
}) {
  const { can } = useAccess();
  const canEdit = can('assets', 'edit');
  const canDelete = can('assets', 'delete');
  const [a, setA] = useState(initial);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const today = new Date().toISOString().slice(0, 10);
  const [m, setM] = useState({ date: today, cost: '', note: '', status: '' as '' | 'active' | 'maintenance' });
  const [d, setD] = useState({ type: 'sold' as 'sold' | 'disposed', date: today, amount: '', note: '' });

  const gone = a.status === 'sold' || a.status === 'disposed';

  /** One action at a time; resolves true when it worked. */
  const run = async (key: string, fn: () => Promise<Asset | void>, success: string): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(key);
    setError(null);
    try {
      const next = await fn();
      if (next) {
        setA(next);
        onChanged(next);
      }
      toast.success(success);
      setPanel(null);
      return true;
    } catch (e) {
      setError(apiErrorMessage(e, 'Something went wrong.'));
      return false;
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const saveMaintenance = () => {
    if (!m.note.trim() && !Number(m.cost)) return setError('Write what was done (and the cost, if any).');
    run(
      'maintenance',
      () => assetApi.addMaintenance(a._id, { date: m.date, cost: Number(m.cost) || 0, note: m.note.trim(), status: m.status || undefined }),
      'Maintenance added',
    ).then((ok) => ok && setM({ date: today, cost: '', note: '', status: '' }));
  };

  const saveDisposal = () => {
    if (!window.confirm(d.type === 'sold' ? `Mark "${a.name}" as sold?` : `Mark "${a.name}" as scrapped / disposed?`)) return;
    run('dispose', () => assetApi.dispose(a._id, { type: d.type, date: d.date, amount: Number(d.amount) || 0, note: d.note.trim() }), d.type === 'sold' ? 'Marked as sold' : 'Marked as disposed');
  };

  const remove = () => {
    if (!window.confirm(`Delete "${a.name}" from the register?`)) return;
    run(
      'delete',
      async () => {
        await assetApi.remove(a._id);
        onDeleted();
      },
      'Asset deleted',
    );
  };

  return (
    <Modal
      title={a.name}
      subtitle={[a.assetCode, a.category?.name].filter(Boolean).join(' · ')}
      icon={<Package className="h-5 w-5" />}
      onClose={onClose}
      busy={!!busy}
      wide
      footer={
        <>
          {canDelete && (
            <button type="button" onClick={remove} disabled={!!busy} className={`${secondaryBtn} text-red-600 hover:bg-red-50 mr-auto`}>
              {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
            </button>
          )}
          <button type="button" onClick={onClose} disabled={!!busy} className={secondaryBtn}>
            Close
          </button>
          {canEdit && (
            <button type="button" onClick={() => onEdit(a)} disabled={!!busy} className={primaryBtn}>
              <Edit2 className="h-4 w-4" /> Edit
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />

        {/* Value strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Cost', formatRs(a.totalCost), a.quantity > 1 ? `${a.quantity} × ${formatRs(a.purchasePrice)}` : ''],
            [gone ? 'Book value' : 'Value today', formatRs(a.currentValue), a.effectiveMethod === 'none' ? 'No depreciation' : `${formatRs(a.monthlyDepreciation)} / month`],
            ['Depreciated', formatRs(a.accumulatedDepreciation), a.effectiveLifeYears ? `${a.monthsUsed} of ${Math.round(a.effectiveLifeYears * 12)} months` : ''],
            ['Maintenance', formatRs(a.maintenanceCost), `${a.maintenanceLog.length} entr${a.maintenanceLog.length === 1 ? 'y' : 'ies'}`],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-lg border border-gray-200 px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">{label}</p>
              <p className="text-sm font-semibold tabular-nums text-gray-900">{value}</p>
              {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
          {a.fullyDepreciated && !gone && <span className="px-2 py-0.5 text-[11px] rounded-full bg-gray-100 text-gray-600">Fully depreciated</span>}
          {a.warrantyUntil && (
            <span className={`px-2 py-0.5 text-[11px] rounded-full ${a.warrantyActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              Warranty {a.warrantyActive ? 'until' : 'ended'} {formatDate(a.warrantyUntil)}
            </span>
          )}
        </div>

        {gone && a.disposal && (
          <div className="text-sm rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            {a.status === 'sold' ? 'Sold' : 'Disposed'} on {formatDate(a.disposal.date)} for {formatRs(a.disposal.amount)}
            {a.gainOnDisposal !== null && (
              <span className={a.gainOnDisposal >= 0 ? 'text-green-700' : 'text-red-600'}>
                {' '}
                ({a.gainOnDisposal >= 0 ? 'gain' : 'loss'} {formatRs(Math.abs(a.gainOnDisposal))})
              </span>
            )}
            {a.disposal.note ? ` — ${a.disposal.note}` : ''}
          </div>
        )}

        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Info label="Location">{a.location}</Info>
          <Info label="In the care of">{a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName || ''}`.trim() : ''}</Info>
          <Info label="Purchased">{formatDate(a.purchaseDate)}</Info>
          <Info label="Vendor">{a.vendor || a.vendorRef?.name}</Info>
          <Info label="Invoice no.">{a.invoiceNo}</Info>
          <Info label="Serial no.">{a.serialNumber && <span className="font-mono">{a.serialNumber}</span>}</Info>
          <Info label="Depreciation">{a.effectiveMethod === 'none' ? 'None' : `Straight line, ${a.effectiveLifeYears} yrs`}</Info>
          <Info label="Salvage value">{a.salvageTotal ? formatRs(a.salvageTotal) : ''}</Info>
          <Info label="Description">{a.description}</Info>
        </dl>
        {a.notes && <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg px-3 py-2">{a.notes}</p>}

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-gray-700">Photos</p>
            {canEdit && (
              <label className={`inline-flex items-center gap-1 text-xs font-medium text-honey-700 cursor-pointer ${busy === 'photos' ? 'opacity-60 pointer-events-none' : ''}`}>
                {busy === 'photos' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />} Add photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).slice(0, 5);
                    e.target.value = '';
                    if (files.length) run('photos', () => assetApi.uploadPhotos(a._id, files), 'Photos added');
                  }}
                />
              </label>
            )}
          </div>
          {a.photos.length ? (
            <div className="flex flex-wrap gap-2">
              {a.photos.map((p) => (
                <a key={p} href={fileUrl(p)} target="_blank" rel="noreferrer" className="h-20 w-20 rounded-md overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(p)} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No photos.</p>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            {!gone && (
              <button type="button" onClick={() => setPanel(panel === 'maintenance' ? null : 'maintenance')} className={secondaryBtn}>
                <Wrench className="h-4 w-4" /> Add maintenance
              </button>
            )}
            {!gone && (
              <button
                type="button"
                onClick={() => run('status', () => assetApi.setStatus(a._id, a.status === 'maintenance' ? 'active' : 'maintenance'), a.status === 'maintenance' ? 'Back in use' : 'Marked as in maintenance')}
                disabled={busy === 'status'}
                className={secondaryBtn}
              >
                {busy === 'status' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {a.status === 'maintenance' ? 'Back in use' : 'In maintenance'}
              </button>
            )}
            {!gone && (
              <button type="button" onClick={() => setPanel(panel === 'dispose' ? null : 'dispose')} className={`${secondaryBtn} text-red-600`}>
                <Ban className="h-4 w-4" /> Sell / scrap
              </button>
            )}
            {gone && (
              <button
                type="button"
                onClick={() => window.confirm('Undo the sale / disposal and put the asset back in use?') && run('status', () => assetApi.setStatus(a._id, 'active'), 'Back in use')}
                disabled={busy === 'status'}
                className={secondaryBtn}
              >
                <RotateCcw className="h-4 w-4" /> Undo — back in use
              </button>
            )}
          </div>
        )}

        {panel === 'maintenance' && (
          <fieldset disabled={!!busy} className="rounded-lg border border-honey-200 bg-honey-50/40 p-3 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Field label="Date">
                <input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Cost (Rs)">
                <MoneyInput value={m.cost} onValue={(v) => setM({ ...m, cost: v })} className={inputClass} />
              </Field>
              <div className="col-span-2">
                <Field label="Status after">
                  <SearchSelect value={m.status} onChange={(e) => setM({ ...m, status: e.target.value as typeof m.status })} className={inputClass}>
                    <option value="">No change ({STATUS_LABEL[a.status]})</option>
                    <option value="active">In use</option>
                    <option value="maintenance">In maintenance</option>
                  </SearchSelect>
                </Field>
              </div>
            </div>
            <Field label="What was done" required>
              <input value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} placeholder="e.g. AC gas refill, UPS battery changed" className={inputClass} />
            </Field>
            <div className="flex justify-end">
              <button type="button" onClick={saveMaintenance} disabled={busy === 'maintenance'} className={primaryBtn}>
                {busy === 'maintenance' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save entry
              </button>
            </div>
          </fieldset>
        )}

        {panel === 'dispose' && (
          <fieldset disabled={!!busy} className="rounded-lg border border-red-200 bg-red-50/40 p-3 space-y-3">
            <div className="flex gap-2">
              {(['sold', 'disposed'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setD({ ...d, type: t })}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${d.type === t ? 'border-red-400 bg-white text-red-700 font-medium' : 'border-gray-300 text-gray-600 bg-white'}`}
                >
                  {t === 'sold' ? 'Sold' : 'Scrapped / given away'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Date">
                <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} className={inputClass} />
              </Field>
              <Field label={d.type === 'sold' ? 'Sold for (Rs)' : 'Money received (Rs)'}>
                <MoneyInput value={d.amount} onValue={(v) => setD({ ...d, amount: v })} placeholder="0" className={inputClass} />
              </Field>
            </div>
            <Field label="Note">
              <input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="Buyer, reason…" className={inputClass} />
            </Field>
            <p className="text-xs text-gray-600">
              Book value today: <strong>{formatRs(a.currentValue)}</strong>
              {d.amount !== '' && (
                <>
                  {' '}
                  · {Number(d.amount) >= a.currentValue ? 'gain' : 'loss'} {formatRs(Math.abs(Number(d.amount) - a.currentValue))}
                </>
              )}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={saveDisposal} disabled={busy === 'dispose'} className={`${primaryBtn} !bg-red-600 hover:!bg-red-700`}>
                {busy === 'dispose' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Confirm
              </button>
            </div>
          </fieldset>
        )}

        {/* Maintenance log */}
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">Maintenance log</p>
          {a.maintenanceLog.length === 0 ? (
            <p className="text-xs text-gray-400">No maintenance yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg text-sm">
              {[...a.maintenanceLog].reverse().map((e) => (
                <li key={e._id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-gray-900">{e.note || 'Maintenance'}</span>
                    <span className="text-xs text-gray-500">{formatDate(e.date)}</span>
                  </span>
                  <span className="tabular-nums text-gray-900 whitespace-nowrap">{formatRs(e.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
