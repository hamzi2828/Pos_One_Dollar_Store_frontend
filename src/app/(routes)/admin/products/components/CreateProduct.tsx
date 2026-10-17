"use client";
import React from "react";
import ProductForm from "./ProductForm";
import type { Category } from "./CategoriesTab";
import type { ProductUI } from "../services/productService";

interface Guideline {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  active: boolean;
}

interface CreateProductProps {
  categories: Category[];
  colorOptions: string[];
  sizeOptions: string[];
  guidelines?: Guideline[];
  onManageAttributes?: () => void;
  // Gets the created product (used to open its stickers page)
  onSuccess?: (product?: ProductUI) => void;
}

export default function CreateProduct({
  categories,
  colorOptions,
  sizeOptions,
  guidelines = [],
  onManageAttributes,
  onSuccess
}: CreateProductProps) {
  return (
    <ProductForm
      mode="create"
      categories={categories}
      colorOptions={colorOptions}
      sizeOptions={sizeOptions}
      guidelines={guidelines}
      onManageAttributes={onManageAttributes}
      onSuccess={onSuccess}
    />
  );
}