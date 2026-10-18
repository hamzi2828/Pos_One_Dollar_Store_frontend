"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import ProductForm from "./ProductForm";
import type { Product } from "./AllProducts";
import type { Category } from "./CategoriesTab";
import { productService } from "../services/productService";

interface EditProductProps {
  productId: string;
  categories: Category[];
  colorOptions: string[];
  sizeOptions: string[];
  onManageAttributes?: () => void;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function EditProduct({
  productId,
  categories,
  colorOptions,
  sizeOptions,
  onManageAttributes,
  onCancel,
  onSuccess
}: EditProductProps) {
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);

  // Load product data - only when productId changes
  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        const data = await productService.getProductById(productId);
        setProduct(data);
      } catch (error) {
        console.error("Failed to load product:", error);
        onCancel();
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      loadProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12">
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Product not found</h3>
              <p className="mt-1 text-sm text-red-600">
                The product you're looking for doesn't exist or has been deleted.
              </p>
            </div>
            <Link
              href="/admin/products"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProductForm
      mode="edit"
      initialData={product}
      categories={categories}
      colorOptions={colorOptions}
      sizeOptions={sizeOptions}
      onCancel={onCancel}
      onSuccess={onSuccess}
      onManageAttributes={onManageAttributes}
    />
  );
}
