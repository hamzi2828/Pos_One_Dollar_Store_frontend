// Owner's dashboard data: GET /dashboard?range=today|yesterday|7d|30d|month|year
// All dates are shop time (Asia/Karachi). Blocks the user may not open come back null / empty.
import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

export type RangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'year';

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
];

export interface Kpis {
  sales: number;
  profit: number;
  marginPct: number | null;
  bills: number;
  avgBill: number;
  items: number;
  itemsPerBill: number;
  discounts: number;
  giftCost: number;
  regularCustomers: number;
}

export interface TrendPoint {
  key: string;
  label: string;
  sales: number;
  profit: number;
  bills: number;
}

export interface HourPoint {
  hour: number;
  label: string;
  sales: number;
  bills: number;
}

export interface PaymentRow {
  method: string;
  label: string;
  amount: number;
  bills: number;
  unpaid: number;
}

export interface TopProduct {
  id: string;
  name: string;
  code: string;
  category: string;
  qty: number;
  revenue: number;
  profit: number;
  marginPct: number | null;
  stock: number;
}

export interface TopCategory {
  category: string;
  revenue: number;
  qty: number;
  profit: number;
  sharePct: number | null;
}

export interface RecentBill {
  id: string;
  orderNumber: string;
  customerName: string;
  cashierName: string;
  total: number;
  pendingAmount: number;
  items: number;
  paymentMethod: string;
  status: 'paid' | 'unpaid' | 'refunded';
  createdAt: string;
}

export type AttentionLevel = 'critical' | 'warning' | 'info' | 'ok';

export interface AttentionItem {
  key: string;
  label: string;
  hint: string;
  count: number;
  amount?: number;
  level: AttentionLevel;
  href: string;
}

export interface StockSnapshot {
  skus: number;
  outOfStock: number;
  pieces: number;
  shelvedPieces: number;
  warehousePieces: number;
  shelvesUsed: number;
  shelvesTotal: number;
  valueAtCost: number;
  valueAtPrice: number;
  potentialProfit: number;
  itemsWithoutCost: number;
  consignmentPieces: number;
  consignmentValue: number;
}

export interface TillsNow {
  open: { id: string; counterName: string; cashierName: string; openedAt: string; lateOpen: boolean }[];
  toVerify: number;
}

export interface DashboardData {
  range: {
    key: RangeKey;
    label: string;
    compareLabel: string;
    bucket: 'hour' | 'day' | 'month';
    from: string;
    to: string;
    timezone: string;
  };
  generatedAt: string;
  kpis: Kpis & { refunds: { count: number; amount: number }; previous: Kpis };
  trend: TrendPoint[];
  hours: HourPoint[];
  payments: PaymentRow[];
  topProducts: TopProduct[];
  topCategories: TopCategory[];
  recentBills: RecentBill[];
  attention: AttentionItem[];
  stock: StockSnapshot | null;
  tills: TillsNow | null;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

export const dashboardService = {
  /** /dashboard lives outside /api, so call it directly (global axios keeps the auth flow). */
  async get(range: RangeKey, signal?: AbortSignal): Promise<DashboardData> {
    const res = await axios.get(`${BACKEND}/dashboard`, { params: { range }, headers: getAuthHeader(), signal });
    return res.data.data as DashboardData;
  },
};

