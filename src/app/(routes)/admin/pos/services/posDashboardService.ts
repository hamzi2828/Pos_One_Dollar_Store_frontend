// POS Dashboard Service
import { getAuthHeader } from "@/helper/helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export type FilterType = 'today' | 'weekly' | 'monthly' | 'custom' | 'all';

export interface DashboardStats {
  period: {
    totalSales: number;
    totalOrders: number;
    totalItems: number;
    avgOrderValue: number;
    cashSales: number;
    cardSales: number;
    salesChange: string;
    ordersChange: string;
  };
  periodLabel: string;
  comparisonLabel: string;
  filter: FilterType;
  dateRange: {
    start: string;
    end: string;
  };
  topProducts: {
    _id: string;
    productName: string;
    productImage?: string;
    totalQuantity: number;
    totalRevenue: number;
  }[];
  recentOrders: {
    _id: string;
    orderNumber: string;
    total: number;
    paymentMethod: string;
    createdAt: string;
    customer?: {
      firstName: string;
      lastName: string;
    };
    cashier?: {
      firstName: string;
      lastName: string;
    };
  }[];
}

export interface SalesChartData {
  salesChart: {
    _id: string;
    totalSales: number;
    totalOrders: number;
    cashSales: number;
    cardSales: number;
  }[];
  hourlyChart: {
    _id: number;
    totalSales: number;
    totalOrders: number;
  }[];
  paymentDistribution: {
    _id: string;
    totalSales: number;
    count: number;
  }[];
  period: string;
  dateFormat: string;
}

export interface DashboardFilterParams {
  filter: FilterType;
  startDate?: string;
  endDate?: string;
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(params?: DashboardFilterParams): Promise<DashboardStats> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const searchParams = new URLSearchParams();
  if (params?.filter) {
    searchParams.append('filter', params.filter);
  }
  if (params?.startDate) {
    searchParams.append('startDate', params.startDate);
  }
  if (params?.endDate) {
    searchParams.append('endDate', params.endDate);
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/pos/dashboard/stats${queryString ? `?${queryString}` : ''}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch dashboard stats' }));
    throw new Error(error.message || 'Failed to fetch dashboard stats');
  }

  const response = await res.json();
  return response.data;
}

/**
 * Get sales chart data
 */
export async function getSalesChart(
  period: '7days' | '30days' | '12months' = '7days'
): Promise<SalesChartData> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/dashboard/sales-chart?period=${period}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch sales chart' }));
    throw new Error(error.message || 'Failed to fetch sales chart');
  }

  const response = await res.json();
  return response.data;
}
