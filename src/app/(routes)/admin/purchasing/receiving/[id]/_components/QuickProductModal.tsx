'use client';

// "New product" while unpacking: name, sale price, cost, pieces per box, barcode.
import { useEffect, useRef, useState } from 'react';
import { Loader2, PackagePlus } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi, toNum } from '../../../_shared/purchasingApi';
import type { ReceivingUnit } from '../../../_shared/types';

export default function QuickProductModal({
  grnId,
  vendorName,
  initialName = '',
  onClose,
  onCreated,
}: {
  grnId: string;
  vendorName: string;
  /** what was typed in the search box (a barcode goes to "Barcode") */
  initialName?: string;
  onClose: () => void;
  onCreated: (unit: ReceivingUnit, costPrice: number) => void;
}) {
  const looksLikeCode = /^[0-9A-Z-]{6,}$/i.test(initialName.trim()) && /\d/.test(initialName);
  const [name, setName] = useState(looksLikeCode ? '' : initialName.trim());
  const [barcode, setBarcode] = useState(looksLikeCode ? initialName.trim() : '');
  const [category, setCategory] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [perBox, setPerBox] = useState('1');
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    purchasingApi
      .meta()
      .then((m) => setCategories(m.categories || []))
      .catch(() => setCategories([]));
  }, []);

  const submit = async () => {
    if (lock.current) return;
    if (!name.trim()) return setError('Enter the product name.');
    if (!(toNum(salePrice) > 0)) return setError('Enter the sale price (e.g. 150, 280, 499).');
    if (costPrice !== '' && !(toNum(costPrice) > 0)) return setError('Cost price must be more than 0.');
    const ppb = Math.floor(toNum(perBox)) || 1;
    if (ppb < 1) return setError('Pieces per box/pack must be 1 or more.');
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const unit = await purchasingApi.grnNewProduct(grnId, {
        name: name.trim(),
        category: category.trim() || undefined,
        salePrice: toNum(salePrice),
        costPrice: costPrice !== '' ? toNum(costPrice) : undefined,
        piecesPerBox: ppb,
        barcode: barcode.trim() || undefined,
      });
      onCreated(unit, toNum(costPrice));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not create the product.'));
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New product"
      subtitle={`From ${vendorName}. Code and tag are made automatically.`}
      icon={<PackagePlus className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={primaryBtn} onClick={submit} disabled={busy} aria-busy={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Creating…' : 'Create product'}
          </button>
        </>
      }
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <Field label="Product name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus placeholder="e.g. Steel water bottle 750ml" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sale price (Rs)" required>
            <input type="number" min={0} inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Cost / piece (Rs)" hint="Vendor price">
            <input type="number" min={0} step="0.01" inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Pieces per box/pack">
            <input type="number" min={1} inputMode="numeric" value={perBox} onChange={(e) => setPerBox(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Category">
            <input value={category} onChange={(e) => setCategory(e.target.value)} list="receiving-categories" className={inputClass} placeholder="Optional" />
            <datalist id="receiving-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="Barcode on the item" hint="Optional. Scan it if the item has one.">
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className={inputClass} placeholder="Scan or type" />
        </Field>
        <ErrorBox message={error} />
      </fieldset>
    </Modal>
  );
}
