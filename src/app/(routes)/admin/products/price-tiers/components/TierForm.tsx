'use client';

// Create / edit a price tier. A new price re-prices every linked product.
import { useRef, useState } from 'react';
import MoneyInput from '@/components/ui/MoneyInput';
import toast from 'react-hot-toast';
import { Loader2, Tags } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { Modal, Field, Toggle, ErrorBox, HelpBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { PriceTier, TIER_COLORS, tierApi } from './tierApi';

export default function TierForm({ tier, onClose, onSaved }: { tier: PriceTier | null; onClose: () => void; onSaved: (t: PriceTier) => void }) {
  const [name, setName] = useState(tier?.name || '');
  const [price, setPrice] = useState(tier ? String(tier.price) : '');
  const [color, setColor] = useState(tier?.color || TIER_COLORS[0]);
  const [sortOrder, setSortOrder] = useState(tier ? String(tier.sortOrder || 0) : '0');
  const [description, setDescription] = useState(tier?.description || '');
  const [isActive, setIsActive] = useState(tier ? tier.isActive : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const priceNum = Number(price);
  const priceChanged = !!tier && Number.isFinite(priceNum) && priceNum > 0 && priceNum !== tier.price;

  const save = async () => {
    if (lock.current) return;
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError('Enter the price (e.g. 280)');
    if (priceChanged && (tier?.productCount || 0) > 0 && !confirm(`${tier?.productCount} product(s) will now sell at ${formatRs(priceNum)}. Continue?`)) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    const body = { name: name.trim() || `Rs ${priceNum}`, price: priceNum, color, sortOrder: Number(sortOrder) || 0, description: description.trim(), isActive };
    try {
      const res = tier ? await tierApi.update(tier._id, body) : await tierApi.create(body);
      toast.success(res.message || 'Saved');
      onSaved(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the tier'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={tier ? `Edit ${tier.name}` : 'New price tier'}
      subtitle="A fixed sale price shared by many products"
      icon={<Tags className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={primaryBtn} onClick={save} disabled={saving} aria-busy={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save tier'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sale price (Rs)" required>
            <MoneyInput
              className={`${inputClass} text-lg font-semibold`}
              value={price}
              onValue={(v) => {
                setPrice(v);
                if (!tier && (!name || /^Rs \d+(\.\d+)?$/.test(name))) setName(v ? `Rs ${v}` : '');
              }}
              autoFocus
            />
          </Field>
          <Field label="Name" required>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Rs 280" maxLength={60} />
          </Field>
        </div>
        <Field label="Colour">
          <div className="flex flex-wrap gap-2">
            {TIER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-gray-900 scale-110' : 'border-white shadow'}`}
                style={{ backgroundColor: c }}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sort order" hint="Lower first">
            <input type="number" className={inputClass} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </Field>
          <div className="pt-6">
            <Toggle checked={isActive} onChange={setIsActive} label="Tier is on" hint="Off = cannot add products" />
          </div>
        </div>
        <Field label="Description">
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </Field>
        {priceChanged && (tier?.productCount || 0) > 0 && (
          <HelpBox>
            All {tier?.productCount} linked product(s) (every variant) will be re-priced from {formatRs(tier?.price)} to {formatRs(priceNum)}. Each change is kept
            in the price history.
          </HelpBox>
        )}
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
