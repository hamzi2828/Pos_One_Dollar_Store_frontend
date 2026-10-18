"use client";
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  ProductStats,
  ProductFilters,
  ProductCard,
  ProductPagination,
  EmptyState,
  LoadingState,
  ErrorState,
  CodeFinder
} from "./all_products";
import { categoryService } from "../services/categoryService";
import ReceiveStockModal from "./stock/ReceiveStockModal";
import { useCodeSummaries } from "./stock/useCodeSummaries";
import ProductInsightPanel from "@/components/store/ProductInsightPanel";

export interface ProductVariant {
  color: string;
  size: string;
  price: number;
  stock: number;
  sku?: string;
  costPrice?: number;
  discountedPrice?: number;
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  category: string;
  price: number;
  discountedPrice?: number;
  costPrice?: number;
  stock: number;
  status: "published" | "draft" | "out_of_stock";
  // Deprecated: kept for backward compatibility
  image?: string;
  // New fields
  thumbnailUrl?: string;
  bannerUrls?: string[];
  videoUrl?: string;
  // Description fields
  description?: string;
  shortDescription?: string;
  features?: string;
  // Tags
  tags?: string[];
  // Variants (optional)
  productType?: "single" | "variant";
  variants?: ProductVariant[];
  // Color media for variant products
  colorMedia?: Record<string, {
    thumbnailUrl?: string;
    bannerUrls?: string[];
    videoUrl?: string;
  }>;
  // Color for single products
  color?: string;
  // SKU for single products
  sku?: string;
  // Dimensions (L x W x H) and weight
  dimensionLength?: string;
  dimensionWidth?: string;
  dimensionHeight?: string;
  weight?: string;
  // Date added
  createdAt?: string;
}

