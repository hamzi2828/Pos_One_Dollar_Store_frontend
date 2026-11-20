'use client';

import ReportsNav from '../components/ReportsNav';
import VendorGoodsReport from './VendorGoodsReport';

export default function VendorGoodsPage() {
  return <VendorGoodsReport nav={<ReportsNav />} />;
}
