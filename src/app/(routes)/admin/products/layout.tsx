'use client';

import ProductsNav from './components/ProductsNav';

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 overflow-x-hidden">
      <ProductsNav />
      {children}
    </div>
  );
}
