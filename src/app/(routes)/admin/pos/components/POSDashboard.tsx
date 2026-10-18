// POS Dashboard Component
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Package,
  CreditCard,
  Banknote,
  Clock,
  Calendar,
  BarChart3,
  PieChart,
  RefreshCw,
  ChevronDown,
  X,
} from 'lucide-react';
import { getDashboardStats, getSalesChart, DashboardStats, SalesChartData, FilterType } from '../services/posDashboardService';
import { getCurrencySymbol } from '../utils/currency';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  comparisonLabel?: string;
  icon: React.ReactNode;
  subValue?: string;
}

function StatCard({ title, value, change, changeType = 'neutral', comparisonLabel, icon, subValue }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subValue && (
            <p className="text-sm text-gray-500 mt-1">{subValue}</p>
          )}
          {change && (
            <div className={`flex items-center mt-2 text-sm ${
              changeType === 'positive' ? 'text-green-600' :
              changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {changeType === 'positive' ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : changeType === 'negative' ? (
                <TrendingDown className="h-4 w-4 mr-1" />
              ) : null}
              <span>{change}% {comparisonLabel || ''}</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-red-50 rounded-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

// Line Chart using SVG
function SalesLineChart({ data }: { data: { _id: string; totalSales: number; totalOrders: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  const maxSales = Math.max(...data.map(d => d.totalSales), 1);
  const width = 100;
  const height = 60;
  const padding = 5;

  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1 || 1)) * (width - 2 * padding),
    y: height - padding - ((d.totalSales / maxSales) * (height - 2 * padding)),
    sales: d.totalSales,
    orders: d.totalOrders,
    date: d._id,
  }));

  const pathD = points.length > 1
    ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
    : '';

  const areaD = points.length > 1
    ? `M ${points[0].x},${height - padding} L ${pathD.slice(2)} L ${points[points.length - 1].x},${height - padding} Z`
    : '';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            y1={height - padding - ratio * (height - 2 * padding)}
            x2={width - padding}
            y2={height - padding - ratio * (height - 2 * padding)}
            stroke="#e5e7eb"
            strokeWidth="0.3"
          />
        ))}

        {/* Area fill */}
        <path
          d={areaD}
          fill="url(#gradient)"
          opacity="0.3"
        />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#DC2626"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="1.5"
            fill="#DC2626"
            className="cursor-pointer hover:r-2"
          />
        ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between px-2 mt-2">
        {data.slice(0, 7).map((d, i) => (
          <span key={i} className="text-xs text-gray-400">
            {new Date(d._id).toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
        ))}
      </div>
    </div>
  );
}

// Pie Chart Component
function PaymentPieChart({ data, symbol }: { data: { _id: string; totalSales: number; count: number }[]; symbol: string }) {
  const total = data.reduce((sum, d) => sum + d.totalSales, 0);
  if (total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  const colors: Record<string, string> = {
    cash: '#10b981',
    card: '#3b82f6',
    split: '#8b5cf6',
  };

  let currentAngle = 0;

  const segments = data.map((d) => {
    const percentage = (d.totalSales / total) * 100;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (currentAngle - 90) * (Math.PI / 180);

    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    return {
      ...d,
      percentage,
      path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: colors[d._id] || '#6b7280',
    };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-48 h-48">
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.path}
            fill={seg.color}
            className="hover:opacity-80 transition-opacity cursor-pointer"
          />
        ))}
        <circle cx="50" cy="50" r="25" fill="white" />
        <text x="50" y="48" textAnchor="middle" className="text-xs font-bold fill-gray-900">
          {symbol}{total.toFixed(0)}
        </text>
        <text x="50" y="58" textAnchor="middle" className="text-[8px] fill-gray-500">
          Total
        </text>
      </svg>

      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-sm text-gray-600 capitalize">{seg._id}</span>
            <span className="text-sm font-medium text-gray-900">
              {seg.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hourly Chart
function HourlyChart({ data, symbol }: { data: { _id: number; totalSales: number; totalOrders: number }[]; symbol: string }) {
  const maxSales = Math.max(...data.map(d => d.totalSales), 1);
  const hours = Array.from({ length: 24 }, (_, i) => {
    const found = data.find(d => d._id === i);
    return { hour: i, sales: found?.totalSales || 0, orders: found?.totalOrders || 0 };
  });

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-32">
        {hours.map((h) => (
          <div
            key={h.hour}
            className="flex-1 bg-red-500 rounded-t transition-all hover:bg-[#DC2626]"
            style={{ height: `${(h.sales / maxSales) * 100}%`, minHeight: h.sales > 0 ? '4px' : '0' }}
            title={`${h.hour}:00 - ${symbol}${h.sales.toFixed(2)} (${h.orders} orders)`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>12AM</span>
        <span>6AM</span>
        <span>12PM</span>
        <span>6PM</span>
        <span>11PM</span>
      </div>
    </div>
  );
}

// Filter Dropdown Component
function FilterDropdown({
  selectedFilter,
  onFilterChange,
  customDateRange,
  onCustomDateChange,
}: {
  selectedFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  customDateRange: { start: string; end: string };
  onCustomDateChange: (range: { start: string; end: string }) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [tempDates, setTempDates] = useState(customDateRange);

  const filterOptions: { value: FilterType; label: string; icon: React.ReactNode }[] = [
    { value: 'today', label: 'Today', icon: <Clock className="h-4 w-4" /> },
    { value: 'weekly', label: 'This Week', icon: <Calendar className="h-4 w-4" /> },
    { value: 'monthly', label: 'This Month', icon: <Calendar className="h-4 w-4" /> },
    { value: 'custom', label: 'Custom Range', icon: <Calendar className="h-4 w-4" /> },
  ];

  const getDisplayLabel = () => {
    if (selectedFilter === 'custom' && customDateRange.start && customDateRange.end) {
      const start = new Date(customDateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = new Date(customDateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${start} - ${end}`;
    }
    return filterOptions.find(f => f.value === selectedFilter)?.label || 'Today';
  };

  const handleFilterSelect = (filter: FilterType) => {
    if (filter === 'custom') {
      setShowCustomModal(true);
      setTempDates(customDateRange.start ? customDateRange : {
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
      });
    } else {
      onFilterChange(filter);
    }
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (tempDates.start && tempDates.end) {
      onCustomDateChange(tempDates);
      onFilterChange('custom');
      setShowCustomModal(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-w-[180px]"
      >
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="flex-1 text-left font-medium text-gray-700">{getDisplayLabel()}</span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px]">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleFilterSelect(option.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  selectedFilter === option.value ? 'bg-red-50 text-[#DC2626]' : 'text-gray-700'
                }`}
              >
                {option.icon}
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Custom Date Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Select Date Range</h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={tempDates.start}
                  onChange={(e) => setTempDates({ ...tempDates, start: e.target.value })}
                  max={tempDates.end || undefined}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={tempDates.end}
                  onChange={(e) => setTempDates({ ...tempDates, end: e.target.value })}
                  min={tempDates.start || undefined}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCustomModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCustom}
                disabled={!tempDates.start || !tempDates.end}
                className="flex-1 px-4 py-2 bg-[#DC2626] text-white rounded-lg hover:bg-[#b91c1c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface POSDashboardProps {
  currency?: string;
}

export default function POSDashboard({ currency = 'PKR' }: POSDashboardProps) {
  const symbol = getCurrencySymbol(currency);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<SalesChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'7days' | '30days' | '12months'>('7days');
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('today');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const loadData = useCallback(async () => {
    try {
      const filterParams = selectedFilter === 'custom'
        ? { filter: selectedFilter, startDate: customDateRange.start, endDate: customDateRange.end }
        : { filter: selectedFilter };

      const [statsData, chart] = await Promise.all([
        getDashboardStats(filterParams),
        getSalesChart(chartPeriod),
      ]);
      setStats(statsData);
      setChartData(chart);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFilter, customDateRange, chartPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const loadChart = async () => {
      try {
        const chart = await getSalesChart(chartPeriod);
        setChartData(chart);
      } catch (error) {
        console.error('Failed to load chart data:', error);
      }
    };
    loadChart();
  }, [chartPeriod]);

  const handleRefresh = async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      refreshLock.current = false;
    }
  };

  const handleFilterChange = (filter: FilterType) => {
    setSelectedFilter(filter);
    if (filter !== 'custom') {
      setCustomDateRange({ start: '', end: '' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#DC2626]" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load dashboard data. Please try again.
      </div>
    );
  }

  const getChangeType = (change: string | number): 'positive' | 'negative' | 'neutral' => {
    const num = typeof change === 'string' ? parseFloat(change) : change;
    if (num > 0) return 'positive';
    if (num < 0) return 'negative';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      {/* Header with Filter */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">POS Dashboard</h2>
          <p className="text-gray-500">Real-time sales analytics and metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <FilterDropdown
            selectedFilter={selectedFilter}
            onFilterChange={handleFilterChange}
            customDateRange={customDateRange}
            onCustomDateChange={setCustomDateRange}
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Period Label */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Clock className="h-4 w-4" />
        <span className="font-medium">{stats.periodLabel}</span>
        {stats.dateRange && (
          <span className="text-gray-400">
            ({new Date(stats.dateRange.start).toLocaleDateString()} - {new Date(stats.dateRange.end).toLocaleDateString()})
          </span>
        )}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Sales"
          value={`${symbol}${stats.period.totalSales.toFixed(2)}`}
          change={stats.period.salesChange}
          changeType={getChangeType(stats.period.salesChange)}
          comparisonLabel={stats.comparisonLabel}
          icon={<span className="h-6 w-6 text-[#DC2626] font-bold text-lg">{symbol}</span>}
        />
        <StatCard
          title="Total Orders"
          value={stats.period.totalOrders.toString()}
          change={stats.period.ordersChange}
          changeType={getChangeType(stats.period.ordersChange)}
          comparisonLabel={stats.comparisonLabel}
          icon={<ShoppingCart className="h-6 w-6 text-[#DC2626]" />}
        />
        <StatCard
          title="Avg Order Value"
          value={`${symbol}${stats.period.avgOrderValue.toFixed(2)}`}
          icon={<TrendingUp className="h-6 w-6 text-[#DC2626]" />}
        />
        <StatCard
          title="Items Sold"
          value={stats.period.totalItems.toString()}
          icon={<Package className="h-6 w-6 text-[#DC2626]" />}
        />
      </div>

      {/* Payment Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Banknote className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold text-gray-800">Cash Sales</h4>
          </div>
          <p className="text-3xl font-bold text-green-600">{symbol}{stats.period.cashSales.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-[#DC2626]" />
            <h4 className="font-semibold text-gray-800">Card Sales</h4>
          </div>
          <p className="text-3xl font-bold text-[#DC2626]">{symbol}{stats.period.cardSales.toFixed(2)}</p>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#DC2626]" />
            Sales Trend
          </h3>
          <div className="flex gap-2">
            {(['7days', '30days', '12months'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  chartPeriod === period
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period === '7days' ? '7 Days' : period === '30days' ? '30 Days' : '12 Months'}
              </button>
            ))}
          </div>
        </div>
        {chartData && <SalesLineChart data={chartData.salesChart} />}
      </div>

      {/* Hourly Sales & Payment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#DC2626]" />
            Hourly Sales (Today)
          </h3>
          {chartData && <HourlyChart data={chartData.hourlyChart} symbol={symbol} />}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-[#DC2626]" />
            Payment Methods
          </h3>
          {chartData && <PaymentPieChart data={chartData.paymentDistribution} symbol={symbol} />}
        </div>
      </div>

      {/* Top Products & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            Top Products ({stats.periodLabel})
          </h3>
          {stats.topProducts.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No sales in this period</p>
          ) : (
            <div className="space-y-3">
              {stats.topProducts.map((product, index) => (
                <div key={product._id} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-red-100 text-[#DC2626] rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{product.productName}</p>
                    <p className="text-sm text-gray-500">{product.totalQuantity} sold</p>
                  </div>
                  <span className="font-semibold text-gray-900">{symbol}{product.totalRevenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-purple-600" />
            Recent Orders ({stats.periodLabel})
          </h3>
          {stats.recentOrders.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No orders in this period</p>
          ) : (
            <div className="space-y-3">
              {stats.recentOrders.map((order) => (
                <div key={order._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{order.orderNumber}</p>
                    <p className="text-sm text-gray-500">
                      {order.customer
                        ? `${order.customer.firstName} ${order.customer.lastName}`
                        : 'Walk-in Customer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{symbol}{order.total.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
