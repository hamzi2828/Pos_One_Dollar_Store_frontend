'use client';

// Purchase trip modals: send to warehouse (boxes + optional transport details),
// edit details, new product from a bill.
import { useRef, useState } from 'react';
import { AlertTriangle, ClipboardList, Loader2, PackagePlus, Truck } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { ErrorBox, Field, HelpBox, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi, toNum } from '../../_shared/purchasingApi';
import { Disclosure, NumberStepper, PhotoPicker, PhotoStrip, billTotalOf, dateInput, paidOf, todayInput } from '../../_shared/ui';
import type { POBill, PurchaseOrder } from '../../_shared/types';

// ---------------------------------------------------------------- send to warehouse

export function CloseModal({
  po,
  onClose,
  onClosed,
}: {
  po: PurchaseOrder;
  onClose: () => void;
  onClosed: (po: PurchaseOrder, grn: { _id: string; grnNumber: string } | undefined, warnings: string[]) => void;
}) {
  const b = po.builty || ({} as PurchaseOrder['builty']);
  const billBoxes = po.bills.reduce((s, x) => s + (x.cartons || 0), 0);
  const [builtyNo, setBuiltyNo] = useState(b.builtyNo || '');
  const [transporter, setTransporter] = useState(b.transporter || '');
  const [date, setDate] = useState(dateInput(b.date) || todayInput());
  const [cartons, setCartons] = useState(String(billBoxes || b.cartons || 0));
  const [freight, setFreight] = useState(b.freight ? String(b.freight) : '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const noAmount = po.bills.filter((x) => !(billTotalOf(x) > 0));
  const noBoxes = po.bills.filter((x) => !(x.cartons > 0));
  const goods = po.bills.reduce((s, x) => s + billTotalOf(x), 0);
  const paid = po.bills.reduce((s, x) => s + paidOf(x), 0);
  const oldFreight = po.charges.find((c) => c.source === 'builty')?.amount || 0;
  const charges = po.totals.charges + (toNum(freight) - oldFreight);
  const blocked = !po.bills.length || noAmount.length > 0;

  const submit = async () => {
    if (lock.current || blocked) return;
    if (!(toNum(cartons) >= 1) || !Number.isInteger(toNum(cartons))) return setError('Enter how many boxes/packs are going to the warehouse (1 or more).');
    if (toNum(freight) < 0) return setError('Freight cannot be negative.');
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await purchasingApi.close(
        po._id,
        { builtyNo: builtyNo.trim(), transporter: transporter.trim(), date, cartons: toNum(cartons), freight: toNum(freight) },
        photos,
      );
      onClosed(res.data, res.grn, res.warnings || []);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not send the trip to the warehouse.'));
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Send to warehouse"
      subtitle={`${po.poNumber} · ${po.bills.length} vendor bill${po.bills.length === 1 ? '' : 's'}`}
      icon={<Truck className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>
            Back
          </button>
          <button className={primaryBtn} onClick={submit} disabled={busy || blocked} aria-busy={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            {busy ? 'Sending…' : 'Send to warehouse'}
          </button>
        </>
      }
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <HelpBox>
          The trip is locked, each vendor bill (and what you paid) goes into the vendor&apos;s account, and the boxes/packs wait in <strong>Receive Goods</strong> to be checked.
        </HelpBox>
        {noAmount.length > 0 && (
          <ErrorBox message={`Enter the bill amount for: ${noAmount.map((x) => x.vendorName).join(', ')}.`} />
        )}
        {noBoxes.length > 0 && noAmount.length === 0 && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>No boxes/packs entered for: {noBoxes.map((x) => x.vendorName).join(', ')}.</span>
          </div>
        )}

        <Field label="Boxes/packs going to the warehouse" required hint={`Bills add up to ${billBoxes} box${billBoxes === 1 ? '' : 'es'}/pack${billBoxes === 1 ? '' : 's'}.`}>
          <NumberStepper value={cartons} onChange={setCartons} min={0} label="boxes/packs" />
        </Field>
        {toNum(cartons) > 0 && billBoxes > 0 && toNum(cartons) !== billBoxes && (
          <p className="text-xs text-amber-700">
            The bills say {billBoxes} boxes/packs, you entered {toNum(cartons)}.
          </p>
        )}

        <div className="rounded-lg bg-gray-50 p-3 text-xs space-y-1">
          <Row label="Vendor bills" value={formatRs(goods)} />
          <Row label="Paid now" value={formatRs(paid)} />
          <Row label="Still owed to vendors" value={formatRs(Math.max(0, goods - paid))} strong />
          <Row label="Trip costs" value={formatRs(charges)} />
        </div>

        <Disclosure title="Transport details (optional)" defaultOpen={!!(b.builtyNo || b.transporter || b.freight)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Builty no.">
                <input value={builtyNo} onChange={(e) => setBuiltyNo(e.target.value)} className={inputClass} placeholder="e.g. 77881" />
              </Field>
              <Field label="Date">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Transporter">
                <input value={transporter} onChange={(e) => setTransporter(e.target.value)} className={inputClass} placeholder="e.g. Daewoo Cargo" />
              </Field>
              <Field label="Freight paid (Rs)" hint="Added to trip costs">
                <input type="number" min={0} inputMode="decimal" value={freight} onChange={(e) => setFreight(e.target.value)} className={inputClass} placeholder="0" />
              </Field>
            </div>
            <Field label="Builty photo">
              <div className="space-y-2">
                <PhotoStrip photos={b.photos || []} />
                <PhotoPicker files={photos} onChange={setPhotos} max={5} />
              </div>
            </Field>
          </div>
        </Disclosure>
        <ErrorBox message={error} />
      </fieldset>
    </Modal>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={strong ? 'font-semibold text-gray-900' : 'text-gray-800'}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------- trip details

export function DetailsModal({ po, onClose, onSaved }: { po: PurchaseOrder; onClose: () => void; onSaved: (po: PurchaseOrder) => void }) {
  const [buyerName, setBuyerName] = useState(po.buyerName || '');
  const [expected, setExpected] = useState(dateInput(po.expectedArrival));
  const [notes, setNotes] = useState(po.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await purchasingApi.update(po._id, { buyerName, expectedArrival: expected || null, notes }));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save.'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Trip details"
      icon={<ClipboardList className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={primaryBtn} onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Buyer">
          <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Expected arrival">
          <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- new product typed on a bill

export function NewProductModal({
  po,
  bill,
  categories,
  onClose,
  onSaved,
}: {
  po: PurchaseOrder;
  bill: POBill;
  categories: string[];
  onClose: () => void;
  onSaved: (po: PurchaseOrder) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [perBox, setPerBox] = useState('1');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!name.trim() || !category.trim()) return setError('Name and category are required.');
    if (!(toNum(salePrice) > 0)) return setError('Enter the sale price (e.g. 150, 280, 499).');
    if (!(toNum(qty) >= 1) || !Number.isInteger(toNum(qty))) return setError('Enter how many pieces you bought.');
    if (unitPrice === '') return setError('Enter the vendor price per piece.');
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await purchasingApi.newProduct(po._id, bill._id, {
          name: name.trim(),
          category: category.trim(),
          salePrice: toNum(salePrice),
          piecesPerBox: Math.max(1, Math.floor(toNum(perBox)) || 1),
          qty: toNum(qty),
          unitPrice: toNum(unitPrice),
        }),
      );
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not create the product.'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New product"
      subtitle={`Created with 0 stock and added to the bill of ${bill.vendorName}`}
      icon={<PackagePlus className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={primaryBtn} onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Creating…' : 'Create & add'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Product name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <input value={category} onChange={(e) => setCategory(e.target.value)} list="po-categories" className={inputClass} />
            <datalist id="po-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Sale price (Rs)" required>
            <input type="number" min={0} inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Pieces per box/pack">
            <input type="number" min={1} inputMode="numeric" value={perBox} onChange={(e) => setPerBox(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Pieces bought" required>
            <input type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Vendor price / piece" required>
            <input type="number" min={0} step="0.01" inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <p className="text-[11px] text-gray-500">Short code, SKU and barcode are made automatically. Add photos and details later on the product page.</p>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
