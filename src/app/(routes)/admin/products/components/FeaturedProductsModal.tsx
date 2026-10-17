"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { X, Loader2, Search, Package, Check } from "lucide-react";
import { categoryService } from "../services/categoryService";

interface CategoryProduct {
  _id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: string;
  thumbnailUrl?: string;
}

interface FeaturedProductsModalProps {
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function FeaturedProductsModal({
  categoryId,
  categoryName,
  onClose,
  onSaved,
}: FeaturedProductsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { products: list, featuredProductIds } =
          await categoryService.listCategoryProducts(categoryId);
        if (cancelled) return;
        setProducts(list as CategoryProduct[]);
        setSelected(new Set(featuredProductIds));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setError("Failed to load products for this category.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await categoryService.setFeaturedProducts(categoryId, Array.from(selected));
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save featured products");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Featured Products
            </h2>
            <p className="text-xs text-gray-500">
              Pick products to feature for{" "}
              <span className="font-medium text-gray-700">{categoryName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-honey-500 focus:border-honey-500"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {selected.size} selected · {filtered.length} showing
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-honey-500" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-600 py-8 text-center">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {products.length === 0
                  ? "This category has no products yet."
                  : "No products match your search."}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((p) => {
                const isSelected = selected.has(p._id);
                return (
                  <li key={p._id}>
                    <button
                      type="button"
                      onClick={() => toggle(p._id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                        isSelected
                          ? "border-honey-500 bg-honey-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="relative h-12 w-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                        {p.thumbnailUrl ? (
                          <Image
                            src={p.thumbnailUrl}
                            alt={p.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-gray-400">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          ${p.price} · stock {p.stock} · {p.status}
                        </p>
                      </div>
                      <div
                        className={`h-5 w-5 flex items-center justify-center rounded-md border-2 flex-shrink-0 transition-colors ${
                          isSelected
                            ? "bg-honey-500 border-honey-500"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-honey-500 rounded-md hover:bg-honey-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Featured Products
          </button>
        </div>
      </div>
    </div>
  );
}
