'use client';

// "New product" while unpacking: the full product form (same as Products →
// Create) in a large popup, so nothing is lost on the receiving screen.
// No stock is typed here: the pieces go in with the entry right after.
import { useEffect, useState } from 'react';
import { Loader2, PackagePlus } from 'lucide-react';
import { Modal } from '@/components/admin/FormBits';
import ProductForm from '@/app/(routes)/admin/products/components/ProductForm';
import type { Category } from '@/app/(routes)/admin/products/components/CategoriesTab';
import { loadCreateTabData } from '@/app/(routes)/admin/products/services/productOptionsService';
import type { ProductUI } from '@/app/(routes)/admin/products/services/productService';
import type { NameMatch } from '@/app/(routes)/admin/products/components/ProductForm';
import { purchasingApi } from '../../../_shared/purchasingApi';
import type { ReceivingUnit } from '../../../_shared/types';
import { formatRs } from '@/lib/storeApi';

export default function FullProductModal({
  vendorName,
  vendorId,
  boxLabel,
  initialName = '',
  onClose,
  onCreated,
  grnId,
  billId,
  onPickExisting,
}: {
  /** Receipt + bill: used to find products that already exist while the name is typed. */
  grnId?: string;
  billId?: string;
  /** An existing product was picked instead of making a new one. */
  onPickExisting?: (unit: ReceivingUnit) => void;
  vendorName: string;
  /** Pre-picked as the product's vendor. */
  vendorId?: string;
  /** e.g. "Box 2 of 5" */
  boxLabel?: string;
  /** what was typed in the search box (a barcode is not used as the name) */
  initialName?: string;
  onClose: () => void;
  onCreated: (product: ProductUI, receivedPieces: number, barcode?: string) => void;
}) {
  const [data, setData] = useState<{ categories: Category[]; colorOptions: string[]; sizeOptions: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Products already in the shop with a name like the one typed.
  const [found] = useState(() => new Map<string, ReceivingUnit>());
  const nameMatches =
    grnId && onPickExisting
      ? {
          search: async (term: string): Promise<NameMatch[]> => {
            const units = await purchasingApi.grnLookup(grnId, term, billId);
            found.clear();
            return units.map((u, i) => {
              const key = `${u.productId}:${u.variantId || ''}:${i}`;
              found.set(key, u);
              return {
                key,
                label: u.name || u.productName || 'Product',
                detail: [u.code ? `#${u.code}` : '', u.salePrice ? `sells ${formatRs(u.salePrice)}` : '', typeof u.stockTotal === 'number' ? `${u.stockTotal} in stock` : '', u.lastVendorName ? `last from ${u.lastVendorName}` : '']
                  .filter(Boolean)
                  .join(' · '),
                thumb: u.thumbnailUrl || null,
              };
            });
          },
          onPick: (key: string) => {
            const u = found.get(key);
            if (u) onPickExisting(u);
          },
        }
      : undefined;
  const looksLikeCode = /^[0-9A-Z-]{6,}$/i.test(initialName.trim()) && /\d/.test(initialName);

  useEffect(() => {
    let alive = true;
    loadCreateTabData()
      .then((d) => {
        if (!alive) return;
        setData({
          categories: (d.categories as unknown as Category[]).filter((c) => c.active),
          colorOptions: d.colorOptions,
          sizeOptions: d.sizeOptions,
        });
      })
      .catch(() => alive && setError('Could not load categories. Close and try again.'));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Modal
      wide="xl"
      title="New product"
      subtitle={`From ${vendorName}${boxLabel ? ` · ${boxLabel}` : ''}. After saving, enter the pieces and print the tags.`}
      icon={<PackagePlus className="h-5 w-5" />}
      onClose={onClose}
    >
      {error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading the form…
        </div>
      ) : (
        <ProductForm
          mode="create"
          noStock
          defaultName={looksLikeCode ? '' : initialName.trim()}
          defaultBarcode={looksLikeCode ? initialName.trim() : ''}
          defaultVendorId={vendorId || ''}
          nameMatches={nameMatches}
          categories={data.categories}
          colorOptions={data.colorOptions}
          sizeOptions={data.sizeOptions}
          onCancel={onClose}
          onSuccess={(p, extra) => p && onCreated(p, extra?.receivedPieces || 0, extra?.barcode)}
        />
      )}
    </Modal>
  );
}
