'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Edit2 } from 'lucide-react';
import EditProduct from '../../components/EditProduct';
import { type Category } from '../../components/CategoriesTab';
import { loadCreateTabData } from '../../services/productOptionsService';
import toast from 'react-hot-toast';

const EditProductPage = () => {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  // Categories and options state
  const [categories, setCategories] = useState<Category[]>([]);
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [sizeOptions, setSizeOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data for edit form
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { categories: cats, colorOptions: co, sizeOptions: so } = await loadCreateTabData();
        setCategories(cats as unknown as Category[]);
        setColorOptions(co);
        setSizeOptions(so);
      } catch (e) {
        console.error('Failed to load edit tab data', e);
        toast.error('Failed to load form data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <Link
            href="/admin/products"
            className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">Edit Product</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">Update product information</p>
          </div>
        </div>

        {/* Loading State */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-6 sm:p-8 md:p-12">
          <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-gray-400" />
            <p className="text-xs sm:text-sm text-gray-500">Loading product data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <Link
            href="/admin/products"
            className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">Edit Product</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">Update product information and settings</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 ml-11 sm:ml-0">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-yellow-50 text-yellow-700 rounded-lg text-xs sm:text-sm">
            <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Editing</span>
          </div>
        </div>
      </div>

      <EditProduct
        productId={productId}
        categories={categories.filter((c) => c.active)}
        colorOptions={colorOptions}
        sizeOptions={sizeOptions}
        onManageAttributes={() => router.push('/admin/products/attributes')}
        onCancel={() => router.push('/admin/products')}
        onSuccess={() => {
          toast.success('Product updated successfully');
          setTimeout(() => router.push('/admin/products'), 1000);
        }}
      />
    </div>
  );
};

export default EditProductPage;
