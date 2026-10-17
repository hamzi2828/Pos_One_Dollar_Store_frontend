"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  TrendingUp, Users, Package, DollarSign,
  AlertCircle, Clock, BarChart3,
  ShoppingCart, Activity, Percent, RefreshCw,
  ArrowUpRight, ArrowDownRight, Loader2, Download
} from 'lucide-react';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { StatsCard } from './adminComponents/StatsCard';
import { RecentOrdersTable } from './adminComponents/RecentOrdersTable';
import { QuickStats } from './adminComponents/QuickStats';
import { SalesTrendChart } from './adminComponents/SalesTrendChart';
import { TopProducts } from './adminComponents/TopProducts';
import { dashboardService, type DashboardData } from '@/app/(routes)/admin/dashboardService';
import { useCurrency } from '@/context/CurrencyContext';

const AdminDashboardClient = () => {
  const { currency, formatPrice } = useCurrency();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('week');
  const [refreshing, setRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const data = await dashboardService.getDashboardData(timeRange);
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 60000);

    return () => clearInterval(interval);
  }, [timeRange]);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleGenerateReport = async () => {
    if (!contentRef.current) return;

    try {
      setIsDownloading(true);

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#f9fafb",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const timeRangeLabels: Record<string, string> = {
        today: "Today",
        week: "This Week",
        month: "This Month",
        year: "This Year",
      };
      const dateStr = new Date().toISOString().split("T")[0];
      pdf.save(`dashboard-report-${timeRangeLabels[timeRange] || timeRange}-${dateStr}.pdf`);
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-gray-400" />
              <p className="text-xs sm:text-sm text-gray-500">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-lg sm:rounded-xl bg-red-50 border border-red-200 p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-red-800">Error loading dashboard</h3>
                <p className="mt-1 text-xs sm:text-sm text-red-600">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-xs sm:text-sm font-medium text-red-700 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData || !dashboardData.stats || !dashboardData.quickStats) {
    return null;
  }

  const statsConfig = [
    {
      name: 'Total Sales',
      value: dashboardData.stats.totalSales.toLocaleString(),
      icon: TrendingUp,
      change: '+12.5%',
      changeType: 'increase' as const,
      prefix: '',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      name: 'Total Users',
      value: dashboardData.stats.totalUsers.toLocaleString(),
      icon: Users,
      change: '+8.2%',
      changeType: 'increase' as const,
      prefix: '',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      name: 'Products',
      value: dashboardData.stats.totalProducts.toLocaleString(),
      icon: Package,
      change: '+5.1%',
      changeType: 'increase' as const,
      prefix: '',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
    {
      name: 'Revenue',
      value: dashboardData.stats.totalRevenue.toLocaleString(),
      icon: DollarSign,
      change: '+18.3%',
      changeType: 'increase' as const,
      prefix: currency.symbol,
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600'
    },
  ];

  const secondaryStats = [
    {
      name: 'Orders Today',
      value: dashboardData.stats.ordersToday.toLocaleString(),
      icon: ShoppingCart,
      change: '+3.1%',
      changeType: 'increase' as const,
    },
    {
      name: 'Avg Order Value',
      value: formatPrice(dashboardData.stats.avgOrderValue || 0),
      icon: DollarSign,
      change: '+1.8%',
      changeType: 'increase' as const,
    },
    {
      name: 'Conversion Rate',
      value: `${(dashboardData.stats.conversionRate || 0).toFixed(1)}%`,
      icon: Activity,
      change: '+0.3%',
      changeType: 'increase' as const,
    },
    {
      name: 'Refund Rate',
      value: `${(dashboardData.stats.refundRate || 0).toFixed(1)}%`,
      icon: Percent,
      change: '-0.1%',
      changeType: 'decrease' as const,
    },
  ];

  const quickStatsConfig = [
    {
      name: 'Pending Orders',
      value: dashboardData.quickStats.pendingOrders.toString(),
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50'
    },
    {
      name: 'Low Stock Items',
      value: dashboardData.quickStats.lowStockItems.toString(),
      icon: AlertCircle,
      color: 'text-red-600 bg-red-50'
    },
    {
      name: 'New Customers',
      value: dashboardData.quickStats.newCustomers.toString(),
      icon: Users,
      color: 'text-blue-600 bg-blue-50'
    },
    {
      name: 'Avg Fulfillment',
      value: `${(dashboardData.quickStats.avgFulfillmentTime || 0).toFixed(1)}d`,
      icon: Clock,
      color: 'text-gray-600 bg-gray-100'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header - Outside PDF capture */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">Dashboard Overview</h1>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
                Welcome back! Here's what's happening with your store.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-honey-500 transition-all duration-200 min-w-0"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
              <button
                onClick={handleGenerateReport}
                disabled={isDownloading}
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold text-white bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 whitespace-nowrap"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{isDownloading ? "Generating..." : "Generate Report"}</span>
                <span className="sm:hidden">{isDownloading ? "..." : "Report"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* PDF Content Start */}
        <div ref={contentRef} className="bg-gray-50">
          {/* Report Header for PDF */}
          <div className="mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Dashboard Report</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
              Generated on {new Date().toLocaleDateString()} | Period: {timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'This Week' : timeRange === 'month' ? 'This Month' : 'This Year'}
            </p>
          </div>

          {/* Main Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {statsConfig.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.name} className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} />
                  </div>
                  <div className={`flex items-center gap-0.5 text-[10px] sm:text-xs font-medium ${
                    stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.changeType === 'increase' ? (
                      <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-2 sm:mt-3">
                  <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                    {stat.prefix}{stat.value}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{stat.name}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {secondaryStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.name} className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-2 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-gray-100 rounded-lg">
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-lg font-semibold text-gray-900">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">{stat.name}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <h3 className="text-xs sm:text-sm md:text-base font-semibold text-gray-900 mb-2 sm:mb-3 md:mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            {quickStatsConfig.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.name} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                  <div className={`p-1.5 sm:p-2 rounded-lg ${stat.color.split(' ')[1]}`}>
                    <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.color.split(' ')[0]}`} />
                  </div>
                  <div>
                    <p className="text-sm sm:text-lg font-semibold text-gray-900">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">{stat.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4">
            <SalesTrendChart
              data={dashboardData.salesTrend}
              title="Sales Trend"
              dataKey="sales"
              color="#1f2937"
            />
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4">
            <SalesTrendChart
              data={dashboardData.salesTrend}
              title="Orders Trend"
              dataKey="orders"
              color="#059669"
            />
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <RecentOrdersTable orders={dashboardData.recentOrders} />
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4">
          <TopProducts products={dashboardData.topProducts} />
        </div>
        </div>
        {/* PDF Content End */}
      </div>
    </div>
  );
};

export default AdminDashboardClient;
