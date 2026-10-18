'use client';

import { useEffect, useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';
import AllProducts, { type Product } from './components/AllProducts';
import { productService, type ProductFilters } from './services/productService';
import toast from 'react-hot-toast';

const ProductsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copyingProduct, setCopyingProduct] = useState<Set<string>>(new Set());
  const [deletingProduct, setDeletingProduct] = useState<Set<string>>(new Set());
  // Synchronous locks so a fast double click can't fire the same request twice
  const refreshLockRef = useRef(false);
  const busyIdsRef = useRef<Set<string>>(new Set());
  const addId = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => new Set([...prev, id]));
  const removeId = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // Get filters from URL
  const filters: ProductFilters = {
    status: searchParams.get('status') || undefined,
    category: searchParams.get('category') || undefined,
    search: searchParams.get('search') || undefined,
  };

  // Loader to fetch products with filters
  const loadProducts = useCallback(async (filterParams?: ProductFilters) => {
    setProdLoading(true);
    setProdError(null);
    try {
      const list = await productService.listProducts(filterParams);
      setProducts(list as unknown as Product[]);
    } catch (e) {
      console.error('Failed to load products', e);
      setProdError('Could not fetch products from server.');
    } finally {
      setProdLoading(false);
    }
  }, []);

  // Load products when filters change
  useEffect(() => {
    loadProducts(filters);
  }, [searchParams]);

  const handleRefresh = async () => {
    if (refreshLockRef.current) return;
    refreshLockRef.current = true;
    setRefreshing(true);
    try {
      await loadProducts(filters);
    } finally {
      refreshLockRef.current = false;
      setRefreshing(false);
    }
  };

  // Edit product handler - navigate to edit page
  const handleEditProduct = (id: string) => {
    router.push(`/admin/products/edit/${id}`);
  };

  // Delete product with confirm, optimistic UI, and refetch
  const handleDeleteProduct = async (id: string) => {
    const lockKey = `delete:${id}`;
    if (busyIdsRef.current.has(lockKey)) return;
    if (!confirm('Are you sure you want to delete this product?')) return;
    busyIdsRef.current.add(lockKey);
    addId(setDeletingProduct, id);
    const prev = products;
    setProducts((p) => p.filter((x) => x.id !== id));
    try {
      await productService.deleteProduct(id);
      await loadProducts();
      toast.success('Product deleted successfully');
    } catch (e) {
      console.error('Failed to delete product', e);
      setProducts(prev);
      toast.error('Failed to delete product');
    } finally {
      busyIdsRef.current.delete(lockKey);
      removeId(setDeletingProduct, id);
    }
  };

  // Toggle product status handler
  const handleToggleProductStatus = async (id: string, newStatus: 'published' | 'draft') => {
    const prev = products;
    setProducts((p) => p.map((x) => x.id === id ? { ...x, status: newStatus } : x));
    try {
      await productService.toggleProductStatus(id, newStatus);
      toast.success(`Product ${newStatus === 'published' ? 'published' : 'unpublished'} successfully`);
    } catch (e) {
      console.error('Failed to toggle product status', e);
      setProducts(prev);
      toast.error('Failed to update product status');
    }
  };

  // Copy/Duplicate product handler
  const handleCopyProduct = async (id: string) => {
    const lockKey = `copy:${id}`;
    if (busyIdsRef.current.has(lockKey)) return;
    busyIdsRef.current.add(lockKey);
    setCopyingProduct((prev) => new Set([...prev, id]));
    try {
      const duplicated = await productService.duplicateProduct(id);
      toast.success('Product duplicated successfully');
      // Refresh product list to show the new product
      await loadProducts();
      // Optionally navigate to edit the duplicated product
      router.push(`/admin/products/edit/${duplicated.id}`);
    } catch (e) {
      console.error('Failed to duplicate product', e);
      toast.error('Failed to duplicate product');
    } finally {
      busyIdsRef.current.delete(lockKey);
      setCopyingProduct((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Products</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            Manage your product catalog
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <Link
            href="/admin/products/create"
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </div>
      </div>

      <AllProducts
        products={products}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        onCopy={handleCopyProduct}
        onToggleStatus={handleToggleProductStatus}
        loading={prodLoading}
        error={prodError}
        copyingProduct={copyingProduct}
        deletingProduct={deletingProduct}
        onStockChanged={() => loadProducts(filters)}
      />
    </div>
  );
};

export default ProductsPage;
