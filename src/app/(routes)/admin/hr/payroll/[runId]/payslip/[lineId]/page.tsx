'use client';

// Payslip on the DOLLAR & Co letterhead: print / save as PDF (A5 or A4), or
// send a short summary to the employee on WhatsApp.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { Wordmark, SHOP_NAME } from '@/components/ui/wordmark';
import { LoadingCard, NoAccessCard, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { hoursText, payrollApi, waNumber, type MoneyRow, type Payslip } from '../../../_shared/payrollApi';
import { ErrorCard } from '../../../_shared/PayrollBits';

type Paper = 'A5' | 'A4';

function MoneyTable({ title, rows, total, totalLabel }: { title: string; rows: MoneyRow[]; total: number; totalLabel: string }) {
  return (
    <table className="ps-table">
      <thead>
        <tr>
          <th>{title}</th>
          <th className="ps-num">Rs</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((r) => (
            <tr key={r.key}>
              <td>
                <div>{r.label}</div>
                {r.detail && <div className="ps-detail">{r.detail}</div>}
              </td>
              <td className="ps-num">{r.amount.toLocaleString('en-PK')}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="ps-detail">None</td>
            <td />
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <td>{totalLabel}</td>
          <td className="ps-num">{total.toLocaleString('en-PK')}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Slip({ data }: { data: Payslip }) {
  const { line, employee: e, run, letterhead: h, payment } = data;
  const a = line.attendance;
  const showName = h.shopName && h.shopName.trim().toLowerCase() !== SHOP_NAME.toLowerCase();
  const facts: [string, React.ReactNode][] = [
    ['Shift days', a.scheduledDaysInMonth],
    ['Days worked', a.daysWorked],
    ['Absent', a.absentDays],
    ['Half days', a.halfDays],
    ['Lates', a.lateCount],
    ['Leave', `${a.leave.paid + a.leave.sick + a.leave.unpaid}${a.leave.unpaidTotal ? ` (${a.leave.unpaidTotal} unpaid)` : ''}`],
    ['Overtime paid', a.overtimeMinutesPaid ? hoursText(a.overtimeMinutesPaid) : '—'],
  ];
  return (
    <article className="payslip">
      {run.status === 'draft' && <div className="ps-draft">DRAFT — not final</div>}
      <header className="ps-head">
        <div>
          <Wordmark tone="light" className="text-[28px]" />
          <div className="ps-shop">
            {showName && <div className="ps-shop-name">{h.shopName}</div>}
            {h.shopAddress && <div>{h.shopAddress}</div>}
            {h.shopPhone && <div>{h.shopPhone}</div>}
          </div>
        </div>
        <div className="ps-title">
          <div className="ps-title-main">PAYSLIP</div>
          <div>{run.monthLabel}</div>
          <div className="ps-muted">{data.payslipNo || run.runNo}</div>
        </div>
      </header>

      <section className="ps-grid">
        <div>
          <span>Name</span>
          <b>{e.name}</b>
        </div>
        <div>
          <span>Employee code</span>
          <b>{e.code || '—'}</b>
        </div>
        <div>
          <span>Designation</span>
          <b>{e.designation || '—'}</b>
        </div>
        <div>
          <span>CNIC</span>
          <b>{e.cnic || '—'}</b>
        </div>
        <div>
          <span>Joined</span>
          <b>{formatDate(e.joiningDate)}</b>
        </div>
        <div>
          <span>Pay</span>
          <b>{line.payType === 'daily' ? `${formatRs(line.dailyRate)} a day` : `${formatRs(line.salary)} a month`}</b>
        </div>
        <div>
          <span>Period</span>
          <b>
            {formatDate(run.from)} – {formatDate(run.to)}
          </b>
        </div>
        <div>
          <span>Paid</span>
          <b>{payment ? `${formatDate(payment.date)} · ${payment.methodLabel}${payment.reference ? ` · ${payment.reference}` : ''}` : 'Not paid yet'}</b>
        </div>
      </section>

      <section className="ps-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </section>

      <section className="ps-money">
        <MoneyTable title="Earnings" rows={line.earnings} total={line.gross} totalLabel="Gross pay" />
        <MoneyTable title="Deductions" rows={line.deductions} total={line.totalDeductions} totalLabel="Total deductions" />
      </section>

      <section className="ps-net">
        <div className="ps-net-row">
          <span>Net pay</span>
          <b>{formatRs(line.net)}</b>
        </div>
        <div className="ps-words">{data.netInWords}</div>
        {line.advanceRecovery > 0 && (
          <div className="ps-earned">
            Salary earned {formatRs(line.net + line.advanceRecovery)} = net pay {formatRs(line.net)} + advance recovered {formatRs(line.advanceRecovery)}
          </div>
        )}
      </section>

      {(line.note || line.notes.length > 0) && (
        <section className="ps-notes">
          {line.note && <p>{line.note}</p>}
          {line.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </section>
      )}

      <section className="ps-sign">
        {['Employee signature', 'Prepared by', 'Approved by'].map((s) => (
          <div key={s}>
            <div className="ps-sign-line" />
            <div className="ps-muted">{s}</div>
          </div>
        ))}
      </section>
      <footer className="ps-foot">Computer-made payslip · {h.shopName || SHOP_NAME}</footer>
    </article>
  );
}

export default function PayslipPage() {
  const { runId, lineId } = useParams<{ runId: string; lineId: string }>();
  const { can } = useAccess();
  const allowed = can('payroll', 'view');
  const [data, setData] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<Paper>('A5');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await payrollApi.payslip(runId, lineId);
      setData(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the payslip.'));
    } finally {
      setLoading(false);
    }
  }, [allowed, runId, lineId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <NoAccessCard />
      </div>
    );
  }

  const phone = data ? waNumber(data.employee.phone) : null;
  const share = () => {
    if (!data || !phone) return;
    const l = data.line;
    const text = [
      `${data.letterhead.shopName || SHOP_NAME} — Payslip ${data.run.monthLabel}`,
      `${l.name}${l.code ? ` (${l.code})` : ''}`,
      `Days worked: ${l.attendance.daysWorked}`,
      `Gross: ${formatRs(l.gross)}`,
      `Deductions: ${formatRs(l.totalDeductions)}`,
      `Net pay: ${formatRs(l.net)}`,
      data.payment ? `Paid ${formatDate(data.payment.date)} by ${data.payment.methodLabel}` : data.run.status === 'draft' ? 'Draft — not final yet' : 'To be paid',
    ].join('\n');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="mb-4 space-y-3">
          <Link href={`/admin/hr/payroll/${runId}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to payroll
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Payslip{data ? ` · ${data.line.name}` : ''}</h1>
              <p className="text-xs text-gray-500">Print it, or choose “Save as PDF” in the print window.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-sm" role="group" aria-label="Paper size">
                {(['A5', 'A4'] as Paper[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPaper(p)}
                    className={`px-3 py-1.5 rounded-md font-medium ${paper === p ? 'bg-honey-500 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={share}
                disabled={!data || !phone}
                className={secondaryBtn}
                title={data && !phone ? 'No mobile number (03xx…) on this employee' : 'Send on WhatsApp'}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
              <button type="button" onClick={() => window.print()} disabled={!data} className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 disabled:opacity-60">
                <Printer className="h-4 w-4" /> Print / PDF
              </button>
            </div>
          </div>
          {data && !phone && <p className="text-xs text-gray-500">Add a mobile number (03xx xxxxxxx) to the employee to share on WhatsApp.</p>}
        </div>

        {loading && !data ? (
          <LoadingCard text="Preparing the payslip…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : data ? (
          <div className={`bg-white shadow-sm border border-gray-200 rounded-lg mx-auto px-4 py-5 sm:px-8 sm:py-8 ${paper === 'A5' ? 'max-w-[148mm]' : 'max-w-[210mm]'}`}>
            <Slip data={data} />
          </div>
        ) : null}
      </div>

      {/* Print copy outside the admin layout, so only the payslip is printed. */}
      {mounted && data && createPortal(<div className={`payslip-print-root paper-${paper}`}><Slip data={data} /></div>, document.body)}

      <style>{`@page { size: ${paper}; margin: ${paper === 'A5' ? '8mm' : '14mm'}; }`}</style>
      <style jsx global>{`
        .payslip {
          position: relative;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          line-height: 1.45;
        }
        .payslip .ps-draft {
          position: absolute;
          top: 40%;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 40px;
          font-weight: 800;
          color: rgba(220, 38, 38, 0.12);
          transform: rotate(-18deg);
          pointer-events: none;
        }
        .payslip .ps-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          border-bottom: 3px solid #0a0a0a;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .payslip .ps-shop {
          margin-top: 4px;
          font-size: 10.5px;
          color: #4b5563;
        }
        .payslip .ps-shop-name {
          font-weight: 700;
          color: #111827;
        }
        .payslip .ps-title {
          text-align: right;
          font-size: 11px;
        }
        .payslip .ps-title-main {
          display: inline-block;
          background: #ffd60a;
          color: #0a0a0a;
          font-weight: 800;
          letter-spacing: 0.12em;
          padding: 2px 10px;
          border-radius: 4px;
          margin-bottom: 2px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .payslip .ps-muted {
          color: #6b7280;
          font-size: 10.5px;
        }
        .payslip .ps-grid,
        .payslip .ps-facts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 4px 16px;
          margin-bottom: 10px;
        }
        .payslip .ps-facts {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          background: #fffceb;
          border: 1px solid #ffed8a;
          border-radius: 6px;
          padding: 6px 8px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .payslip .ps-grid > div,
        .payslip .ps-facts > div {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .payslip .ps-grid span,
        .payslip .ps-facts span {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #6b7280;
        }
        .payslip .ps-grid b {
          font-weight: 600;
          overflow-wrap: anywhere;
        }
        .payslip .ps-money {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 10px;
        }
        .payslip .ps-table {
          width: 100%;
          border-collapse: collapse;
        }
        .payslip .ps-table th {
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1.5px solid #111827;
          padding: 3px 0;
        }
        .payslip .ps-table td {
          border-bottom: 1px solid #e5e7eb;
          padding: 4px 0;
          vertical-align: top;
        }
        .payslip .ps-table tfoot td {
          border-bottom: none;
          border-top: 1.5px solid #111827;
          font-weight: 700;
        }
        .payslip .ps-num {
          text-align: right !important;
          white-space: nowrap;
          padding-left: 8px !important;
          font-variant-numeric: tabular-nums;
        }
        .payslip .ps-detail {
          font-size: 9.5px;
          color: #6b7280;
          line-height: 1.3;
        }
        .payslip .ps-net {
          border: 2px solid #0a0a0a;
          border-radius: 6px;
          padding: 6px 10px;
          margin-bottom: 10px;
          break-inside: avoid;
        }
        .payslip .ps-net-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 13px;
          font-weight: 700;
        }
        .payslip .ps-net-row b {
          font-size: 18px;
        }
        .payslip .ps-words {
          font-size: 11px;
          font-style: italic;
          color: #374151;
        }
        .payslip .ps-earned {
          margin-top: 3px;
          font-size: 10.5px;
          color: #4b5563;
        }
        .payslip .ps-notes {
          font-size: 10.5px;
          color: #374151;
          margin-bottom: 8px;
        }
        .payslip .ps-sign {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 26px;
          break-inside: avoid;
        }
        .payslip .ps-sign-line {
          height: 28px;
          border-bottom: 1px solid #111827;
        }
        .payslip .ps-foot {
          margin-top: 10px;
          text-align: center;
          font-size: 9px;
          color: #9ca3af;
        }
        @media (max-width: 560px) {
          .payslip .ps-money {
            grid-template-columns: 1fr;
          }
          .payslip .ps-facts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .payslip-print-root {
          display: none;
        }
        @media print {
          body > *:not(.payslip-print-root) {
            display: none !important;
          }
          body {
            background: #fff !important;
          }
          .payslip-print-root {
            display: block;
          }
          .payslip-print-root .payslip .ps-money {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .payslip-print-root .payslip .ps-facts {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .payslip-print-root.paper-A5 .payslip {
            font-size: 10.5px;
          }
        }
      `}</style>
    </div>
  );
}
