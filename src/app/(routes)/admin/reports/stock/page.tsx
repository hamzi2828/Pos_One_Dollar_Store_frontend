// Stock Report — current inventory snapshot with low-stock alerts and
// inventory valuation. Not date-filtered; stock is a balance.
'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Boxes,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Download,
} from 'lucide-react';
import jsPDF from 'jspdf';
import ReportsNav from '../components/ReportsNav';
import { usePdfExport } from '../components/usePdfExport';
import {
  fetchStockReport,
  type StockReport,
  type StockStatus,
} from '../services/reportsService';
import { getCurrencySymbol } from '../../pos/utils/currency';
import TablePagination from '@/components/admin/TablePagination';
import { useServerPagination } from '@/helper/useServerPagination';

const CURRENCY = 'PKR';
type Filter = 'all' | 'low' | 'out';

export default function StockReportPage() {
  const symbol = getCurrencySymbol(CURRENCY);
  const fmt = (n: number) => `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const [filter, setFilter] = useState<Filter>('all');
  const [threshold, setThreshold] = useState<number>(10);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<StockReport | null>(null);
  const [loading, setLoading] = useState(false);

  const pg = useServerPagination(50);
  const [reloadTick, setReloadTick] = useState(0);
  const load = useCallback(() => setReloadTick((n) => n + 1), []);
  // Counts in-flight fetches so Refresh can't be re-fired while one is running.
  const inFlightRef = useRef(0);
  const handleRefresh = () => {
    if (inFlightRef.current > 0) return;
    load();
  };

  useEffect(() => {
    pg.resetToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, threshold, search]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ctl = new AbortController();
    inFlightRef.current += 1;
    setLoading(true);
    fetchStockReport(
      filter,
      threshold,
      { page: pg.page, limit: pg.pageSize, search: debouncedSearch || undefined },
      ctl.signal,
    )
      .then(({ data: d, pagination }) => {
        setData(d);
        pg.setTotal(pagination.total);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        toast.error(err instanceof Error ? err.message : 'Failed to load stock report');
      })
      .finally(() => {
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) setLoading(false);
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, threshold, debouncedSearch, pg.page, pg.pageSize, reloadTick]);

  // Server already applied filter + search + pagination.
  const filteredProducts = data?.products || [];

  const handleDownloadPdf = () => {
    if (!data) return;
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Stock Report', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated ${new Date().toLocaleDateString()}  |  Low-stock threshold: ${data.summary.threshold}`, margin, y);
    y += 8;
    doc.setTextColor(0);
    const rows: Array<[string, string]> = [
      ['Products', String(data.summary.totalProducts)],
      ['In Stock', String(data.summary.totalInStock)],
      ['Low Stock', String(data.summary.totalLowStock)],
      ['Out of Stock', String(data.summary.totalOutOfStock)],
      ['Total Units', String(data.summary.totalUnits)],
      ['Inventory Value', fmt(data.summary.totalInventoryValue)],
    ];
    rows.forEach(([k, v]) => { doc.text(k, margin, y); doc.text(v, pw - margin, y, { align: 'right' }); y += 6; });
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Products', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, pw - 2 * margin, 6, 'F');
    const headers = ['Product', 'Category', 'Stock', 'Status', 'Cost', 'Value'];
    const widths = [68, 40, 16, 22, 22, 22];
    let x = margin;
    headers.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; });
    y += 5;
    filteredProducts.forEach((p) => {
      if (y > 280) { doc.addPage(); y = 14; }
      x = margin;
      doc.text(p.name.substring(0, 42), x, y); x += widths[0];
      doc.text((p.category || '—').substring(0, 22), x, y); x += widths[1];
      doc.text(String(p.stock), x, y); x += widths[2];
      doc.text(p.stockStatus.replace('_', ' '), x, y); x += widths[3];
      doc.text(fmt(p.costPrice), x, y); x += widths[4];
      doc.text(fmt(p.inventoryValue), x, y);
      y += 5;
    });
    doc.save(`Stock_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  const pdfExport = usePdfExport(handleDownloadPdf);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-[#DC2626]" />
            Stock Report
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
            Remaining stock and inventory valuation per product.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pdfExport.run}
            disabled={loading || !data || pdfExport.exporting}
            aria-busy={pdfExport.exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pdfExport.exporting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Download className="h-4 w-4" /> PDF</>
            )}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Refresh</>
            )}
          </button>
        </div>
      </div>

      <ReportsNav />

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Stat label="Products" value={data.summary.totalProducts.toString()} />
          <Stat label="In Stock" value={data.summary.totalInStock.toString()} accent="text-emerald-700" />
          <Stat label="Low Stock" value={data.summary.totalLowStock.toString()} accent="text-orange-700" />
          <Stat label="Out of Stock" value={data.summary.totalOutOfStock.toString()} accent="text-red-700" />
          <Stat label="Total Units" value={data.summary.totalUnits.toString()} />
          <Stat label="Inventory Value" value={fmt(data.summary.totalInventoryValue)} accent="text-blue-700" />
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <FilterBtn label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterBtn label="Low Stock" active={filter === 'low'} onClick={() => setFilter('low')} />
          <FilterBtn label="Out of Stock" active={filter === 'out'} onClick={() => setFilter('out')} />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <label>Low-stock threshold</label>
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, category, slug"
            className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Inventory Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" /></td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-gray-400">No products match</td></tr>
              ) : filteredProducts.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-[11px] text-gray-400">{p.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{p.category || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs capitalize text-gray-600">{p.productType}</span>
                    {p.productType === 'variant' && p.variantCount > 0 && (
                      <span className="text-[11px] text-gray-400"> · {p.variantCount} variants</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{p.stock}</td>
                  <td className="px-3 py-2"><StockBadge status={p.stockStatus} /></td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {p.costPrice > 0 ? fmt(p.costPrice) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(p.price)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {p.costPrice > 0 ? fmt(p.inventoryValue) : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={pg.page}
          pages={pg.pages}
          total={pg.total}
          limit={pg.pageSize}
          onPageChange={pg.setPage}
          onLimitChange={pg.setPageSize}
          loading={loading}
          label="products"
        />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-base font-semibold mt-0.5 truncate ${accent || 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-[#DC2626] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {label}
    </button>
  );
}

function StockBadge({ status }: { status: StockStatus }) {
  if (status === 'in_stock') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" /> In Stock
      </span>
    );
  }
  if (status === 'low_stock') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200 text-xs font-medium">
        <AlertTriangle className="h-3 w-3" /> Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200 text-xs font-medium">
      <XCircle className="h-3 w-3" /> Out
    </span>
  );
}
