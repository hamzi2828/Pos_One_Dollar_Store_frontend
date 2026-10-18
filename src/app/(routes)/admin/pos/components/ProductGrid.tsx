// Product Grid Component - Row/Table view like products page
'use client';

import { useState, useEffect, useMemo } from 'react';
import { POSProduct } from '../types';
import { LayoutGrid, ChevronLeft, Package, Plus, ShoppingCart, Loader2, Info, MapPin } from 'lucide-react';
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const symbol = getCurrencySymbol(currency);

  // Reset to categories view when search query changes
  useEffect(() => {
    if (searchQuery) {
      setSelectedCategory(null);
    }
  }, [searchQuery]);

  // Group products by category
  const categories = useMemo(() => {
    const map = new Map<string, POSProduct[]>();
    for (const product of products) {
      const cat = product.category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(product);
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, count: items.length, products: items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const filteredProducts = selectedCategory === '__all__'
    ? products
    : selectedCategory
      ? products.filter(p => (p.category || 'Uncategorized') === selectedCategory)
      : [];

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
        <td className="px-3 py-2">
          <div className="flex items-center gap-3">
            {product.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.thumbnailUrl}
                alt={product.name}
                className="w-10 h-10 rounded-lg object-cover bg-gray-100"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-gray-400" />
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
            className="p-2 bg-honey-500 text-gray-900 rounded-lg hover:bg-honey-600 transition-colors"
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

  // Category products view
  if (selectedCategory) {
    return (
      <div>
        {/* Back button + category header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedCategory === '__all__' ? 'All Products' : selectedCategory}
            </h2>
            <p className="text-xs text-gray-500">{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Products table */}
        <ProductsTable productsList={filteredProducts} />
      </div>
    );
  }

  // Categories view
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <LayoutGrid className="h-5 w-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
        <span className="text-sm text-gray-400">({categories.length})</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* All Products tile */}
        <button
          onClick={() => setSelectedCategory('__all__')}
          className="bg-gray-950 rounded-xl p-4 text-left hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group"
        >
          <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mb-3">
            <Package className="h-6 w-6 text-honey-400" />
          </div>
          <h3 className="font-semibold text-white text-sm">All Products</h3>
          <p className="text-white/70 text-xs mt-1">{products.length} items</p>
        </button>

        {/* Category tiles */}
        {categories.map((cat) => {
          // Get first product thumbnail for the category
          const firstProduct = cat.products.find(p => p.thumbnailUrl);
          const thumbnail = firstProduct?.thumbnailUrl;

          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:shadow-lg transition-all duration-200 hover:border-honey-500 hover:scale-[1.02] group relative overflow-hidden"
            >
              {/* Category thumbnail */}
              {thumbnail ? (
                <div className="w-12 h-12 rounded-lg mb-3 overflow-hidden bg-gray-100 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnail}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <LayoutGrid className="h-6 w-6 text-gray-400 group-hover:text-honey-700 transition-colors" />
                </div>
              )}
              <h3 className="font-semibold text-gray-900 text-sm group-hover:text-honey-700 transition-colors">
                {cat.name}
              </h3>
              <p className="text-gray-500 text-xs mt-1">{cat.count} item{cat.count !== 1 ? 's' : ''}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
  }
}
