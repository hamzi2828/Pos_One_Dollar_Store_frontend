import React from 'react';
import Link from 'next/link';
import { useCurrency } from '@/context/CurrencyContext';

interface Product {
  id: string;
  name: string;
  sales: number;
  revenue: number;
  stock: number;
}

interface TopProductsProps {
  products: Product[];
}

export const TopProducts: React.FC<TopProductsProps> = ({ products }) => {
  const { formatPrice } = useCurrency();
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { text: 'Out of Stock', color: 'text-red-600 bg-red-100' };
    if (stock < 10) return { text: 'Low Stock', color: 'text-yellow-600 bg-yellow-100' };
    return { text: 'In Stock', color: 'text-green-600 bg-green-100' };
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-white rounded-lg sm:rounded-xl shadow">
      <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
        <h2 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Top Products</h2>
        <Link href="/admin/products" className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          View All
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                Product
              </th>
              <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                Sales
              </th>
              <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                Revenue
              </th>
              <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                Stock
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product, index) => {
              const stockStatus = getStockStatus(product.stock);
              return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gray-200 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-600">
                        {index + 1}
                      </span>
                      <Link href={`/admin/products/edit/${product.id}`} className="ml-2 sm:ml-3 text-xs sm:text-sm font-medium text-gray-900 hover:text-indigo-600">
                        {product.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-center text-gray-500 whitespace-nowrap">
                    {product.sales}
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-900 font-medium whitespace-nowrap">
                    {formatPrice(product.revenue || 0)}
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-center whitespace-nowrap">
                    <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${stockStatus.color}`}>
                      {product.stock} units
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};