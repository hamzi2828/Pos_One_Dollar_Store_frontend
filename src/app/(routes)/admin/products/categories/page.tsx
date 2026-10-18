'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CategoriesTab, { type Category, type CategoryWithCount } from '../components/CategoriesTab';
import { categoryService } from '../services/categoryService';
import { productService } from '../services/productService';
import { type Product } from '../components/AllProducts';
import { Loader2, AlertCircle, RefreshCw, Layers, Plus } from 'lucide-react';

const CategoriesPage = () => {
  const router = useRouter();

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);

  // Products for count calculation
  const [products, setProducts] = useState<Product[]>([]);

  // Per-category request in progress (spinner + disabled row actions). The ref is the
  // synchronous lock so a fast double click can't send the same request twice.
  type BusyAction = 'active' | 'delete';
  const [busy, setBusy] = useState<Record<string, BusyAction>>({});
  const busyRef = useRef<Set<string>>(new Set());
  const loadingRef = useRef(false);
  const lockRow = (id: string, action: BusyAction) => {
    if (busyRef.current.has(id)) return false;
    busyRef.current.add(id);
    setBusy((prev) => ({ ...prev, [id]: action }));
    return true;
  };
  const unlockRow = (id: string) => {
    busyRef.current.delete(id);
    setBusy((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Load categories
  const loadCategories = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setCatLoading(true);
    setCatError(null);
    try {
      const list = await categoryService.listCategories();
      setCategories(list as unknown as Category[]);
    } catch (e) {
      console.error('Failed to load categories', e);
      setCatError('Could not fetch categories from server.');
    } finally {
      loadingRef.current = false;
      setCatLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Load products for counts
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const list = await productService.listProducts();
        setProducts(list as unknown as Product[]);
      } catch (e) {
        console.error('Failed to load products for counts', e);
      }
    };
    loadProducts();
  }, []);

  // Listen for openCreateCategory event from layout
  useEffect(() => {
    const handleOpenCreate = () => {
      router.push('/admin/products/categories/create');
    };
    window.addEventListener('openCreateCategory', handleOpenCreate);
    return () => window.removeEventListener('openCreateCategory', handleOpenCreate);
  }, [router]);

  const categoriesWithCount: CategoryWithCount[] = useMemo(
    () =>
      categories.map((cat) => {
        const categoryProducts = products.filter((p) => p.category === cat.name);
        const activeCount = categoryProducts.filter(p => p.status === 'published').length;
        const inactiveCount = categoryProducts.filter(p => p.status === 'draft').length;
        return {
          ...cat,
          count: categoryProducts.length,
          activeCount,
          inactiveCount,
        };
      }),
    [categories, products]
  );

  const openEditCategory = (id: string) => {
    router.push(`/admin/products/categories/edit/${id}`);
  };

  const handleDeleteCategory = async (id: string) => {
    if (busyRef.current.has(id)) return;
    const target = categories.find((c) => c.id === id);
    const confirmed = window.confirm(
      `Are you sure you want to delete "${target?.name ?? 'this category'}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    if (!lockRow(id, 'delete')) return;

    const prev = categories;
    setCategories((p) => p.filter((c) => c.id !== id));
    try {
      await categoryService.deleteCategory(id);
    } catch (e) {
      console.error('Failed to delete category', e);
      setCategories(prev);
      alert('Failed to delete category');
    } finally {
      unlockRow(id);
    }
  };

  const handleToggleActiveCategory = async (id: string) => {
    const target = categories.find((c) => c.id === id);
    if (!target) return;
    if (!lockRow(id, 'active')) return;
    const nextActive = !target.active;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, active: nextActive } : c)));
    try {
      await categoryService.setActive(id, nextActive);
    } catch (e) {
      console.error('Failed to update category status', e);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, active: !nextActive } : c)));
      alert('Failed to update category');
    } finally {
      unlockRow(id);
    }
  };

  const handleReorder = async (reorderedCategories: Category[]) => {
    const prev = categories;
    setCategories(reorderedCategories);
    try {
      await categoryService.reorderCategories(
        reorderedCategories.map((c) => ({ _id: c.id }))
      );
    } catch (e) {
      console.error('Failed to reorder categories', e);
      setCategories(prev);
      alert('Failed to update category order');
    }
  };

  // Header component
  const Header = () => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-6">
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">Categories</h1>
        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
          Organize your products into categories
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={loadCategories}
          disabled={catLoading}
          aria-busy={catLoading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
        >
          <RefreshCw className={`h-4 w-4 ${catLoading ? 'animate-spin' : ''}`} />
          {catLoading ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          onClick={() => router.push('/admin/products/categories/create')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>
    </div>
  );

  // Loading state
  if (catLoading) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <Header />
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-honey-700" />
            <p className="text-xs sm:text-sm text-gray-500">Loading categories...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (catError) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <Header />
        <div className="bg-white rounded-lg sm:rounded-xl border border-red-200 p-3 sm:p-4 md:p-6">
          <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
            <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-red-800">Error loading categories</h3>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-red-600">{catError}</p>
              <button
                onClick={loadCategories}
                disabled={catLoading}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (categories.length === 0) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <Header />
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-6 sm:p-8 md:p-12 text-center">
          <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-sage-200 rounded-full flex items-center justify-center mb-3 sm:mb-4">
            <Layers className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-honey-700" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5 sm:mb-2">No categories yet</h3>
          <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 max-w-sm mx-auto">
            Categories help organize your products and make them easier to find. Create your first category to get started.
          </p>
          <button
            onClick={() => router.push('/admin/products/categories/create')}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Plus className="h-4 w-4" />
            Create Category
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <Header />
      <CategoriesTab
        categories={categoriesWithCount}
        onEdit={openEditCategory}
        onDelete={handleDeleteCategory}
        onToggleActive={handleToggleActiveCategory}
        onReorder={handleReorder}
        busy={busy}
      />
    </div>
  );
};

export default CategoriesPage;
