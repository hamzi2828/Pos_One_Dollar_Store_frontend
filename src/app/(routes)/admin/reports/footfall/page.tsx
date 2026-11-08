'use client';

// Footfall — how many buyers and bills, the average bill, busy hours and days
// (Pakistan time), per cashier, and the conversion from visitors
// counted at the door (optional, typed per day).

import { useMemo, useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Footprints, Users, Download } from 'lucide-react';
import ReportsNav from '../components/ReportsNav';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage } from '@/lib/storeApi';
import { Modal, Field, ErrorBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import {
  PageHeader,
  FilterBar,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  ReportActions,
  Heatmap,
  DateRangePicker,
  useDateRange,
  useReport,
  downloadCsv,
  buildPdf,
  formatRs,
  fmtNum,
  fmtPct,
  fmtDay,
  pktToday,
} from '../demand/_shared/reportKit';

interface DayRow {
  day: string;
  weekday: string;
  bills: number;
  buyers: number;
  sales: number;
  avgBill: number;
  itemsPerBill: number;
  visitors: number | null;
  conversionPct: number | null;
}
interface FootfallData {
  range: { from: string; to: string; days: number };
  summary: {
    bills: number;
    buyers: number;
    walkInBills: number;
    sales: number;
    avgBill: number;
    itemsPerBill: number;
    avgBillsPerDay: number;
    visitors: number | null;
    conversionPct: number | null;
    daysWithVisitors: number;
    peakHour: number | null;
    peakWeekday: string | null;
    busiestDay: string | null;
  };
  days: DayRow[];
  heatmap: { weekday: number; label: string; hours: { bills: number; sales: number }[] }[];
  byHour: { hour: number; bills: number; sales: number; avgBill: number }[];
  byWeekday: { weekday: number; label: string; bills: number; sales: number; avgBills: number; avgSales: number; avgBill: number }[];
  byCashier: { cashierId: string | null; name: string; bills: number; sales: number; avgBill: number; itemsPerBill: number }[];
}
interface Entry {
  _id: string;
  day: string;
  visitors: number;
  note: string;
}

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export default function FootfallPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_footfall', 'view');
  const canExport = can('report_footfall', 'export');
  const canAdd = can('report_footfall', 'create');
  const canEdit = can('report_footfall', 'edit');
  const canDelete = can('report_footfall', 'delete');

  const dr = useDateRange('30d');
  const range = dr.range;
  const params = { from: range?.from, to: range?.to };
  const r = useReport<FootfallData>('/analytics/footfall', params, canView && !!range);
  const ent = useReport<Entry[]>('/analytics/footfall/entries', params, canView && !!range);
  const d = r.data;
  const s = d?.summary;
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const heat = useMemo(() => {
    if (!d) return null;
    const rows = WEEK_ORDER.map((w) => d.heatmap[w]);
    return { rows: rows.map((x) => x.label), cols: Array.from({ length: 24 }, (_, h) => hourLabel(h)), values: rows.map((x) => x.hours.map((h) => h.bills)) };
  }, [d]);

  const reloadAll = () => {
    r.reload();
    ent.reload();
  };

  const remove = async (e: Entry) => {
    if (busyId) return;
    if (!window.confirm(`Delete the visitor count of ${fmtDay(e.day)}?`)) return;
    setBusyId(e._id);
    try {
      await storeApi.del(`/analytics/footfall/entries/${e._id}`);
      toast.success('Visitor count deleted');
      reloadAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not delete.'));
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = async (part?: 'hours') => {
    try {
      await downloadCsv('/analytics/footfall/export', { ...params, part }, `footfall-${part || 'days'}-${range?.from}-${range?.to}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const exportPdf = () => {
    if (!d || !s) return;
    buildPdf({
      title: 'Footfall',
      subtitle: range?.label,
      summary: [
        ['Bills', fmtNum(s.bills)],
        ['Buyers', fmtNum(s.buyers)],
        ['Sales', formatRs(s.sales)],
        ['Average bill', formatRs(s.avgBill)],
        ['Items per bill', fmtNum(s.itemsPerBill, 2)],
        ['Bills per day', fmtNum(s.avgBillsPerDay, 1)],
        ['Visitors', s.visitors === null ? '-' : fmtNum(s.visitors)],
        ['Conversion', fmtPct(s.conversionPct)],
        ['Busiest hour', s.peakHour === null ? '-' : hourLabel(s.peakHour)],
        ['Busiest weekday', s.peakWeekday || '-'],
      ],
      tables: [
        {
          title: 'By day',
          head: ['Day', 'Weekday', 'Bills', 'Buyers', 'Sales', 'Avg bill', 'Items/bill', 'Visitors', 'Conv. %'],
          widths: [24, 16, 14, 14, 24, 20, 16, 16, 14],
          rows: d.days.map((x) => [fmtDay(x.day), x.weekday, x.bills, x.buyers, x.sales, x.avgBill, x.itemsPerBill, x.visitors, x.conversionPct]),
        },
        {
          title: 'By cashier',
          head: ['Cashier', 'Bills', 'Sales', 'Avg bill', 'Items/bill'],
          widths: [60, 20, 30, 25, 20],
          rows: d.byCashier.map((c) => [c.name, c.bills, c.sales, c.avgBill, c.itemsPerBill]),
        },
      ],
      fileName: `footfall-${range?.from}-${range?.to}`,
    });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  const entries = ent.data || [];

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        icon={<Footprints className="h-6 w-6" />}
        title="Footfall"
        subtitle="Buyers, bills and the average bill — when the shop is busy and who serves the most."
        actions={
          <>
            {canExport && (
              <button type="button" onClick={() => exportCsv('hours')} disabled={!d} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60" title="Bills per weekday and hour">
                <Download className="h-4 w-4" /> Hours CSV
              </button>
            )}
            <ReportActions canExport={canExport} onCsv={() => exportCsv()} onPdf={exportPdf} onRefresh={reloadAll} loading={r.loading} disabled={!d} />
          </>
        }
      />
      <ReportsNav />

      <FilterBar>
        <DateRangePicker state={dr} presets={['today', 'yesterday', '7d', '30d', 'month', 'lastMonth', '90d', 'custom']} />
      </FilterBar>

      {!range && <ErrorState message="Pick both dates of the custom range." />}
      {r.error && <ErrorState message={r.error} onRetry={reloadAll} />}

      {!d && r.loading ? (
        <LoadingBlock />
      ) : d && s ? (
        <>
          {s.bills === 0 ? (
            <Card>
              <EmptyState icon={<Users className="h-10 w-10" />} title="No bills in this period" text="Pick another period." />
            </Card>
          ) : (
            <>
                {heat && (
                  <Card title="Busy hours" subtitle="Bills by weekday and hour (Pakistan time) — darker = busier" bodyClass="p-3 sm:p-4">
                    <Heatmap rows={heat.rows} cols={heat.cols} values={heat.values} colEvery={2} minCell={26} rowWidth="w-12" cellLabel={(ri, ci) => `${heat.rows[ri]} ${heat.cols[ci]}: ${heat.values[ri][ci]} bills`} />
                  </Card>
                )}
            </>
          )}

          <Card title="Day by day">
            <SimpleTable
              head={['Day', 'Bills', 'Buyers', 'Avg bill', 'Items / bill', 'Sales', 'Visitors', 'Conversion']}
              rows={[...d.days].reverse().map((x) => [
                `${fmtDay(x.day, false)} ${x.weekday}`,
                fmtNum(x.bills),
                fmtNum(x.buyers),
                formatRs(x.avgBill),
                fmtNum(x.itemsPerBill, 2),
                formatRs(x.sales),
                x.visitors === null ? '—' : fmtNum(x.visitors),
                fmtPct(x.conversionPct),
              ])}
            />
          </Card>
        </>
      ) : null}

      {editing && (
        <EntryModal
          entry={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reloadAll();
          }}
        />
      )}
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <EmptyState title="No data" />;
  return (
    <div className="overflow-x-auto max-h-[28rem]">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 sticky top-0">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 ${i === 0 ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? 'text-left whitespace-nowrap' : 'text-right tabular-nums'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: Entry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [day, setDay] = useState(entry?.day || pktToday());
  const [visitors, setVisitors] = useState(entry ? String(entry.visitors) : '');
  const [note, setNote] = useState(entry?.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    if (!day) return setError('Pick the day.');
    if (visitors === '' || !(Number(visitors) >= 0)) return setError('Enter the number of visitors.');
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = { day, visitors: Number(visitors), note };
      if (entry) await storeApi.put(`/analytics/footfall/entries/${entry._id}`, body);
      else await storeApi.post('/analytics/footfall/entries', body);
      toast.success('Visitor count saved');
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      title={entry ? 'Edit visitor count' : 'Add visitor count'}
      subtitle="People who came into the shop on a day"
      icon={<Users className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryBtn} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={save} className={primaryBtn} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Day" required hint="Saving a day that already has a count replaces it.">
          <input type="date" value={day} max={pktToday()} onChange={(e) => setDay(e.target.value)} className={inputClass} />
        </Field>
        <Field label="People who came in" required>
          <input type="number" min={0} inputMode="numeric" value={visitors} onChange={(e) => setVisitors(e.target.value)} className={inputClass} placeholder="e.g. 240" />
        </Field>
        <Field label="Note">
          <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Door counter, Eid rush…" />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
