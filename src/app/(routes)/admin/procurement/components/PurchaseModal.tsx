'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { procurementService, type Purchase, type Vendor, type PurchaseItem, type ProcurementProduct } from '../services/procurementService';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const absolutizeImg = (u?: string) => {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const base = API_BASE.replace(/\/$/, '');
  return `${base}${u.startsWith('/') ? u : `/${u}`}`;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (purchase: Purchase) => void;
  purchase?: Purchase | null;
  vendors: Vendor[];
}

const emptyItem = (): PurchaseItem => ({
  productId: null,
  productName: '',
  productSku: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  total: 0,
});

export default function PurchaseModal({ open, onClose, onSaved, purchase, vendors }: Props) {
  const [vendorId, setVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem()]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Product search state (per-row dropdown)
  const [searchIdx, setSearchIdx] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<ProcurementProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (purchase) {
      setVendorId(purchase.vendorId);
      setInvoiceNumber(purchase.invoiceNumber);
      setPurchaseDate(purchase.purchaseDate?.slice(0, 10) || '');
      setDueDate(purchase.dueDate?.slice(0, 10) || '');
      setItems(purchase.items.length > 0 ? purchase.items.map((i) => ({ ...i })) : [emptyItem()]);
      setTaxPercent(purchase.taxPercent || 0);
      setDiscount(purchase.discount || 0);
      setNotes(purchase.notes || '');
    } else {
      setVendorId(vendors[0]?._id || '');
      setInvoiceNumber('');
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setDueDate('');
      setItems([emptyItem()]);
      setTaxPercent(0);
      setDiscount(0);
      setNotes('');
    }
  }, [open, purchase, vendors]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
    const tax = subtotal * (Number(taxPercent) || 0) / 100;
    const total = Math.max(0, subtotal + tax - (Number(discount) || 0));
    return { subtotal, tax, total };
  }, [items, taxPercent, discount]);

  // Close dropdown on outside click — MUST be declared before any early return
  // or React will see a different number of hooks across renders.
  useEffect(() => {
    if (searchIdx === null) return;
    const onClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchIdx(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [searchIdx]);

  if (!open) return null;

  const updateItem = (idx: number, patch: Partial<PurchaseItem>) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.total = (Number(merged.quantity) || 0) * (Number(merged.unitPrice) || 0);
      return merged;
    }));
  };

  // Debounced product search for the active row
  const handleDescriptionChange = (idx: number, value: string) => {
    updateItem(idx, {
      description: value,
      // Clear product link if the user is editing free-text again
      productId: null,
      productName: '',
      productSku: '',
    });
    setSearchIdx(idx);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await procurementService.searchProducts(value.trim(), 8);
        setSearchResults(results);
      } catch (err) {
        console.error('Product search failed:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  const selectProduct = (idx: number, product: ProcurementProduct) => {
    const unit = Number(product.costPrice ?? product.discountedPrice ?? product.price) || 0;
    updateItem(idx, {
      productId: product._id,
      productName: product.name,
      productSku: product.sku || '',
      description: product.name,
      unitPrice: unit,
    });
    setSearchIdx(null);
    setSearchResults([]);
  };

  const handleSave = async () => {
    if (!vendorId) { toast.error('Please select a vendor'); return; }
    const clean = items.filter((it) => it.description.trim() && it.quantity > 0);
    if (clean.length === 0) { toast.error('Add at least one line item'); return; }

    setSaving(true);
    try {
      const payload = {
        vendorId,
        invoiceNumber: invoiceNumber.trim() || undefined,
        purchaseDate: purchaseDate || undefined,
        dueDate: dueDate || undefined,
        items: clean,
        taxPercent,
        discount,
        notes: notes.trim(),
      };
      const saved = purchase
        ? await procurementService.updatePurchase(purchase._id, payload)
        : await procurementService.createPurchase(payload);
      toast.success(purchase ? 'Purchase updated' : 'Purchase created');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save purchase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{purchase ? 'Edit Purchase' : 'New Purchase'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor *</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              >
                <option value="">Select vendor...</option>
                {vendors.map((v) => (
                  <option key={v._id} value={v._id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Number</label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Line Items</p>
              <button
                type="button"
                onClick={() => setItems((p) => [...p, emptyItem()])}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-visible">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-right px-2 py-2 w-20">Qty</th>
                    <th className="text-right px-2 py-2 w-28">Unit Price</th>
                    <th className="text-right px-2 py-2 w-28">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5 relative">
                        <div className="relative" ref={searchIdx === idx ? searchBoxRef : undefined}>
                          <div className="flex items-center gap-1">
                            <Search className="w-3 h-3 text-gray-400 shrink-0" />
                            <input
                              value={it.description}
                              onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                              onFocus={() => setSearchIdx(idx)}
                              className="w-full px-2 py-1 text-xs border border-transparent rounded hover:border-gray-200 focus:border-honey-400 focus:outline-none bg-transparent"
                              placeholder="Search product or type description..."
                              autoComplete="off"
                            />
                            {it.productId && (
                              <span
                                title={it.productSku ? `SKU: ${it.productSku}` : 'Linked product'}
                                className="shrink-0 text-[9px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded"
                              >
                                Linked
                              </span>
                            )}
                          </div>
                          {searchIdx === idx && it.description.trim().length >= 2 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                              {searching && (
                                <div className="px-3 py-2 text-xs text-gray-500 flex items-center gap-2">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                                </div>
                              )}
                              {!searching && searchResults.length === 0 && (
                                <div className="px-3 py-2 text-xs text-gray-500">
                                  No products matched. This line will be saved as free text.
                                </div>
                              )}
                              {!searching && searchResults.map((p) => {
                                const unit = Number(p.costPrice ?? p.discountedPrice ?? p.price) || 0;
                                const thumb = absolutizeImg(p.thumbnailUrl);
                                return (
                                  <button
                                    key={p._id}
                                    type="button"
                                    onClick={() => selectProduct(idx, p)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-honey-50 border-b border-gray-100 last:border-b-0"
                                  >
                                    {thumb ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={thumb} alt={p.name} className="w-8 h-8 rounded object-cover border border-gray-100" />
                                    ) : (
                                      <div className="w-8 h-8 rounded bg-gray-100" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-900 truncate">{p.name}</p>
                                      <p className="text-[10px] text-gray-500 truncate">
                                        {p.sku ? `SKU: ${p.sku} · ` : ''}Stock: {p.stock ?? 0}
                                      </p>
                                    </div>
                                    <span className="text-xs font-semibold tabular-nums text-gray-700">
                                      {unit.toFixed(2)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                          className="w-full px-2 py-1 text-xs text-right border border-transparent rounded hover:border-gray-200 focus:border-honey-400 focus:outline-none bg-transparent"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unitPrice}
                          onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                          className="w-full px-2 py-1 text-xs text-right border border-transparent rounded hover:border-gray-200 focus:border-honey-400 focus:outline-none bg-transparent"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs font-semibold tabular-nums">
                        {it.total.toFixed(2)}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                          disabled={items.length === 1}
                          className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tax %</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxPercent}
                onChange={(e) => setTaxPercent(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-semibold tabular-nums">{totals.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="font-semibold tabular-nums">{totals.tax.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="font-semibold tabular-nums">-{Number(discount).toFixed(2)}</span></div>
              <div className="flex justify-between pt-1 mt-1 border-t border-gray-200"><span className="text-gray-900 font-semibold">Total</span><span className="font-bold tabular-nums text-honey-600">{totals.total.toFixed(2)}</span></div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-white">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-honey-500 text-white text-sm font-semibold rounded-lg hover:bg-honey-600 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {purchase ? 'Save Changes' : 'Create Purchase'}
          </button>
        </div>
      </div>
    </div>
  );
}
