// Investment report PDF: page 1 is the summary (total, share bar, partner
// table), then each partner gets their own page(s) with every bill and its
// payments. A last section lists bills that have no partner yet.
import jsPDF from 'jspdf';
import { formatDate, formatRs } from '@/lib/storeApi';

/** One colour per partner, same order on the page and in the PDF. */
export const PARTNER_COLORS = ['#f5b931', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#22d3ee', '#a3e635'];
export const partnerColor = (i: number) => PARTNER_COLORS[i % PARTNER_COLORS.length];

export interface PdfPartner {
  _id: string;
  name: string;
  phone: string;
  invested: number;
  balance: number;
  bills: number;
  share: number;
}

export interface PdfBill {
  _id: string;
  title: string;
  amount: number;
  paidAmount: number;
  balance: number;
  date: string;
  billNo: string;
  paidTo: string;
  note: string;
  partner: { _id: string } | null;
  payments: { amount: number; date: string; note: string }[];
}

export interface PdfSummary {
  totalInvested: number;
  billsTotal: number;
  balance: number;
  dueBills: number;
  entries: number;
  since: string | null;
  noPartner: number;
  noPartnerBills: number;
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const A4_W = 210;
const A4_H = 297;
const M = 14;
const W = A4_W - 2 * M;
const BOTTOM = A4_H - 18;
const DARK: [number, number, number] = [17, 24, 39];
const GREY: [number, number, number] = [107, 114, 128];
const LIGHT: [number, number, number] = [243, 244, 246];
const AMBER: [number, number, number] = [180, 83, 9];
const GREEN: [number, number, number] = [21, 128, 61];

// Bill table columns: x offset from margin, width, align.
const COLS = [
  { key: 'date', label: 'Date', x: 0, w: 24, align: 'left' as const },
  { key: 'what', label: 'What', x: 24, w: 76, align: 'left' as const },
  { key: 'total', label: 'Bill total', x: 100, w: 27, align: 'right' as const },
  { key: 'paid', label: 'Paid', x: 127, w: 27, align: 'right' as const },
  { key: 'bal', label: 'Balance', x: 154, w: 28, align: 'right' as const },
];

export function buildInvestmentPdf({
  storeName,
  summary,
  partners,
  bills,
}: {
  storeName: string;
  summary: PdfSummary;
  partners: PdfPartner[];
  bills: PdfBill[];
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const generated = formatDate(new Date(), true);

  const text = (s: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center' } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size ?? 9);
    doc.setTextColor(...(opts.color ?? DARK));
    doc.text(s, x, y, { align: opts.align ?? 'left' });
  };

  const tile = (x: number, y: number, w: number, label: string, value: string, color: [number, number, number] = DARK) => {
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, w, 16, 2, 2, 'F');
    text(label, x + 3, y + 5.5, { size: 7.5, color: GREY });
    text(value, x + 3, y + 12, { size: 11, bold: true, color });
  };

  /** Stacked share bar: one segment per partner, by money paid. */
  const shareBar = (y: number, h: number) => {
    doc.setFillColor(...LIGHT);
    doc.roundedRect(M, y, W, h, h / 2, h / 2, 'F');
    const total = summary.totalInvested;
    if (total <= 0) return;
    let x = M;
    partners.forEach((p, i) => {
      if (p.invested <= 0) return;
      const w = (p.invested / total) * W;
      doc.setFillColor(...rgb(partnerColor(i)));
      doc.rect(x, y, w, h, 'F');
      x += w;
    });
  };

  // ------------------------------------------------------------ summary page
  doc.setFillColor(...DARK);
  doc.rect(0, 0, A4_W, 34, 'F');
  text(storeName, M, 13, { size: 10, color: [209, 213, 219] });
  text('Investment report', M, 24, { size: 18, bold: true, color: [255, 255, 255] });
  text(`Generated ${generated}`, A4_W - M, 13, { size: 8, color: [156, 163, 175], align: 'right' });
  if (summary.since) text(`Since ${formatDate(summary.since)}`, A4_W - M, 24, { size: 9, color: [209, 213, 219], align: 'right' });

  let y = 46;
  text('Total invested (paid)', M, y, { size: 9, color: GREY });
  text(formatRs(summary.totalInvested), M, y + 11, { size: 24, bold: true, color: [183, 121, 0] });
  y += 18;
  const tw = (W - 8) / 3;
  tile(M, y, tw, 'Bills worth', `${formatRs(summary.billsTotal)} (${summary.entries})`);
  tile(M + tw + 4, y, tw, 'Paid', formatRs(summary.totalInvested), GREEN);
  tile(M + 2 * (tw + 4), y, tw, 'Balance to pay', summary.balance > 0 ? `${formatRs(summary.balance)} (${summary.dueBills})` : 'Nil', summary.balance > 0 ? AMBER : GREEN);
  y += 26;

  text('Share of money paid', M, y, { size: 10, bold: true });
  y += 4;
  shareBar(y, 6);
  y += 14;

  // Partner table
  const pc = [
    { label: 'Partner', x: 0, align: 'left' as const },
    { label: 'Paid in', x: 92, align: 'right' as const },
    { label: 'Share', x: 112, align: 'right' as const },
    { label: 'Bills', x: 128, align: 'right' as const },
    { label: 'Still to pay', x: 158, align: 'right' as const },
    { label: 'Page', x: 182, align: 'right' as const },
  ];
  doc.setFillColor(...LIGHT);
  doc.rect(M, y - 5, W, 8, 'F');
  pc.forEach((c) => text(c.label, M + c.x + (c.align === 'right' ? 0 : 2), y, { size: 8, bold: true, color: GREY, align: c.align }));
  y += 8;
  const pageCells: { y: number }[] = [];
  partners.forEach((p, i) => {
    doc.setFillColor(...rgb(partnerColor(i)));
    doc.roundedRect(M + 2, y - 3, 3, 3, 0.6, 0.6, 'F');
    text(p.name, M + 7, y, { size: 9.5, bold: true });
    if (p.phone) text(p.phone, M + 7, y + 4, { size: 7.5, color: GREY });
    text(formatRs(p.invested), M + 92, y, { size: 9.5, bold: true, align: 'right' });
    text(`${p.share}%`, M + 112, y, { size: 9, align: 'right' });
    text(String(p.bills), M + 128, y, { size: 9, align: 'right' });
    text(p.balance > 0 ? formatRs(p.balance) : '-', M + 158, y, { size: 9, color: p.balance > 0 ? AMBER : GREY, align: 'right' });
    pageCells.push({ y });
    doc.setDrawColor(229, 231, 235);
    doc.line(M, y + 6.5, M + W, y + 6.5);
    y += 11;
  });
  if (summary.noPartnerBills > 0) {
    text('No partner yet', M + 7, y, { size: 9.5, color: AMBER });
    text(formatRs(summary.noPartner), M + 92, y, { size: 9.5, align: 'right' });
    text(String(summary.noPartnerBills), M + 128, y, { size: 9, align: 'right' });
    y += 11;
  }
  doc.setDrawColor(...DARK);
  doc.line(M, y - 4, M + W, y - 4);
  text('Total', M + 2, y + 1, { size: 9.5, bold: true });
  text(formatRs(summary.totalInvested), M + 92, y + 1, { size: 9.5, bold: true, align: 'right' });
  text(String(summary.entries), M + 128, y + 1, { size: 9, bold: true, align: 'right' });
  text(summary.balance > 0 ? formatRs(summary.balance) : '-', M + 158, y + 1, { size: 9, bold: true, color: summary.balance > 0 ? AMBER : GREY, align: 'right' });

  // ------------------------------------------------------- per partner pages
  const tableHead = (yy: number) => {
    doc.setFillColor(...LIGHT);
    doc.rect(M, yy - 5, W, 8, 'F');
    COLS.forEach((c) => text(c.label, M + c.x + (c.align === 'right' ? c.w - 2 : 2), yy, { size: 8, bold: true, color: GREY, align: c.align }));
    return yy + 8;
  };

  const sectionPage = (title: string, color: string, sub: string, cont: boolean) => {
    doc.addPage();
    doc.setFillColor(...rgb(color));
    doc.rect(0, 0, A4_W, 3, 'F');
    text(cont ? `${title} (continued)` : title, M, 16, { size: cont ? 12 : 17, bold: true });
    text(storeName, A4_W - M, 11, { size: 8, color: GREY, align: 'right' });
    if (!cont && sub) text(sub, M, 22.5, { size: 9, color: GREY });
    return cont ? 26 : 30;
  };

  /** Draws one person's (or "no partner") section of bills, page-breaking as needed. */
  const section = (
    title: string,
    color: string,
    sub: string,
    tiles: [string, string, [number, number, number]?][],
    rows: PdfBill[],
  ) => {
    let yy = sectionPage(title, color, sub, false);
    const w4 = (W - 3 * 4) / 4;
    tiles.forEach(([l, v, c], i) => tile(M + i * (w4 + 4), yy, w4, l, v, c));
    yy += 26;
    text(`Bills (${rows.length})`, M, yy, { size: 10, bold: true });
    yy = tableHead(yy + 7);

    if (rows.length === 0) {
      text('No bills yet.', M + 2, yy + 2, { size: 9, color: GREY });
      return;
    }

    let sumTotal = 0;
    let sumPaid = 0;
    let sumBal = 0;
    rows.forEach((b, idx) => {
      const titleLines: string[] = doc.setFontSize(9.5).splitTextToSize(b.title, COLS[1].w - 4);
      const meta = [b.billNo && `Bill ${b.billNo}`, b.paidTo && `Paid to ${b.paidTo}`].filter(Boolean).join('  |  ');
      const noteLines: string[] = b.note ? doc.setFontSize(7.5).splitTextToSize(b.note, COLS[1].w - 4).slice(0, 2) : [];
      // Show the payment list when a bill was paid in parts or still has a balance.
      const showPays = b.payments.length > 1 || (b.balance > 0 && b.payments.length > 0);
      const h = 4.5 * titleLines.length + (meta ? 4 : 0) + 3.6 * noteLines.length + (showPays ? 4 + 3.8 * b.payments.length : 0) + 4;

      if (yy + h > BOTTOM) {
        yy = tableHead(sectionPage(title, color, sub, true) + 2);
      }
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(M, yy - 4.5, W, h, 'F');
      }
      const top = yy;
      text(formatDate(b.date), M + 2, top, { size: 8.5 });
      titleLines.forEach((ln, i) => text(ln, M + COLS[1].x + 2, top + i * 4.5, { size: 9.5, bold: true }));
      let ly = top + 4.5 * titleLines.length;
      if (meta) {
        text(meta, M + COLS[1].x + 2, ly - 0.5, { size: 7.5, color: GREY });
        ly += 4;
      }
      noteLines.forEach((ln) => {
        text(ln, M + COLS[1].x + 2, ly - 0.5, { size: 7.5, color: [156, 163, 175] });
        ly += 3.6;
      });
      text(formatRs(b.amount), M + COLS[2].x + COLS[2].w - 2, top, { size: 9, align: 'right' });
      text(formatRs(b.paidAmount), M + COLS[3].x + COLS[3].w - 2, top, { size: 9, color: GREEN, align: 'right' });
      text(b.balance > 0 ? formatRs(b.balance) : 'Paid in full', M + COLS[4].x + COLS[4].w - 2, top, {
        size: b.balance > 0 ? 9 : 8,
        bold: b.balance > 0,
        color: b.balance > 0 ? AMBER : GREEN,
        align: 'right',
      });
      if (showPays) {
        text('Payments', M + COLS[1].x + 2, ly + 0.5, { size: 7, bold: true, color: GREY });
        ly += 4;
        b.payments.forEach((p, i) => {
          const line = `${i + 1}. ${formatRs(p.amount)} on ${formatDate(p.date)}${p.note ? `  -  ${p.note}` : ''}`;
          const fit: string = doc.setFontSize(7.5).splitTextToSize(line, W - COLS[1].x - 4)[0];
          text(fit, M + COLS[1].x + 4, ly, { size: 7.5, color: GREY });
          ly += 3.8;
        });
      }
      yy += h;
      sumTotal += b.amount;
      sumPaid += b.paidAmount;
      sumBal += b.balance;
    });

    if (yy + 10 > BOTTOM) yy = tableHead(sectionPage(title, color, sub, true) + 2);
    doc.setDrawColor(...DARK);
    doc.line(M, yy - 3.5, M + W, yy - 3.5);
    text('Total', M + 2, yy + 1.5, { size: 9.5, bold: true });
    text(formatRs(sumTotal), M + COLS[2].x + COLS[2].w - 2, yy + 1.5, { size: 9.5, bold: true, align: 'right' });
    text(formatRs(sumPaid), M + COLS[3].x + COLS[3].w - 2, yy + 1.5, { size: 9.5, bold: true, color: GREEN, align: 'right' });
    text(sumBal > 0 ? formatRs(Math.round(sumBal * 100) / 100) : '-', M + COLS[4].x + COLS[4].w - 2, yy + 1.5, { size: 9.5, bold: true, color: sumBal > 0 ? AMBER : GREY, align: 'right' });
  };

  const byDate = (a: PdfBill, b: PdfBill) => new Date(a.date).getTime() - new Date(b.date).getTime();
  const startPages: number[] = [];

  partners.forEach((p, i) => {
    startPages.push(doc.getNumberOfPages() + 1);
    const rows = bills.filter((b) => b.partner?._id === p._id).sort(byDate);
    const worth = rows.reduce((s, b) => s + b.amount, 0);
    section(
      p.name,
      partnerColor(i),
      [p.phone, `${p.share}% of all money paid in`].filter(Boolean).join('  |  '),
      [
        ['Paid in', formatRs(p.invested), GREEN],
        ['Bills worth', formatRs(worth)],
        ['Still to pay', p.balance > 0 ? formatRs(p.balance) : 'Nil', p.balance > 0 ? AMBER : GREEN],
        ['Share', `${p.share}%`],
      ],
      rows,
    );
  });

  const orphans = bills.filter((b) => !b.partner).sort(byDate);
  if (orphans.length) {
    const bal = orphans.reduce((s, b) => s + b.balance, 0);
    section(
      'No partner yet',
      '#9ca3af',
      'Edit these bills in the app to pick the partner who paid.',
      [
        ['Paid', formatRs(summary.noPartner), GREEN],
        ['Bills worth', formatRs(orphans.reduce((s, b) => s + b.amount, 0))],
        ['Still to pay', bal > 0 ? formatRs(bal) : 'Nil', bal > 0 ? AMBER : GREEN],
        ['Bills', String(orphans.length)],
      ],
      orphans,
    );
  }

  // Page numbers on the summary partner table, then footers on every page.
  doc.setPage(1);
  pageCells.forEach((c, i) => text(String(startPages[i]), M + 182, c.y, { size: 9, color: GREY, align: 'right' }));

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.line(M, A4_H - 12, A4_W - M, A4_H - 12);
    text(`${storeName}  |  Investment report  |  ${generated}`, M, A4_H - 7, { size: 7.5, color: GREY });
    text(`Page ${i} of ${pages}`, A4_W - M, A4_H - 7, { size: 7.5, color: GREY, align: 'right' });
  }

  return doc;
}
