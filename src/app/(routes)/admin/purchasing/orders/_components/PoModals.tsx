'use client';

// Purchase order modals: close & submit builty, edit details, new product from a line.
import { useState } from 'react';
import { AlertTriangle, ClipboardList, PackagePlus, Truck } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { ErrorBox, Field, HelpBox, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi, toNum } from '../../_shared/purchasingApi';
import { PhotoPicker, PhotoStrip, dateInput, todayInput } from '../../_shared/ui';
import type { Costing, POBill, PurchaseOrder } from '../../_shared/types';

// ---------------------------------------------------------------- close + builty

export function CloseModal({
  po,
  costing,
  onClose,
  onClosed,
}: {
  po: PurchaseOrder;
  costing: Costing | null;
  onClose: () => void;
  onClosed: (po: PurchaseOrder, grn: { _id: string; grnNumber: string } | undefined, warnings: string[]) => void;
}) {
  const b = po.builty || ({} as PurchaseOrder['builty']);
  const [builtyNo, setBuiltyNo] = useState(b.builtyNo || '');
  const [transporter, setTransporter] = useState(b.transporter || '');
  const [date, setDate] = useState(dateInput(b.date) || todayInput());
  const [cartons, setCartons] = useState(String(b.cartons || po.totals.cartons || ''));
  const [freight, setFreight] = useState(b.freight ? String(b.freight) : '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emptyBill = po.bills.find((x) => x.items.length === 0);
  const warnings = costing?.totals.warnings || 0;
  const cartonsMismatch = toNum(cartons) > 0 && po.totals.cartons > 0 && toNum(cartons) !== po.totals.cartons;

  const submit = async () => {
    if (busy) return;
    if (!builtyNo.trim() && !photos.length && !(b.photos || []).length) return setError('Enter the builty number or add a photo of the builty.');
    if (!(toNum(cartons) >= 1) || !Number.isInteger(toNum(cartons))) return setError('Enter how many cartons the builty shows.');
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
      setError(apiErrorMessage(e, 'Could not close the purchase order.'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Close & submit builty"
      subtitle={`${po.poNumber} · ${po.bills.length} bills · ${po.totals.pieces} pcs`}
      icon={<Truck className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>Back</button>
          <button className={primaryBtn} onClick={submit} disabled={busy || !!emptyBill || !po.bills.length}>{busy ? 'Closing…' : 'Close & send to receiving'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <HelpBox>
          After closing, the PO is locked, each vendor bill is added to the vendor&apos;s account, and the goods go to <strong>Goods Receiving</strong> for checking.
        </HelpBox>
        {emptyBill && <ErrorBox message={`The bill from ${emptyBill.vendorName} has no items. Add items or remove it first.`} />}
        {warnings > 0 && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{warnings} line(s) have a low margin or a loss in the landed cost preview.</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Builty no." required>
            <input value={builtyNo} onChange={(e) => setBuiltyNo(e.target.value)} className={inputClass} placeholder="e.g. 77881" autoFocus />
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Transporter">
            <input value={transporter} onChange={(e) => setTransporter(e.target.value)} className={inputClass} placeholder="e.g. Daewoo Cargo" />
          </Field>
          <Field label="Cartons on builty" required>
            <input type="number" min={1} inputMode="numeric" value={cartons} onChange={(e) => setCartons(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Freight paid (Rs)" hint="Added to the trip charges">
            <input type="number" min={0} inputMode="decimal" value={freight} onChange={(e) => setFreight(e.target.value)} className={inputClass} placeholder="0" />
          </Field>
        </div>
        {cartonsMismatch && (
          <p className="text-xs text-amber-700">The bills add up to {po.totals.cartons} cartons, the builty says {toNum(cartons)}.</p>
        )}
        <Field label="Builty photo" hint="Required when there is no builty number.">
          <div className="space-y-2">
            <PhotoStrip photos={b.photos || []} />
            <PhotoPicker files={photos} onChange={setPhotos} max={5} />
          </div>
        </Field>
        <div className="rounded-lg bg-gray-50 p-3 text-xs space-y-1">
          <Row label="Goods (vendor bills)" value={formatRs(po.totals.goods)} />
          <Row label="Charges" value={formatRs(po.totals.charges + (toNum(freight) - (po.charges.find((c) => c.source === 'builty')?.amount || 0)))} />
          <Row label="Total cost" value={formatRs(po.totals.goods + po.totals.charges + (toNum(freight) - (po.charges.find((c) => c.source === 'builty')?.amount || 0)))} strong />
        </div>
        <ErrorBox message={error} />
      </div>
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

// ---------------------------------------------------------------- PO details

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
      title="Purchase order details"
      icon={<ClipboardList className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={primaryBtn} onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
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

// ---------------------------------------------------------------- new product from a PO line

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
          <button className={primaryBtn} onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create & add'}</button>
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
          <Field label="Pieces per box">
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
