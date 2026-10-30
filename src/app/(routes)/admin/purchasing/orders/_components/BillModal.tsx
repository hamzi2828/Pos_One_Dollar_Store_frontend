'use client';

// Add / edit one vendor bill of a purchase trip: vendor, bill no, date, bill
// amount, boxes, bill photo and what was paid at the market. Items are optional
// (typed on the bill card, or entered while unpacking).
import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Receipt } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { PAYMENT_METHODS, vendorApi, type BankOption, type PaymentMethod } from '@/app/(routes)/admin/vendors/services/vendorApi';
import { purchasingApi, toNum } from '../../_shared/purchasingApi';
import { VendorSearch } from '../../_shared/Pickers';
import { Chips, Disclosure, NumberStepper, PhotoPicker, PhotoStrip, dateInput, todayInput } from '../../_shared/ui';
import type { POBill, PurchaseOrder, VendorOption } from '../../_shared/types';
import { SearchSelect } from '@/components/ui/SearchSelect';
import VendorFormModal from '@/app/(routes)/admin/vendors/components/VendorFormModal';

/** Methods that are paid from one of our bank accounts. */
export const needsBank = (m: string) => m === 'bank' || m === 'cheque';

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
  // "+ New vendor": add a vendor without leaving the bill; it is picked when saved.
  const canAddVendor = useAccess().can('vendors', 'create');
  const [addingVendor, setAddingVendor] = useState(false);
  const [billNo, setBillNo] = useState(bill?.billNo || '');
  const [billDate, setBillDate] = useState(bill ? dateInput(bill.billDate) : todayInput());
  const [billAmount, setBillAmount] = useState(bill?.billAmount ? String(bill.billAmount) : '');
  const [cartons, setCartons] = useState(bill ? String(bill.cartons || 0) : '1');
  const [paidNow, setPaidNow] = useState(bill?.paidNow ? String(bill.paidNow) : '');
  const [method, setMethod] = useState<PaymentMethod>(() => {
    const m = bill?.paidMethod === 'bank_transfer' ? 'bank' : bill?.paidMethod;
    return PAYMENT_METHODS.some((x) => x.value === m) ? (m as PaymentMethod) : 'cash';
  });
  const [bankId, setBankId] = useState(bill?.paidBank || '');
  const [discount, setDiscount] = useState(bill?.discount ? String(bill.discount) : '');
  const [notes, setNotes] = useState(bill?.notes || '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    vendorApi
      .banks()
      .then((b) => setBanks(b || []))
      .catch(() => setBanks([]));
  }, []);

  const existing = (bill?.photos || []).filter((p) => !removed.includes(p));
  const hasItems = !!bill?.items.length;
  const itemsTotal = bill ? Math.max(0, bill.subtotal - toNum(discount)) : 0;
  const total = toNum(billAmount) > 0 ? toNum(billAmount) : itemsTotal;
  const owed = Math.max(0, total - toNum(paidNow));

  const submit = async () => {
    if (lock.current) return;
    if (!vendor) return setError('Choose the vendor of this bill.');
    if (billAmount !== '' && toNum(billAmount) < 0) return setError('Bill amount cannot be negative.');
    if (!Number.isInteger(toNum(cartons)) || toNum(cartons) < 0) return setError('Boxes/packs must be a whole number.');
    if (toNum(paidNow) < 0) return setError('Paid now cannot be negative.');
    if (toNum(paidNow) > 0 && total > 0 && toNum(paidNow) > total) return setError(`Paid now (${formatRs(toNum(paidNow))}) is more than the bill (${formatRs(total)}).`);
    if (toNum(paidNow) > 0 && !hasItems && !(toNum(billAmount) > 0)) return setError('Enter the bill amount first, then what you paid.');
    if (discount !== '' && toNum(discount) < 0) return setError('Discount cannot be negative.');
    lock.current = true;
    setBusy(true);
    setError(null);
    const paid = toNum(paidNow);
    const fields = {
      vendorId: vendor._id,
      billNo: billNo.trim(),
      billDate: billDate || undefined,
      billAmount: toNum(billAmount),
      cartons: toNum(cartons),
      paidNow: paid,
      paidMethod: paid > 0 ? method : 'cash',
      paidBank: paid > 0 && needsBank(method) ? bankId || null : null,
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
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <>
    <Modal
      title={bill ? 'Edit vendor bill' : 'Add vendor bill'}
      subtitle="One bill per vendor. Items are optional — you can enter them while unpacking."
      icon={<Receipt className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={primaryBtn} onClick={submit} disabled={busy} aria-busy={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Saving…' : bill ? 'Save bill' : 'Add bill'}
          </button>
        </>
      }
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <label className="block text-xs font-medium text-gray-700">
              Vendor <span className="text-red-500">*</span>
            </label>
            {canAddVendor && (
              <button
                type="button"
                onClick={() => setAddingVendor(true)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-honey-500 text-gray-900 hover:bg-honey-600"
                title="Add a new vendor"
                aria-label="Add a new vendor"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <VendorSearch value={vendor} onChange={setVendor} disabled={busy} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bill no.">
            <input value={billNo} onChange={(e) => setBillNo(e.target.value)} className={inputClass} placeholder="e.g. 4512" />
          </Field>
          <Field label="Date">
            <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field
          label="Bill amount (Rs)"
          required={!hasItems}
          hint={hasItems && !(toNum(billAmount) > 0) ? `Empty = items total (${formatRs(itemsTotal)}).` : 'The total written on the vendor’s bill.'}
        >
          <input
            type="number"
            min={0}
            inputMode="decimal"
            value={billAmount}
            onChange={(e) => setBillAmount(e.target.value)}
            className={`${inputClass} text-base font-semibold`}
            placeholder="0"
          />
        </Field>
        <Field label="Boxes/packs" hint="How many boxes/packs (cartons, bags) you got from this vendor.">
          <NumberStepper value={cartons} onChange={setCartons} min={0} label="boxes/packs" />
        </Field>

        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
          <Field label="Paid now (Rs)" hint="Money given to the vendor at the market. 0 = nothing paid.">
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={paidNow}
                onChange={(e) => setPaidNow(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
              {total > 0 && (
                <button type="button" onClick={() => setPaidNow(String(total))} className={`${secondaryBtn} !px-2 text-xs whitespace-nowrap`}>
                  Paid full
                </button>
              )}
            </div>
          </Field>
          {toNum(paidNow) > 0 && (
            <>
              <Field label="Paid by">
                <Chips options={PAYMENT_METHODS} value={method} onChange={setMethod} disabled={busy} />
              </Field>
              {needsBank(method) && (
                <Field label="From our bank account">
                  <SearchSelect value={bankId} onChange={(e) => setBankId(e.target.value)} className={inputClass}>
                    <option value="">— Not set —</option>
                    {banks.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name} · {b.accountTitle} ({String(b.accountNumber || '').slice(-4)})
                      </option>
                    ))}
                  </SearchSelect>
                </Field>
              )}
            </>
          )}
          {total > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Money label="Bill" value={formatRs(total)} />
              <Money label="Paid now" value={formatRs(toNum(paidNow))} />
              <Money label="Still owed" value={formatRs(owed)} strong />
            </div>
          )}
          <p className="text-[11px] text-gray-500">The bill and this payment go into the vendor&apos;s account as soon as you save.</p>
        </div>

        <Field label="Bill photo" hint="Optional. Take a photo of the paper bill.">
          <div className="space-y-2">
            <PhotoStrip photos={existing} onRemove={(p) => setRemoved((r) => [...r, p])} />
            <PhotoPicker files={photos} onChange={setPhotos} max={5} />
          </div>
        </Field>

        <Disclosure title="More (discount, notes)">
          <div className="space-y-3">
            {hasItems && (
              <Field label="Discount on items (Rs)" hint="Only used when the bill amount is empty.">
                <input type="number" min={0} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} placeholder="0" />
              </Field>
            )}
            <Field label="Notes">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
            </Field>
          </div>
        </Disclosure>
        <ErrorBox message={error} />
      </fieldset>
    </Modal>
    {addingVendor && (
      <VendorFormModal
        vendor={null}
        onClose={() => setAddingVendor(false)}
        onSaved={(v) => {
          setVendor({ _id: v._id, name: v.name, phone: v.phone, city: v.city });
          setAddingVendor(false);
        }}
      />
    )}
    </>
  );
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-1.5">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={strong ? 'font-semibold text-gray-900' : 'text-gray-800'}>{value}</p>
    </div>
  );
}
