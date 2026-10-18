// Admin Reports service — typed wrappers around /api/reports/*.
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface CashInHandReport {
  period: { start: string; end: string };
  salesBreakdown: {
    totalSales: number;
    cashSales: number;
    cardSales: number;
    bankTransfer: number;
  };
  paymentsReceived: {
    total: number;
    cash: number;
    card: number;
    bank: number;
    count: number;
  };
  expenseSummary: {
    totalExpenses: number;
    cashExpenses: number;
    bankExpenses: number;
  };
  vendorSummary: {
    totalPaid: number;
    cashPaid: number;
    bankPaid: number;
  };
  salarySummary: {
    totalPaid: number;
    cashPaid: number;
    bankPaid: number;
    totalRemaining: number;
  };
  receivableData: {
    totalReceivable: number;
    pendingCount: number;
    partialCount: number;
  };
  balances: {
    cashBalance: number;
    bankBalance: number;
    totalBalance: number;
  };
}

export interface SalesSummaryReport {
  summary: {
    totalOrders: number;
    totalSales: number;
    totalPaid: number;
    totalPending: number;
    totalCost: number;
    totalProfit: number;
    cashSales: number;
    cardSales: number;
    bankSales: number;
    itemsSold: number;
    avgOrderValue: number;
    posOrders: number;
    posSales: number;
    onlineOrders: number;
    onlineSales: number;
  };
  orders: Array<{
    _id: string;
    orderNumber: string;
    total: number;
    paidAmount: number;
    pendingAmount: number;
    costPrice: number;
    profit: number;
    paymentMethod: string;
    rawPaymentMethod?: string;
    paymentStatus: string;
    orderStatus: string;
    createdAt: string;
    items: unknown[];
    customerInfo?: { name?: string; phone?: string };
    customer?: { firstName?: string; lastName?: string; phone?: string };
    source: 'pos' | 'online';
  }>;
}

export interface PurchasesSummaryReport {
  summary: {
    totalPurchases: number;
    totalAmount: number;
    totalPaid: number;
    totalPending: number;
    cashPaid: number;
    bankPaid: number;
  };
  purchases: Array<{
    _id: string;
    invoiceNumber: string;
    vendorName: string;
    purchaseDate: string;
    total: number;
    paidAmount: number;
    pendingAmount: number;
    paymentStatus: string;
  }>;
}

