"use client";
import React from "react";
import { Package, CheckCircle, FileEdit, Layers, AlertTriangle } from "lucide-react";
import { Product } from "../AllProducts";

interface ProductStatsProps {
  products: Product[];
  filteredCount: number;
}

export default function ProductStats({ products, filteredCount }: ProductStatsProps) {
  const publishedCount = products.filter(p => p.status === 'published').length;
  const draftCount = products.filter(p => p.status === 'draft').length;
  const variantCount = products.filter(p => p.productType === 'variant').length;
  const outOfStockCount = products.filter(p => p.status === 'out_of_stock' || p.stock === 0).length;

  const stats = [
    {
      name: 'Total Products',
      value: products.length,
      icon: Package,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      name: 'Published',
      value: publishedCount,
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      name: 'Draft',
      value: draftCount,
      icon: FileEdit,
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
    },
    {
      name: 'Variants',
      value: variantCount,
      icon: Layers,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      name: 'Out of Stock',
      value: outOfStockCount,
      icon: AlertTriangle,
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.name}
            className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-2 sm:p-4 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">{stat.name}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
