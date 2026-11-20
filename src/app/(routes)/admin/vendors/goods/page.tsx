'use client';

// Vendors → Goods by Vendor (owner 2026-11-20): the same report as Reports → Goods by Vendor.
import VendorGoodsReport from '../../reports/vendor-goods/VendorGoodsReport';
import { VendorsNav } from '../components/ui';

export default function VendorsGoodsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <VendorGoodsReport nav={<VendorsNav />} />
      </div>
    </div>
  );
}
