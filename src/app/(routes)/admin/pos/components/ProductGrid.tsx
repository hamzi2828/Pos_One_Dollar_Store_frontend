// Product Grid Component - Row/Table view like products page
'use client';

import { useState, useEffect, useMemo } from 'react';
import { POSProduct } from '../types';
import { LayoutGrid, Package, Plus, ShoppingCart, Loader2, Info, MapPin } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currency';

interface ProductGridProps {
  products: POSProduct[];
  onSelectProduct: (product: POSProduct) => void;
  loading?: boolean;
  currency?: string;
  searchQuery?: string;
  /** Search text the products on screen belong to (can lag while searching). */
  resultsQuery?: string;
  /** "i" button: product history / vendors / stock panel. */
  onShowInsight?: (product: POSProduct) => void;
}

export default function ProductGrid({
  products,
  onSelectProduct,
  loading = false,
  currency = 'PKR',
  searchQuery = '',
  resultsQuery,
  onShowInsight,
}: ProductGridProps) {
  const shownQuery = resultsQuery ?? searchQuery;
  const [selectedCategory, setSelectedCategory] = useState<string>('__all__');
  const [view, setView] = useState<'categories' | 'products' | null>(null);

  const symbol = getCurrencySymbol(currency);

  // Reset to categories view when search query changes
  useEffect(() => {
    if (searchQuery) {
      setSelectedCategory('__all__');
    }
  }, [searchQuery]);

  // Article = one piece in stock (one sticker): stock x pieces per sale, variants added up.
  const articlesOf = (list: POSProduct[]) =>
    list.reduce((n, p) => {
      const stock = p.productType === 'variant' && p.variants?.length ? p.variants.reduce((t, v) => t + Math.max(0, Number(v.stock) || 0), 0) : Math.max(0, Number(p.stock) || 0);
      return n + stock * Math.max(1, p.piecesPerSale || 1);
    }, 0);
  const totalArticles = useMemo(() => articlesOf(products), [products]);

  // Group products by category
  const categories = useMemo(() => {
    const map = new Map<string, POSProduct[]>();
    for (const product of products) {
      const cat = product.category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(product);
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, count: items.length, articles: articlesOf(items), products: items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const filteredProducts = selectedCategory === '__all__'
    ? products
    : products.filter(p => (p.category || 'Uncategorized') === selectedCategory);

  // Product Row Component
  const ProductRow = ({ product }: { product: POSProduct }) => {
    // Same rule as the server: the sale price when set and lower, else the price.
    const hasDiscount = !!product.discountedPrice && product.discountedPrice > 0 && product.discountedPrice < product.price;
    const displayPrice = hasDiscount ? (product.discountedPrice as number) : product.price;
    const shelves = product.shelfCodes || [];

    return (
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => onSelectProduct(product)}
      >
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-2">
            {product.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.thumbnailUrl}
                alt={product.name}
                className="w-8 h-8 rounded object-cover bg-gray-100"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                <Package className="h-4 w-4 text-gray-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {product.productType === 'variant' && (
                  <span className="text-xs text-honey-700">Has variants</span>
                )}
                {shelves.slice(0, 3).map((code) => (
                  <span key={code} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold" title="Shelf">
                    <MapPin className="h-2.5 w-2.5" />
                    {code}
                  </span>
                ))}
                {shelves.length > 3 && <span className="text-[10px] text-gray-400">+{shelves.length - 3}</span>}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {product.category || 'Uncategorized'}
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          <div>
            <span className="font-semibold text-gray-900 text-sm">
              {symbol}{displayPrice.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through ml-1">
                {symbol}{product.price.toLocaleString()}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-center">
          <span className={`text-sm font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {product.stock}
          </span>
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          {onShowInsight && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowInsight(product);
              }}
              className="p-2 mr-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Product history: prices, vendors, stock"
              aria-label="Product history"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectProduct(product);
            }}
            className="p-1.5 bg-honey-500 text-gray-900 rounded-lg hover:bg-honey-600 transition-colors"
            aria-label="Add to cart"
          >
            <Plus className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  };

  // Products Table Component
  const ProductsTable = ({ productsList }: { productsList: POSProduct[] }) => (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Add</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {productsList.map((product) => (
            <ProductRow key={product._id} product={product} />
          ))}
        </tbody>
      </table>
    </div>
  );

  // Loading with nothing on screen yet (first load, or after "no results")
  if (loading && products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden" role="status" aria-live="polite">
        <div className="flex items-center justify-center gap-2 py-6 text-sm font-medium text-honey-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          {searchQuery ? <>Searching for &ldquo;{searchQuery}&rdquo;…</> : 'Loading products…'}
        </div>
        <div className="animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-50 border-t border-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  // Loading while old results are showing: keep them, faded, under a banner
  if (loading) {
    return (
      <div className="relative" aria-busy="true">
        <div className="sticky top-0 z-10 mb-3 flex justify-center">
          <div role="status" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-honey-700 shadow-md ring-1 ring-red-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            {searchQuery ? <>Searching for &ldquo;{searchQuery}&rdquo;…</> : 'Loading products…'}
          </div>
        </div>
        <div className="pointer-events-none select-none opacity-40 transition-opacity">
          {renderResults()}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg">
        <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-lg">
          {shownQuery ? <>No products found for &ldquo;{shownQuery}&rdquo;</> : 'No products found'}
        </p>
        <p className="text-gray-400 text-sm mt-2">
          Try another name, the short code, or scan the barcode
        </p>
      </div>
    );
  }

  return renderResults();

  function renderResults() {
  // If user is searching, show flat product table (no category grouping)
  if (shownQuery) {
    return <ProductsTable productsList={products} />;
  }

  // Nothing shown until asked: two buttons open the categories or all products.
  const btn = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-honey-500 hover:text-honey-800'
    }`;
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
      active ? 'border-honey-600 bg-honey-100 text-honey-900' : 'border-gray-200 bg-white text-gray-700 hover:border-honey-500'
    }`;
  const pickedCat = selectedCategory !== '__all__' ? selectedCategory : null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setView(view === 'categories' ? null : 'categories'); setSelectedCategory('__all__'); }} className={btn(view === 'categories')}>
          <LayoutGrid className="h-4 w-4" /> Categories <span className="opacity-60">{categories.length}</span>
        </button>
        <button type="button" onClick={() => { setView(view === 'products' ? null : 'products'); setSelectedCategory('__all__'); }} className={btn(view === 'products')} title={`${totalArticles.toLocaleString()} articles in stock`}>
          <Package className="h-4 w-4" /> All products <span className="opacity-60">{products.length}</span>
        </button>
        {view && (
          <button type="button" onClick={() => setView(null)} className="text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline">
            Hide
          </button>
        )}
      </div>

      {!view && <p className="mt-6 text-center text-sm text-gray-400">Scan a barcode or search above. Open Categories or All products only if you need to look.</p>}

      {view === 'categories' && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setSelectedCategory(pickedCat === cat.name ? '__all__' : cat.name)}
                className={chip(pickedCat === cat.name)}
                title={`${cat.count} item${cat.count !== 1 ? 's' : ''} · ${cat.articles.toLocaleString()} articles`}
              >
                {cat.name} <span className="opacity-60">{cat.count}</span>
              </button>
            ))}
          </div>
          {pickedCat && (
            <div className="mt-3">
              <ProductsTable productsList={filteredProducts} />
            </div>
          )}
        </div>
      )}

      {view === 'products' && (
        <div className="mt-3">
          <ProductsTable productsList={products} />
        </div>
      )}
    </div>
  );
  }
}