export interface LabourRevenueReport {
  summary: {
    totalRevenue: number;
    totalQty: number;
    uniqueServices: number;
    lineItemCount: number;
    uniqueEmployees: number;
  };
  grouped: Array<{ description: string; count: number; quantity: number; revenue: number }>;
  groupedByEmployee: Array<{ employee: string; count: number; quantity: number; revenue: number }>;
  lineItems: Array<{
    orderId: string;
    orderNumber: string;
    date: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    customerName: string;
    customerPhone: string;
    cashier: string;
    performedBy: string;
  }>;
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export interface StockReport {
  summary: {
    totalProducts: number;
    totalInStock: number;
    totalLowStock: number;
    totalOutOfStock: number;
    totalUnits: number;
    totalInventoryValue: number;
    threshold: number;
  };
  products: Array<{
    _id: string;
    name: string;
    slug: string;
    category: string;
    status: string;
    productType: 'single' | 'variant';
    stock: number;
    variantCount: number;
    price: number;
    costPrice: number;
    discountedPrice: number | null;
    thumbnailUrl: string | null;
    displayOn: string;
    inventoryValue: number;
    stockStatus: StockStatus;
    updatedAt: string;
  }>;
}

export interface ExpenseReport {
  summary: {
    total: number;
    count: number;
    cashTotal: number;
    bankTotal: number;
    avgExpense: number;
  };
  byCategory: Array<{ category: string; amount: number }>;
  byMethod: Array<{ method: string; amount: number }>;
  expenses: Array<{
    _id: string;
    title: string;
    amount: number;
    category: string;
    categories?: string[];
    date: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
  }>;
}

export interface VendorPaymentsReport {
  summary: {
    total: number;
    count: number;
    cashTotal: number;
    bankTotal: number;
    uniqueVendors: number;
    outstanding: {
      count: number;
      totalPending: number;
      totalInvoiced: number;
      totalPaid: number;
    };
  };
  byVendor: Array<{
    vendor: string;
    count: number;
    amount: number;
    invoiceCount: number;
    invoiceTotal: number;
    invoicePaid: number;
    invoicePending: number;
  }>;
  byMethod: Array<{ method: string; amount: number }>;
  payments: Array<{
    _id: string;
    date: string;
    amount: number;
    paymentMethod: string;
    reference: string;
    notes: string;
    invoiceNumber: string;
    purchaseId: string;
    vendorName: string;
    vendorId?: string;
    invoiceTotal: number;
    invoicePaid: number;
    invoicePending: number;
  }>;
  outstandingInvoices: Array<{
    _id: string;
    invoiceNumber: string;
    vendorName: string;
    vendorId?: string;
    purchaseDate: string;
    dueDate: string | null;
    total: number;
    paidAmount: number;
    pendingAmount: number;
    paymentStatus: string;
  }>;
}

export interface SalaryReport {
  summary: {
    recordCount: number;
    totalBase: number;
    totalPaid: number;
    totalRemaining: number;
    paidInWindowTotal: number;
    paidInWindowCash: number;
    paidInWindowBank: number;
  };
  records: Array<{
    _id: string;
    employeeId: string | null;
    employeeName: string;
    position: string;
    department: string;
    month: string;
    year: number;
    baseSalary: number;
    totalPaid: number;
    remainingBalance: number;
    status: 'pending' | 'partial' | 'paid';
    notes: string;
    paymentsInWindow: Array<{
      _id?: string;
      date: string;
      amount: number;
      paymentMethod: string;
      notes: string;
    }>;
  }>;
  window: { start: string; end: string };
  filter: { month: string | null; year: string | null };
}

export interface CostAnalysisReport {
  revenue: number;
  cogs: number;
  outsourceCost: number;
  estimatedProductCost: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  itemCount: number;
  grossMargin: number;
  netMargin: number;
}

export interface PaginationInfo {
  page: number;
  pages: number;
  total: number;
  limit: number;
}

// Shared fetch wrapper.
// - Supports AbortSignal so consumers can cancel stale in-flight requests
//   when the user changes filters or pages rapidly.
// - Returns both `data` and `pagination` (when the server sends one), so
//   paginated endpoints have a single return shape.
async function request<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  if (!API_BASE_URL) throw new Error('Missing NEXT_PUBLIC_BACKEND_URL');
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE_URL}${path}?${qs}`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    cache: 'no-store',
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || 'Request failed');
  }
  const json = await res.json();
  return json.data as T;
}

async function requestWithPagination<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ data: T; pagination: PaginationInfo }> {
  if (!API_BASE_URL) throw new Error('Missing NEXT_PUBLIC_BACKEND_URL');
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE_URL}${path}?${qs}`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    cache: 'no-store',
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || 'Request failed');
  }
  const json = await res.json();
  return {
    data: json.data as T,
    pagination: (json.pagination as PaginationInfo) || { page: 1, pages: 1, total: 0, limit: 25 },
  };
}

// Non-paginated reports (aggregate summaries)
export function fetchCashInHand(startDate: string, endDate: string, signal?: AbortSignal) {
  return request<CashInHandReport>('/api/reports/cash-in-hand', { startDate, endDate }, signal);
}
export function fetchPurchasesSummary(
  startDate: string,
  endDate: string,
  opts: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const p: Record<string, string> = { startDate, endDate };
  if (opts.page) p.page = String(opts.page);
  if (opts.limit) p.limit = String(opts.limit);
  return requestWithPagination<PurchasesSummaryReport>('/api/reports/purchases-summary', p, signal);
}
export function fetchCostAnalysis(startDate: string, endDate: string, signal?: AbortSignal) {
  return request<CostAnalysisReport>('/api/reports/cost-analysis', { startDate, endDate }, signal);
}

