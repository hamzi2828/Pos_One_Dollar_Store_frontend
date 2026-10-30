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

export default function FullProductModal({
  vendorName,
  boxLabel,
  initialName = '',
  onClose,
  onCreated,
}: {
  vendorName: string;
  /** e.g. "Box 2 of 5" */
  boxLabel?: string;
  /** what was typed in the search box (a barcode is not used as the name) */
  initialName?: string;
  onClose: () => void;
  onCreated: (product: ProductUI, receivedPieces: number, barcode?: string) => void;
}) {
  const [data, setData] = useState<{ categories: Category[]; colorOptions: string[]; sizeOptions: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
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
