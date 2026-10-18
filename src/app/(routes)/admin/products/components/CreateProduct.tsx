"use client";
import React from "react";
import ProductForm from "./ProductForm";
import type { Category } from "./CategoriesTab";
import type { ProductUI } from "../services/productService";

interface CreateProductProps {
  categories: Category[];
  colorOptions: string[];
  sizeOptions: string[];
  onManageAttributes?: () => void;
  // Gets the created product (used to open its stickers page)
  onSuccess?: (product?: ProductUI) => void;
}

export default function CreateProduct({
  categories,
  colorOptions,
  sizeOptions,
  onManageAttributes,
  onSuccess
}: CreateProductProps) {
  return (
    <ProductForm
      mode="create"
      categories={categories}
      colorOptions={colorOptions}
      sizeOptions={sizeOptions}
      onManageAttributes={onManageAttributes}
      onSuccess={onSuccess}
    />
  );
}