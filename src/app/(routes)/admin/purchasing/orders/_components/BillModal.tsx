'use client';

// Add / edit one vendor bill of a purchase order (vendor, bill no, cartons, bill photo).
import { useState } from 'react';
import { Receipt } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi, toNum } from '../../_shared/purchasingApi';
import { VendorSearch } from '../../_shared/Pickers';
import { PhotoPicker, PhotoStrip, dateInput, todayInput } from '../../_shared/ui';
import type { POBill, PurchaseOrder, VendorOption } from '../../_shared/types';

export default function BillModal({
  poId,
  bill,
  onClose,
  onSaved,
}: {
  poId: string;
  bill: POBill | null; // null = new bill
  onClose: () => void;
  onSaved: (po: PurchaseOrder, billId?: string) => void;
}) {
  const [vendor, setVendor] = useState<VendorOption | null>(bill ? { _id: bill.vendor, name: bill.vendorName } : null);
  const [billNo, setBillNo] = useState(bill?.billNo || '');
  const [billDate, setBillDate] = useState(bill ? dateInput(bill.billDate) : todayInput());
  const [cartons, setCartons] = useState(bill ? String(bill.cartons || '') : '');
  const [discount, setDiscount] = useState(bill?.discount ? String(bill.discount) : '');
  const [notes, setNotes] = useState(bill?.notes || '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = (bill?.photos || []).filter((p) => !removed.includes(p));

  const submit = async () => {
    if (busy) return;
    if (!vendor) return setError('Choose the vendor of this bill.');
    if (cartons !== '' && (!Number.isInteger(Number(cartons)) || Number(cartons) < 0)) return setError('Cartons must be a whole number.');
    if (discount !== '' && toNum(discount) < 0) return setError('Discount cannot be negative.');
    setBusy(true);
    setError(null);
    const fields = {
      vendorId: vendor._id,
      billNo: billNo.trim(),
      billDate: billDate || undefined,
      cartons: toNum(cartons),
      discount: toNum(discount),
      notes: notes.trim(),
    };
    try {
      if (bill) {
        onSaved(await purchasingApi.updateBill(poId, bill._id, { ...fields, removePhotos: removed }, photos));
      } else {
        const po = await purchasingApi.addBill(poId, fields, photos);
        onSaved(po, po.bills[po.bills.length - 1]?._id);
      }
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the bill.'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={bill ? 'Edit vendor bill' : 'Add vendor bill'}
      subtitle="One bill per vendor: how many cartons, bill number and a photo of the bill."
      icon={<Receipt className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={primaryBtn} onClick={submit} disabled={busy}>{busy ? 'Saving…' : bill ? 'Save bill' : 'Add bill'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Vendor" required>
          <VendorSearch value={vendor} onChange={setVendor} disabled={busy} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bill no.">
            <input value={billNo} onChange={(e) => setBillNo(e.target.value)} className={inputClass} placeholder="e.g. 4512" />
          </Field>
          <Field label="Bill date">
            <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Cartons / bales" hint="Packed pieces from this vendor">
            <input type="number" min={0} inputMode="numeric" value={cartons} onChange={(e) => setCartons(e.target.value)} className={inputClass} placeholder="0" />
          </Field>
          <Field label="Bill discount (Rs)">
            <input type="number" min={0} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} placeholder="0" />
          </Field>
        </div>
        <Field label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
        </Field>
        <Field label="Bill photo" hint="Optional. Take a photo of the paper bill.">
          <div className="space-y-2">
            <PhotoStrip photos={existing} onRemove={(p) => setRemoved((r) => [...r, p])} />
            <PhotoPicker files={photos} onChange={setPhotos} max={5} />
          </div>
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
