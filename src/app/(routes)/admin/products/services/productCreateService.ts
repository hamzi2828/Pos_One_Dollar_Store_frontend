// src/app/(routes)/admin/products/services/productCreateService.ts

import type { Product } from "../components/AllProducts";

// Common type that can be used for Product
export type ProductBase = {
  name: string;
  category: string;
  thumbnailUrl?: string;
  bannerUrls?: string[];
  status: 'published' | 'draft' | 'out_of_stock';
  productType: 'single' | 'variant';
};

export type ProductStatus = 'published' | 'draft' | 'out_of_stock';
export type ProductType = 'single' | 'variant';

export interface Variant {
  color: string;
  size: string;
  price: number;
  stock: number;
  sku?: string;
  discountedPrice?: number;
  // Barcode / option fields (kept as-is when the color/size selection changes)
  variantId?: string;
  attributes?: Record<string, string>;
  shortCode?: string;
  barcodes?: Array<{ code: string; qty: number; label?: string }>;
  [key: string]: unknown;
}

// Common type that can be used for Product
export type ProductFormLike = Product;

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Color x size combinations. If only colors (or only sizes) are picked, one
// variant per color (or size) — e.g. a phone with colors only, and Storage/RAM
// set per variant as free options.
export function buildVariantCombos(colors: string[], sizes: string[]): Array<Pick<Variant, 'color' | 'size'>> {
  if (!Array.isArray(colors) || !Array.isArray(sizes)) return [];
  const c = colors.filter(Boolean);
  const s = sizes.filter(Boolean);
  if (c.length === 0 && s.length === 0) return [];
  if (s.length === 0) return c.map((color) => ({ color, size: '' }));
  if (c.length === 0) return s.map((size) => ({ color: '', size }));
  return c.flatMap((color) => s.map((size) => ({ color, size })));
}

export function syncVariants(existing: Variant[] | undefined, combos: Array<Pick<Variant, 'color' | 'size'>>): Variant[] {
  const prev = existing ?? [];
  return combos.map(({ color, size }) => {
    const match = prev.find((v) => (v.color || '') === color && (v.size || '') === size);
    // Keep everything the variant already had (variantId, costPrice, short code,
    // barcodes, batches, options...) so editing the selection never loses codes.
    return {
      ...(match || {}),
      color,
      size,
      price: match?.price ?? 0,
      stock: match?.stock ?? 0,
      sku: match?.sku,
      discountedPrice: match?.discountedPrice,
    };
  });
}

export function validateProduct(form: ProductFormLike, isVariant: boolean, selectedColors: string[], selectedSizes: string[]): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.name || form.name.trim().length === 0) errors.name = 'Name is required';
  if (!form.category || form.category.trim().length === 0) errors.category = 'Category is required';

  if (!isVariant) {
    if (form.price < 0) errors.price = 'Price must be ≥ 0';
    if (form.stock < 0) errors.stock = 'Stock must be ≥ 0';
    if (form.discountedPrice !== undefined && form.discountedPrice !== null) {
      if (form.discountedPrice < 0) errors.discountedPrice = 'Discounted price must be ≥ 0';
      else if (form.discountedPrice > form.price) errors.discountedPrice = 'Discounted price must be ≤ price';
    }
  } else {
    if (selectedColors.length === 0 && selectedSizes.length === 0) {
      errors.variants = 'Select at least one color or one size';
    }
    if (!form.variants || form.variants.length === 0) {
      errors.variants = errors.variants || 'Add at least one variant';
    }
    if (form.variants && form.variants.some((v) => v.price < 0)) {
      errors.variants = 'Variant prices must be ≥ 0';
    }
    if (form.variants && form.variants.some((v) => v.stock < 0)) {
      errors.variants = 'Variant stock must be ≥ 0';
    }
    if (form.variants && form.variants.some((v) => v.discountedPrice !== undefined && v.discountedPrice !== null && v.discountedPrice < 0)) {
      errors.variants = 'Variant discounted prices must be ≥ 0';
    }
    if (form.variants && form.variants.some((v) => v.discountedPrice !== undefined && v.discountedPrice !== null && v.discountedPrice > v.price)) {
      errors.variants = 'Variant discounted price must be ≤ price';
    }
  }

  if (!form.thumbnailUrl) errors.thumbnail = 'Thumbnail is required';
  if (form.bannerUrls && form.bannerUrls.length > 5) errors.banners = 'You can upload up to 5 banner images';

  return errors;
}
