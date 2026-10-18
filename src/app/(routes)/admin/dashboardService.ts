import axios from 'axios';

import { getAuthHeader } from "@/helper/helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface DashboardStats {
  totalSales: number;
  totalUsers: number;
  totalProducts: number;
  totalRevenue: number;
  ordersToday: number;
  avgOrderValue: number;
  refundRate: number;
}

interface QuickStats {
  pendingOrders: number;
  lowStockItems: number;
  newCustomers: number;
}

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface SalesTrendPoint {
  date: string;
  sales: number;
  orders: number;
}

interface Product {
  id: string;
  name: string;
  sales: number;
  revenue: number;
  stock: number;
}

interface DashboardData {
  stats: DashboardStats;
  recentOrders: Order[];
  quickStats: QuickStats;
  salesTrend: SalesTrendPoint[];
  topProducts: Product[];
}

export const dashboardService = {
  /** Everything the dashboard shows, for 'today' | 'week' | 'month' | 'year'. */
  async getDashboardData(timeRange: string): Promise<DashboardData> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard`, {
        params: { timeRange },
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  },
};

export type {
  DashboardData,
  DashboardStats,
  QuickStats,
  Order,
  SalesTrendPoint,
  Product,
};