// Paginated — each accepts {page, limit} and returns {data, pagination}
export function fetchSalesSummary(
  startDate: string,
  endDate: string,
  opts: { page?: number; limit?: number; source?: 'all' | 'pos' | 'online' } = {},
  signal?: AbortSignal,
) {
  const p: Record<string, string> = { startDate, endDate };
  if (opts.page) p.page = String(opts.page);
  if (opts.limit) p.limit = String(opts.limit);
  if (opts.source) p.source = opts.source;
  return requestWithPagination<SalesSummaryReport>('/api/reports/sales-summary', p, signal);
}
export function fetchLabourRevenue(
  startDate: string,
  endDate: string,
  opts: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const p: Record<string, string> = { startDate, endDate };
  if (opts.page) p.page = String(opts.page);
  if (opts.limit) p.limit = String(opts.limit);
  return requestWithPagination<LabourRevenueReport>('/api/reports/labour-revenue', p, signal);
}
export function fetchStockReport(
  filter: 'all' | 'low' | 'out',
  threshold: number,
  opts: { page?: number; limit?: number; search?: string } = {},
  signal?: AbortSignal,
) {
  const p: Record<string, string> = { filter, threshold: String(threshold) };
  if (opts.page) p.page = String(opts.page);
  if (opts.limit) p.limit = String(opts.limit);
  if (opts.search) p.search = opts.search;
  return requestWithPagination<StockReport>('/api/reports/stock', p, signal);
}
export function fetchExpenseReport(
  startDate: string,
  endDate: string,
  opts: { category?: string; method?: string; page?: number; limit?: number; search?: string } = {},
  signal?: AbortSignal,
) {
  const p: Record<string, string> = { startDate, endDate };
  if (opts.category) p.category = opts.category;
  if (opts.method) p.method = opts.method;
  if (opts.page) p.page = String(opts.page);
  if (opts.limit) p.limit = String(opts.limit);
  if (opts.search) p.search = opts.search;
  return requestWithPagination<ExpenseReport>('/api/reports/expenses', p, signal);
}
export function fetchVendorPayments(
  startDate: string,
  endDate: string,
  opts: { vendorId?: string; page?: number; limit?: number; search?: string } = {},
  signal?: AbortSignal,
) {
  const p: Record<string, string> = { startDate, endDate };
  if (opts.vendorId) p.vendorId = opts.vendorId;
  if (opts.page) p.page = String(opts.page);
  if (opts.limit) p.limit = String(opts.limit);
  if (opts.search) p.search = opts.search;
  return requestWithPagination<VendorPaymentsReport>('/api/reports/vendor-payments', p, signal);
}
export function fetchSalaryReport(
  params: {
    month?: string;
    year?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal,
) {
  const p: Record<string, string> = {};
  if (params.month) p.month = params.month;
  if (params.year) p.year = params.year;
  if (params.startDate) p.startDate = params.startDate;
  if (params.endDate) p.endDate = params.endDate;
  if (params.page) p.page = String(params.page);
  if (params.limit) p.limit = String(params.limit);
  return requestWithPagination<SalaryReport>('/api/reports/salary', p, signal);
}

// Shared date-range helpers — build local YYYY-MM-DD strings.
export type DateFilter = 'today' | 'week' | 'month' | 'custom';

export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function rangeFromFilter(
  filter: DateFilter,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string; label: string } | null {
  const now = new Date();
  if (filter === 'today') {
    const s = formatDateLocal(now);
    return { start: s, end: s, label: 'Today' };
  }
  if (filter === 'week') {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    return { start: formatDateLocal(start), end: formatDateLocal(now), label: 'This Week' };
  }
  if (filter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: formatDateLocal(start), end: formatDateLocal(now), label: 'This Month' };
  }
  if (filter === 'custom') {
    if (!customStart || !customEnd) return null;
    return { start: customStart, end: customEnd, label: `${customStart} to ${customEnd}` };
  }
  return null;
}