interface AllProductsProps {
  products: Product[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCopy?: (id: string) => void;
  onToggleStatus?: (id: string, newStatus: 'published' | 'draft') => Promise<void>;
  loading?: boolean;
  error?: string | null;
  copyingProduct?: Set<string>;
  /** ids of products currently being deleted */
  deletingProduct?: Set<string>;
  /** called after stock was received, to reload the list */
  onStockChanged?: () => void;
}

export default function AllProducts({
  products,
  onEdit,
  onDelete,
  onCopy,
  onToggleStatus,
  loading = false,
  error = null,
  copyingProduct = new Set(),
  deletingProduct = new Set(),
  onStockChanged
}: AllProductsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read filters from URL params
  const searchQuery = searchParams.get("search") || "";
  const statusFilter = (searchParams.get("status") as "all" | "published" | "draft" | "out_of_stock") || "all";
  const categoryFilter = searchParams.get("category") || "all";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  const [togglingStatus, setTogglingStatus] = useState<Set<string>>(new Set());
  // Synchronous lock: blocks a second status toggle for the same product before re-render
  const togglingStatusRef = useRef<Set<string>>(new Set());
  const productsPerPage = 12;

  // Stickers / receive stock
  const codeSummaries = useCodeSummaries(products);
  const [receiveFor, setReceiveFor] = useState<{ id: string; variantId?: string | null } | null>(null);
  // Product insight slide-over (price history, vendors, stock)
  const [insightFor, setInsightFor] = useState<string | null>(null);
  const closeInsight = useCallback(() => setInsightFor(null), []);
  const openStickers = useCallback(
    (id: string, opts?: { variantId?: string | null; batchNo?: string | null }) => {
      const q = new URLSearchParams();
      if (opts?.variantId) q.set("variantId", opts.variantId);
      if (opts?.batchNo) {
        q.set("type", "batch");
        q.set("batchNo", opts.batchNo);
      }
      const qs = q.toString();
      router.push(`/admin/products/stickers/${id}${qs ? `?${qs}` : ""}`);
    },
    [router]
  );
  const receiveModal = receiveFor && (
    <ReceiveStockModal
      productId={receiveFor.id}
      productName={products.find((p) => p.id === receiveFor.id)?.name}
      initialVariantId={receiveFor.variantId}
      onClose={(changed) => {
        setReceiveFor(null);
        if (changed) onStockChanged?.();
      }}
    />
  );

  // Update URL params
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all" || (key === "page" && value === "1")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  // Setters that update URL
  const setSearchQuery = useCallback((query: string) => {
    updateUrlParams({ search: query, page: "1" });
  }, [updateUrlParams]);

  const setStatusFilter = useCallback((status: "all" | "published" | "draft" | "out_of_stock") => {
    updateUrlParams({ status, page: "1" });
  }, [updateUrlParams]);

  const setCategoryFilter = useCallback((category: string) => {
    updateUrlParams({ category, page: "1" });
  }, [updateUrlParams]);

  const setCurrentPage = useCallback((page: number) => {
    updateUrlParams({ page: page.toString() });
  }, [updateUrlParams]);

  // Fetch the full category list from the API (not just ones present in loaded products)
  const [fetchedCategories, setFetchedCategories] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await categoryService.listCategories();
        if (!mounted) return;
        const names = list.filter((c) => !c.parentId).map((c) => c.name).sort((a, b) => a.localeCompare(b));
        setFetchedCategories(names);
      } catch (e) {
        console.error("Failed to load categories for filter", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Merge API categories with any categories that exist on products but weren't
  // returned by the list endpoint (defensive — avoids hiding product categories).
  const availableCategories = useMemo(() => {
    const fromProducts = products.map((p) => p.category).filter(Boolean);
    const union = new Set<string>([...fetchedCategories, ...fromProducts]);
    return Array.from(union).sort((a, b) => a.localeCompare(b));
  }, [products, fetchedCategories]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.slug?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" ||
                           (statusFilter === "out_of_stock" ? product.stock <= 0 : product.status === statusFilter);
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [products, searchQuery, statusFilter, categoryFilter]);

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage) || 1;

  const handleToggleStatus = async (productId: string, currentStatus: 'published' | 'draft' | 'out_of_stock') => {
    if (!onToggleStatus || currentStatus === 'out_of_stock') return;
    if (togglingStatusRef.current.has(productId)) return;
    togglingStatusRef.current.add(productId);

    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    setTogglingStatus(prev => new Set([...prev, productId]));

    try {
      await onToggleStatus(productId, newStatus);
    } catch (error) {
      console.error('Failed to toggle product status:', error);
    } finally {
      togglingStatusRef.current.delete(productId);
      setTogglingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };


  const resetCurrentPage = () => setCurrentPage(1);

  const handleClearAllFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  // Loading state
  if (loading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Statistics */}
      <ProductStats
        products={products}
        filteredCount={filteredProducts.length}
      />

      {/* Filters */}
      <ProductFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        availableCategories={availableCategories}
        onCurrentPageReset={resetCurrentPage}
        onClearFilters={handleClearAllFilters}
      />

      {/* Find by code */}
      <CodeFinder
        onStickers={openStickers}
        onEdit={(id) => (onEdit ? onEdit(id) : router.push(`/admin/products/edit/${id}`))}
        onReceiveStock={(id, variantId) => setReceiveFor({ id, variantId })}
      />

      {/* Products Grid */}
      {currentProducts.length > 0 ? (
        <div className="grid grid-cols-6 gap-2">
          {currentProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={onEdit}
              onDelete={onDelete}
              onCopy={onCopy}
              onToggleStatus={onToggleStatus}
              togglingStatus={togglingStatus}
              copyingProduct={copyingProduct}
              deletingProduct={deletingProduct}
              handleToggleStatus={handleToggleStatus}
              codeSummary={codeSummaries[product.id]}
              onStickers={(id) => openStickers(id)}
              onReceiveStock={(id) => setReceiveFor({ id })}
              onInsights={setInsightFor}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          categoryFilter={categoryFilter}
          onClearFilters={handleClearAllFilters}
        />
      )}

      {/* Pagination */}
      <ProductPagination
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
        filteredCount={filteredProducts.length}
        indexOfFirstProduct={indexOfFirstProduct}
        indexOfLastProduct={indexOfLastProduct}
      />

      {receiveModal}
      <ProductInsightPanel productId={insightFor} open={!!insightFor} onClose={closeInsight} />
    </div>
  );
}
