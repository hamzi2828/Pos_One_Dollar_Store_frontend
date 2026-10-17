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
  conversionRate: number;
  refundRate: number;
}

interface QuickStats {
  pendingOrders: number;
  lowStockItems: number;
  newCustomers: number;
  returnedItems: number;
  avgFulfillmentTime: number;
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

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}

interface CustomerDistribution {
  new: number;
  returning: number;
  vip: number;
}

interface DashboardData {
  stats: DashboardStats;
  recentOrders: Order[];
  quickStats: QuickStats;
  salesTrend: SalesTrendPoint[];
  topProducts: Product[];
  recentActivity: Activity[];
  customerDistribution: CustomerDistribution;
}

interface DashboardAnalytics {
  periodComparison: {
    current: {
      revenue: number;
      orders: number;
      customers: number;
    };
    previous: {
      revenue: number;
      orders: number;
      customers: number;
    };
    percentageChange: {
      revenue: number;
      orders: number;
      customers: number;
    };
  };
  topCategories: Array<{
    category: string;
    sales: number;
    revenue: number;
  }>;
  geographicDistribution: Array<{
    region: string;
    orders: number;
    revenue: number;
  }>;
}

class DashboardService {

  async getDashboardData(timeRange: string): Promise<DashboardData> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard`, {
        params: { timeRange },
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

  async getDashboardStats(timeRange: string): Promise<DashboardStats> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/stats`, {
        params: { timeRange },
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  async getRecentOrders(limit: number = 10): Promise<Order[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/recent-orders`, {
        params: { limit },
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent orders:', error);
      throw error;
    }
  }

  async getQuickStats(): Promise<QuickStats> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/quick-stats`, {
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching quick stats:', error);
      throw error;
    }
  }

  async getSalesTrend(timeRange: string, interval: string = 'day'): Promise<SalesTrendPoint[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/sales-trend`, {
        params: { timeRange, interval },
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching sales trend:', error);
      throw error;
    }
  }

  async getTopProducts(limit: number = 10, timeRange: string = 'month'): Promise<Product[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/top-products`, {
        params: { limit, timeRange },
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching top products:', error);
      throw error;
    }
  }

  async getRecentActivity(limit: number = 20): Promise<Activity[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/recent-activity`, {
        params: { limit },
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      throw error;
    }
  }

  async getCustomerDistribution(): Promise<CustomerDistribution> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/customer-distribution`, {
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching customer distribution:', error);
      throw error;
    }
  }

  async getAnalytics(timeRange: string): Promise<DashboardAnalytics> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/analytics`, {
        params: { timeRange },
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  }

  async generateReport(timeRange: string): Promise<Blob> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/report`, {
        params: { timeRange },
        headers: getAuthHeader(),
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  async exportData(format: 'csv' | 'excel' | 'pdf', timeRange: string): Promise<Blob> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/export`, {
        params: { format, timeRange },
        headers: getAuthHeader(),
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async refreshDashboard(): Promise<void> {
    try {
      await axios.post(`${API_BASE_URL}/dashboard/refresh`, {}, {
        headers: getAuthHeader()
      });
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      throw error;
    }
  }

  async getNotifications(unreadOnly: boolean = false): Promise<Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    read: boolean;
  }>> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/notifications`, {
        params: { unreadOnly },
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await axios.patch(`${API_BASE_URL}/dashboard/notifications/${notificationId}/read`, {}, {
        headers: getAuthHeader()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async getMetrics(metricType: string, timeRange: string): Promise<{
    current: number;
    previous: number;
    change: number;
    trend: Array<{ date: string; value: number }>;
  }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard/metrics/${metricType}`, {
        params: { timeRange },
        headers: getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${metricType} metrics:`, error);
      throw error;
    }
  }
}

export const dashboardService = new DashboardService();

// Export types for use in other files
export type {
  DashboardData,
  DashboardStats,
  QuickStats,
  Order,
  SalesTrendPoint,
  Product,
  Activity,
  CustomerDistribution,
  DashboardAnalytics
};