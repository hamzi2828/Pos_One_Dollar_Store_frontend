// Printable cash closing PDFs, drawn with jsPDF (real text + tables, not a screenshot):
//   downloadTillOverviewPdf(till)          one till: figures, notes, expenses, history
//   downloadTillBillsPdf(till)             one till: every bill
//   downloadCombinedDayPdf(tills, label)   one shop day, every counter (landscape)
// Same figures as /admin/till/[id] and Cash Closing -> Combined -> day.

import type jsPDFType from 'jspdf';
import { formatRs } from '@/lib/storeApi';
import { paymentMethodLabel } from '../../pos/utils/paymentMethods';
import type { CashCount } from '@/components/store/TillStatusBar';
import type { TillDetail } from './tillUi';

/* ------------------------------------------------------------------ figures */

const r2 = (n: number) => Math.round(n * 100) / 100;

/** One till's figures, the same way the till page works them out. */
export function tillFigures(t: TillDetail) {
  const e = t.expected || t.liveExpected || null;
  // Change money: opening float vs what was left in the drawer (the till page's "Till" box).
  const drawer = t.drawerCount ?? (t.dayCash ? null : t.closingCount);
  return {
    float: t.openingFloat?.total ?? e?.float ?? 0,
    drawer: drawer ? drawer.total : null,
    drawerCount: drawer || null,
    sysCash: e ? r2(e.cashSales + e.cashReceivedOnCredit - e.cashRefunds) : 0,
    sysCard: t.nonCash?.card ?? e?.card ?? 0,
    sysBank: t.nonCash?.bank_transfer ?? e?.bankTransfer ?? 0,
    sysJazz: t.nonCash?.jazzcash ?? e?.jazzcash ?? 0,
    expenses: e?.expenses || 0,
    cash: t.dayCash ? t.dayCash.total : null,
    card: t.cardTotal ?? null,
    bank: t.bankTransferTotal ?? null,
    jazz: t.jazzcashTotal ?? null,
    discounts: (t.discounts || []).reduce((s, d) => s + d.discount, 0),
    cashSales: e?.cashSales || 0,
    credit: e?.cashReceivedOnCredit || 0,
    refunds: e?.cashRefunds || 0,
  };
}
export type TillFigs = ReturnType<typeof tillFigures>;

/** Handed over vs should hand over, change money, total. null = nothing written yet. */
export function rowFigures(f: TillFigs) {
  const given =
    f.cash == null && f.card == null && f.bank == null && f.jazz == null ? null : (f.cash || 0) + (f.card || 0) + (f.bank || 0) + (f.jazz || 0);
  const should = r2(f.sysCash + f.sysCard + f.sysBank + f.sysJazz - f.expenses);
  return {
    given,
    should,
    /** Sales over (+) / short (-). */
    salesDiff: given == null ? null : r2(given - should),
    /** Change money over / short; null = drawer not counted. */
    changeDiff: f.drawer == null ? null : r2(f.drawer - f.float),
    totalDiff: given == null ? null : r2(given + (f.drawer ?? f.float) - (should + f.float)),
  };
}

/* ---------------------------------------------------------------- pdf kit */

type RGB = [number, number, number];
const C = {
  ink: [17, 24, 39] as RGB,
  text: [55, 65, 81] as RGB,
  muted: [107, 114, 128] as RGB,
  faint: [156, 163, 175] as RGB,
  line: [229, 231, 235] as RGB,
  head: [243, 244, 246] as RGB,
  zebra: [250, 250, 250] as RGB,
  honey: [255, 214, 10] as RGB,
  honeyBg: [255, 252, 235] as RGB,
  red: [220, 38, 38] as RGB,
  redBg: [254, 242, 242] as RGB,
  green: [22, 163, 74] as RGB,
  greenBg: [240, 253, 244] as RGB,
  amber: [180, 83, 9] as RGB,
  amberBg: [255, 251, 235] as RGB,
};

type Cell = string | { text: string; bold?: boolean; color?: RGB };
interface Col {
  header: string;
  /** Share of the table width. */
  w: number;
  align?: 'left' | 'right' | 'center';
}
interface Card {
  label: string;
  value: string;
  sub?: string;
  tone?: 'red' | 'green' | 'amber' | 'plain';
}

const pk = (d: string | null | undefined, withDate = true) =>
  d
    ? new Date(d).toLocaleString('en-PK', {
        timeZone: 'Asia/Karachi',
        ...(withDate ? { day: 'numeric', month: 'short', year: 'numeric' } : {}),
        hour: 'numeric',
        minute: '2-digit',
      })
    : '-';
// jsPDF's built-in font has no "−" / "→" / "—"; keep to plain characters.
const plain = (s: string) =>
  s
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\u2192/g, 'to')
    .replace(/[^\n\x20-\x7E\u00A0-\u00FF]/g, '');
const money = (n: number | null | undefined) => (n == null ? '-' : formatRs(n));
const neg = (n: number) => (n ? `- ${formatRs(n)}` : '-');

/** "OK" / "Short Rs 7,100" / "Over Rs 50" as a coloured cell. */
function diffCell(d: number | null, short = false): Cell {
  if (d == null) return { text: '-', color: C.faint };
  if (Math.abs(d) < 1) return { text: 'OK', bold: true, color: C.green };
  const amt = short ? Math.abs(d).toLocaleString('en-PK', { maximumFractionDigits: 2 }) : formatRs(Math.abs(d));
  return { text: `${d < 0 ? 'Short' : 'Over'} ${amt}`, bold: true, color: d < 0 ? C.red : C.amber };
}
function diffCard(label: string, d: number | null, sub?: string): Card {
  if (d == null) return { label, value: '-', sub: sub || 'not written yet' };
  if (Math.abs(d) < 1) return { label, value: 'OK', sub, tone: 'green' };
  return { label, value: `${d < 0 ? 'Short' : 'Over'} ${formatRs(Math.abs(d))}`, sub, tone: d < 0 ? 'red' : 'amber' };
}

class Report {
  pdf: jsPDFType;
  m = 12;
  W: number;
  H: number;
  y = 0;
  footerLeft: string;

  constructor(pdf: jsPDFType, footerLeft: string) {
    this.pdf = pdf;
    this.W = pdf.internal.pageSize.getWidth();
    this.H = pdf.internal.pageSize.getHeight();
    this.footerLeft = footerLeft;
    this.y = this.m;
  }

  get inner() {
    return this.W - this.m * 2;
  }
  get bottom() {
    return this.H - this.m - 6;
  }

  font(size: number, bold = false, color: RGB = C.text) {
    this.pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...color);
  }
  fill(c: RGB) {
    this.pdf.setFillColor(...c);
  }
  stroke(c: RGB, w = 0.2) {
    this.pdf.setDrawColor(...c);
    this.pdf.setLineWidth(w);
  }
  text(s: string, x: number, y: number, opts: { align?: 'left' | 'right' | 'center' } = {}) {
    this.pdf.text(plain(s), x, y, { align: opts.align || 'left', baseline: 'alphabetic' });
  }

  newPage() {
    this.pdf.addPage();
    this.y = this.m;
  }
  ensure(h: number) {
    if (this.y + h > this.bottom) this.newPage();
  }
  gap(h = 4) {
    this.y += h;
  }

  /** Yellow brand band + report title + facts grid. */
  header(kind: string, title: string, facts: [string, string][], badge?: { text: string; tone: 'red' | 'green' | 'amber' | 'plain' }) {
    const { pdf, m } = this;
    this.fill(C.honey);
    pdf.rect(0, 0, this.W, 16, 'F');
    this.font(13, true, C.ink);
    this.text('DOLLAR & Co', m, 10.5);
    this.font(9, false, C.ink);
    this.text(kind, this.W - m, 10.5, { align: 'right' });
    this.y = 26;
    this.font(16, true, C.ink);
    this.text(title, m, this.y);
    if (badge) {
      // Status pill right after the title.
      const tx = m + pdf.getTextWidth(plain(title)) + 4;
      const fg = badge.tone === 'red' ? C.red : badge.tone === 'green' ? C.green : badge.tone === 'amber' ? C.amber : C.text;
      const bg = badge.tone === 'red' ? C.redBg : badge.tone === 'green' ? C.greenBg : badge.tone === 'amber' ? C.amberBg : C.zebra;
      this.font(8, true, fg);
      const bw = pdf.getTextWidth(plain(badge.text)) + 6;
      this.fill(bg);
      this.stroke(fg, 0.3);
      pdf.roundedRect(tx, this.y - 5, bw, 6, 3, 3, 'FD');
      this.text(badge.text, tx + 3, this.y - 0.9);
    }
    this.y += 4;

    // Facts: label over value, up to 4 per line.
    const per = Math.min(4, facts.length) || 1;
    const cw = this.inner / per;
    for (let i = 0; i < facts.length; i += per) {
      this.y += 5;
      facts.slice(i, i + per).forEach(([label, value], j) => {
        const x = m + j * cw;
        this.font(7, false, C.muted);
        this.text(label.toUpperCase(), x, this.y);
        this.font(9.5, true, C.ink);
        const lines = pdf.splitTextToSize(plain(value), cw - 3) as string[];
        this.text(lines[0] || '-', x, this.y + 4.5);
      });
      this.y += 5;
    }
    this.y += 4;
    this.stroke(C.line, 0.3);
    pdf.line(m, this.y, this.W - m, this.y);
    this.y += 5;
  }

  /** Big summary boxes in one row. */
  cards(cards: Card[], compact = false) {
    const { pdf, m } = this;
    const h = compact ? 13.5 : 17;
    this.ensure(h + 4);
    const gap = 3;
    const w = (this.inner - gap * (cards.length - 1)) / cards.length;
    cards.forEach((c, i) => {
      const x = m + i * (w + gap);
      const tone = c.tone || 'plain';
      const bg = tone === 'red' ? C.redBg : tone === 'green' ? C.greenBg : tone === 'amber' ? C.amberBg : C.zebra;
      const fg = tone === 'red' ? C.red : tone === 'green' ? C.green : tone === 'amber' ? C.amber : C.ink;
      this.fill(bg);
      this.stroke(tone === 'plain' ? C.line : fg, 0.3);
      pdf.roundedRect(x, this.y, w, h, 1.5, 1.5, 'FD');
      this.font(compact ? 6.5 : 7, false, C.muted);
      this.text(c.label.toUpperCase(), x + 3, this.y + (compact ? 4.2 : 5));
      this.font(compact ? 11 : 13, true, fg);
      this.text(c.value, x + 3, this.y + (compact ? 8.8 : 10.5));
      if (c.sub) {
        this.font(compact ? 6.5 : 7, false, C.muted);
        this.text(c.sub, x + 3, this.y + (compact ? 12 : 14.5));
      }
    });
    this.y += h + (compact ? 5 : 6);
  }

  section(title: string, right?: string, big = false) {
    // Room for the title + a table header + a row, so a title never sits alone at the page end.
    this.ensure(26);
    this.font(big ? 11 : 9, true, C.ink);
    this.text(title.toUpperCase(), this.m, this.y);
    if (right) {
      this.font(9, true, C.ink);
      this.text(right, this.W - this.m, this.y, { align: 'right' });
    }
    this.y += 1.8;
    this.fill(C.honey);
    this.pdf.rect(this.m, this.y, big ? 20 : 14, big ? 1.1 : 0.8, 'F');
    this.y += 3.5;
  }

  note(s: string, color: RGB = C.muted, size = 8) {
    this.font(size, false, color);
    const lines = this.pdf.splitTextToSize(plain(s), this.inner) as string[];
    this.ensure(lines.length * 3.8 + 1);
    lines.forEach((l) => {
      this.y += 3.6;
      this.text(l, this.m, this.y);
    });
    this.y += 2;
  }

  /** Coloured box with a message (warnings). */
  callout(s: string, tone: 'amber' | 'red' | 'plain' = 'amber') {
    const bg = tone === 'red' ? C.redBg : tone === 'amber' ? C.amberBg : C.zebra;
    const fg = tone === 'red' ? C.red : tone === 'amber' ? C.amber : C.text;
    this.font(8.5, false, fg);
    const lines = this.pdf.splitTextToSize(plain(s), this.inner - 6) as string[];
    const h = lines.length * 4 + 4;
    this.ensure(h + 3);
    this.fill(bg);
    this.stroke(fg, 0.2);
    this.pdf.roundedRect(this.m, this.y, this.inner, h, 1.2, 1.2, 'FD');
    lines.forEach((l, i) => this.text(l, this.m + 3, this.y + 5 + i * 4));
    this.y += h + 4;
  }

  /**
   * Table with a grey header, zebra rows and wrapping cells. Breaks across pages
   * (header repeated). `foot` rows are bold on a tinted band.
   */
  table(
    cols: Col[],
    rows: Cell[][],
    {
      foot = [],
      x = this.m,
      width = this.inner,
      size = 8.5,
      pad = 2,
      groups,
      groupFill,
    }: {
      foot?: Cell[][];
      x?: number;
      width?: number;
      size?: number;
      pad?: number;
      /** Group labels drawn above the header, each spanning `span` columns ('' = no label). */
      groups?: { label: string; span: number }[];
      /** Background of the labelled group cells (default grey). */
      groupFill?: RGB;
    } = {}
  ) {
    const { pdf } = this;
    const total = cols.reduce((t, c) => t + c.w, 0);
    const ws = cols.map((c) => (c.w / total) * width);
    // Edges of labelled groups: thin vertical lines there split the table into blocks.
    const groupX: { x: number; w: number; label: string }[] = [];
    const edges = new Set<number>();
    if (groups) {
      let ci = 0;
      let gx = x;
      for (const g of groups) {
        const gw = ws.slice(ci, ci + g.span).reduce((t, w) => t + w, 0);
        groupX.push({ x: gx, w: gw, label: g.label });
        if (g.label) {
          if (gx > x + 0.1) edges.add(gx);
          if (gx + gw < x + width - 0.1) edges.add(gx + gw);
        }
        gx += gw;
        ci += g.span;
      }
    }
    const edgeLines = (top: number, h: number) => {
      if (!edges.size) return;
      this.stroke(C.line, 0.2);
      edges.forEach((ex) => pdf.line(ex, top, ex, top + h));
    };
    const drawGroups = () => {
      if (!groups) return;
      const fs = size - 1.2;
      const h = fs * 0.42 + 2.6;
      this.fill(C.head);
      pdf.rect(x, this.y, width, h, 'F');
      groupX.forEach((g) => {
        if (!g.label) return;
        if (groupFill) {
          this.fill(groupFill);
          pdf.rect(g.x, this.y, g.w, h, 'F');
        }
        this.font(fs, true, C.ink);
        this.text(g.label.toUpperCase(), g.x + g.w / 2, this.y + 2 + fs * 0.42 * 0.8, { align: 'center' });
        this.stroke(C.faint, 0.2);
        pdf.line(g.x + 1.5, this.y + h, g.x + g.w - 1.5, this.y + h);
      });
      edgeLines(this.y, h);
      this.y += h;
    };

    const cellText = (c: Cell) => (typeof c === 'string' ? c : c.text);
    // Wraps to the column; a line break in the text starts a new line.
    const wrap = (txt: string, w: number) => plain(txt ?? '').split('\n').flatMap((p) => pdf.splitTextToSize(p, w) as string[]);
    const measure = (r: Cell[], kind: 'head' | 'body' | 'foot') => {
      const fs = kind === 'head' ? size - 1 : size;
      this.font(fs, kind !== 'body');
      const lines = r.map((c, i) => wrap(kind === 'head' ? cellText(c).toUpperCase() : cellText(c), ws[i] - pad * 2));
      return { lines, h: Math.max(1, ...lines.map((l) => l.length)) * fs * 0.42 + 2.8, flh: fs * 0.42 };
    };
    const drawRow = (r: Cell[], kind: 'head' | 'body' | 'foot', zebra: boolean) => {
      const bold = kind !== 'body';
      const { lines, h, flh } = measure(r, kind);
      if (kind !== 'head' && this.y + h > this.bottom) {
        this.newPage();
        drawGroups();
        drawRow(cols.map((c) => c.header), 'head', false);
      }
      if (kind === 'head') {
        this.fill(C.head);
        pdf.rect(x, this.y, width, h, 'F');
      } else if (kind === 'foot') {
        this.fill(C.honeyBg);
        pdf.rect(x, this.y, width, h, 'F');
      } else if (zebra) {
        this.fill(C.zebra);
        pdf.rect(x, this.y, width, h, 'F');
      }
      let cx = x;
      r.forEach((c, i) => {
        const col = cols[i];
        const st: { bold?: boolean; color?: RGB } = typeof c === 'string' ? {} : c;
        this.font(kind === 'head' ? size - 1 : size, bold || !!st.bold, kind === 'head' ? C.muted : st.color || (kind === 'foot' ? C.ink : C.text));
        const align = col.align || 'left';
        const tx = align === 'right' ? cx + ws[i] - pad : align === 'center' ? cx + ws[i] / 2 : cx + pad;
        lines[i].forEach((l, li) => this.text(l, tx, this.y + 2.2 + flh * (li + 0.8), { align }));
        cx += ws[i];
      });
      edgeLines(this.y, h);
      this.y += h;
      this.stroke(kind === 'foot' ? C.faint : C.line, kind === 'foot' ? 0.3 : 0.15);
      pdf.line(x, this.y, x + width, this.y);
    };

    this.ensure(measure(cols.map((c) => c.header), 'head').h + measure(rows[0] || foot[0] || [], 'body').h + (groups ? 6 : 2));
    drawGroups();
    drawRow(cols.map((c) => c.header), 'head', false);
    rows.forEach((r, i) => drawRow(r, 'body', i % 2 === 1));
    foot.forEach((r) => drawRow(r, 'foot', false));
    this.y += 6;
  }

  /** Two blocks next to each other; each draws with this.y set to the shared top. */
  sideBySide(minH: number, left: (x: number, w: number) => void, right: (x: number, w: number) => void) {
    this.ensure(minH);
    const top = this.y;
    const gap = 6;
    const w = (this.inner - gap) / 2;
    const page = this.pdf.getNumberOfPages();
    left(this.m, w);
    const leftEnd = this.y;
    const leftPage = this.pdf.getNumberOfPages();
    this.pdf.setPage(page);
    this.y = top;
    right(this.m + w + gap, w);
    const rightPage = this.pdf.getNumberOfPages();
    if (leftPage > rightPage) {
      this.pdf.setPage(leftPage);
      this.y = leftEnd;
    } else if (leftPage === rightPage) this.y = Math.max(leftEnd, this.y);
  }

  /** Mini section title inside a side-by-side column. */
  colTitle(title: string, x: number, right?: string, w?: number) {
    this.font(9, true, C.ink);
    this.text(title.toUpperCase(), x, this.y);
    if (right && w) this.text(right, x + w, this.y, { align: 'right' });
    this.y += 1.8;
    this.fill(C.honey);
    this.pdf.rect(x, this.y, 14, 0.8, 'F');
    this.y += 3.5;
  }

  signatures(labels: string[]) {
    this.ensure(15);
    this.y += 9;
    const w = (this.inner - 10 * (labels.length - 1)) / labels.length;
    labels.forEach((l, i) => {
      const x = this.m + i * (w + 10);
      this.stroke(C.faint, 0.3);
      this.pdf.line(x, this.y, x + w, this.y);
      this.font(8, false, C.muted);
      this.text(l, x, this.y + 4.5);
    });
    this.y += 10;
  }

  finish(fileName: string) {
    const n = this.pdf.getNumberOfPages();
    const printed = `Printed ${pk(new Date().toISOString())}`;
    for (let i = 1; i <= n; i++) {
      this.pdf.setPage(i);
      this.stroke(C.line, 0.2);
      this.pdf.line(this.m, this.H - 9, this.W - this.m, this.H - 9);
      this.font(7, false, C.faint);
      this.text(`${this.footerLeft} · ${printed}`, this.m, this.H - 5);
      this.text(`Page ${i} of ${n}`, this.W - this.m, this.H - 5, { align: 'right' });
    }
    this.pdf.save(`${fileName.replace(/[^\w.-]+/g, '_')}.pdf`);
  }
}

async function newReport(orientation: 'portrait' | 'landscape', footerLeft: string) {
  const { default: jsPDF } = await import('jspdf');
  return new Report(new jsPDF({ orientation, unit: 'mm', format: 'a4' }), footerLeft);
}

/* ------------------------------------------------------------- shared bits */

const STATUS: Record<string, string> = { open: 'Open', closed: 'To verify', verified: 'Verified', disputed: 'Disputed', deleted: 'Deleted' };
const STATUS_TONE: Record<string, 'red' | 'green' | 'amber' | 'plain'> = { open: 'green', closed: 'amber', verified: 'green', disputed: 'red', deleted: 'plain' };
const statusBadge = (st: string) => ({ text: STATUS[st] || st, tone: STATUS_TONE[st] || 'plain' });
const ACTION: Record<string, string> = {
  report_saved: 'Report saved (not submitted)',
  open: 'Opened',
  close: 'Closed (blind count)',
  close_by_admin: 'Closed by admin',
  verify: 'Verified',
  dispute: 'Disputed',
  deleted: 'Deleted',
  reopened: 'Reopened',
};
const person = (p: unknown) => {
  if (!p || typeof p !== 'object') return '';
  const o = p as { firstName?: string; lastName?: string };
  return `${o.firstName || ''} ${o.lastName || ''}`.trim();
};

function tillFacts(t: TillDetail): [string, string][] {
  const facts: [string, string][] = [
    ['Counter', t.counterName || 'No counter'],
    ['Cashier', t.cashierName || '-'],
    ['Opened', pk(t.openedAt)],
    ['Closed', t.closedAt ? pk(t.closedAt) : 'Still open'],
  ];
  const v = person(t.verifiedBy);
  if (v) facts.push(['Verified by', v]);
  return facts;
}

const noteRows = (count: CashCount | null | undefined): Cell[][] =>
  Object.entries(count?.denominations || {})
    .map(([v, c]) => [Number(v), Number(c)] as const)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([v, c]) => [formatRs(v), `x ${c}`, formatRs(v * c)]);

const NOTE_COLS: Col[] = [
  { header: 'Note', w: 3 },
  { header: 'Count', w: 2, align: 'right' },
  { header: 'Amount', w: 3, align: 'right' },
];

/** Method table: system, less expenses, should hand over, cashier gave, difference. */
function methodTable(rep: Report, f: Omit<TillFigs, 'drawerCount'>) {
  const methods: { label: string; sys: number; given: number | null; less: number }[] = [
    { label: 'Cash', sys: f.sysCash, given: f.cash, less: f.expenses },
    { label: 'POS machine (card)', sys: f.sysCard, given: f.card, less: 0 },
    { label: 'Bank (UBL)', sys: f.sysBank, given: f.bank, less: 0 },
    { label: 'JazzCash', sys: f.sysJazz, given: f.jazz, less: 0 },
  ];
  const anyGiven = methods.some((x) => x.given != null);
  const sum = (k: 'sys' | 'less') => r2(methods.reduce((t, x) => t + x[k], 0));
  const givenSum = r2(methods.reduce((t, x) => t + (x.given || 0), 0));
  const should = r2(sum('sys') - sum('less'));
  rep.table(
    [
      { header: 'Method', w: 3.2 },
      { header: 'Sales (system)', w: 2.3, align: 'right' },
      { header: 'Less expenses', w: 2.3, align: 'right' },
      { header: 'Should hand over', w: 2.5, align: 'right' },
      { header: 'Cashier gave', w: 2.3, align: 'right' },
      { header: 'Difference', w: 2.4, align: 'right' },
    ],
    methods.map((x) => {
      const target = r2(x.sys - x.less);
      return [x.label, formatRs(x.sys), neg(x.less), formatRs(target), money(x.given), diffCell(x.given == null ? null : r2(x.given - target))];
    }),
    {
      foot: [['Total', formatRs(sum('sys')), neg(sum('less')), formatRs(should), anyGiven ? formatRs(givenSum) : '-', diffCell(anyGiven ? r2(givenSum - should) : null)]],
    }
  );
  const parts = [`Cash should be = cash sales ${formatRs(f.cashSales)}`];
  if (f.credit > 0) parts.push(`+ credit received ${formatRs(f.credit)}`);
  if (f.refunds > 0) parts.push(`- refunds ${formatRs(f.refunds)}`);
  if (f.expenses > 0) parts.push(`- expenses, payments & trip costs ${formatRs(f.expenses)}`);
  parts.push(`= ${formatRs(r2(f.sysCash - f.expenses))}.`);
  if (f.discounts > 0) parts.push(`Sales are after discounts of ${formatRs(f.discounts)}.`);
  rep.y -= 3;
  rep.note(parts.join(' '));
  rep.gap(5);
}

type Expense = NonNullable<TillDetail['expenses']>[number] & { tillCounter?: string };

function expensesTable(rep: Report, exp: Expense[], withTill: boolean, size = 8.5) {
  const money = exp.filter((x) => !x.shopUse);
  const total = r2(money.reduce((t, x) => t + x.amount, 0));
  rep.section(`Expenses, payments & trip costs (${money.length})`, `- ${formatRs(total)}`);
  if (!exp.length) {
    rep.note('No expenses.');
    rep.gap(2);
    return;
  }
  const cols: Col[] = [
    { header: '#', w: 0.6, align: 'center' },
    { header: 'Time', w: 1.6 },
    { header: 'Description', w: 7 },
    ...(withTill ? [{ header: 'Off till', w: 1.6 }] : []),
    { header: 'Paid by', w: 1.6 },
    { header: 'Amount', w: 2, align: 'right' as const },
  ];
  rep.table(
    cols,
    exp.map((x, i) => [
      String(i + 1),
      pk(x.createdAt, false),
      withTill || !x.counterName ? x.title : `${x.title}  [${x.counterName}]`,
      ...(withTill ? [x.tillCounter || '-'] : []),
      x.shopUse ? 'Shop use (no money)' : x.paymentMethod || '-',
      x.shopUse ? { text: formatRs(x.amount), color: C.faint } : formatRs(x.amount),
    ]),
    { size, foot: [['', '', 'Total paid out', ...(withTill ? [''] : []), '', `- ${formatRs(total)}`]] }
  );
}

function discountsTable(rep: Report, disc: NonNullable<TillDetail['discounts']>, size = 8.5) {
  if (!disc.length) return;
  const total = r2(disc.reduce((t, d) => t + d.discount, 0));
  rep.section(`Discounts given (${disc.length} ${disc.length === 1 ? 'bill' : 'bills'})`, `- ${formatRs(total)}`);
  rep.table(
    [
      { header: 'Bill', w: 3.4 },
      { header: 'Time', w: 1.4 },
      { header: 'Reason', w: 4 },
      { header: 'Price', w: 1.8, align: 'right' },
      { header: 'Discount', w: 1.8, align: 'right' },
      { header: 'Paid', w: 1.8, align: 'right' },
    ],
    disc.map((d) => [d.orderNumber, pk(d.createdAt, false), d.reason || '-', formatRs(d.subtotal), { text: `- ${formatRs(d.discount)}`, color: C.red }, formatRs(d.total)]),
    { size, foot: [['Total', '', '', '', `- ${formatRs(total)}`, '']] }
  );
}

/* ------------------------------------------------------------ one till */

export async function downloadTillOverviewPdf(t: TillDetail) {
  const f = tillFigures(t);
  const row = rowFigures(f);
  const rep = await newReport('portrait', `${t.sessionNo} · Till closing report`);

  rep.header('Till closing report', t.sessionNo, tillFacts(t), statusBadge(t.status));
  rep.cards([
    { label: 'Should hand over', value: formatRs(row.should), sub: 'sales - expenses' },
    { label: 'Cashier handed over', value: money(row.given), sub: 'cash + card + bank + JazzCash' },
    diffCard('Sales', row.salesDiff),
    diffCard('Total over / short', row.totalDiff, 'sales + change money'),
  ]);

  // Warnings first, so nobody misses them.
  if (t.liveExpected && t.status !== 'open')
    rep.callout(`Bills changed after this till was closed (refund / delete). Expected now: ${formatRs(t.liveExpected.expectedCash)}.`);
  if (t.status !== 'open' && t.closingCount && !t.dayCash && row.should > 0) rep.callout("The cashier has not entered the day's cash yet.");

  rep.section('Sales vs what the cashier gave');
  methodTable(rep, f);

  // Cash notes | change money, next to each other.
  const notes = noteRows(t.dayCash);
  const drawerNotes = noteRows(f.drawerCount);
  rep.sideBySide(
    40,
    (x, w) => {
      rep.colTitle('Cash notes handed over', x, money(t.dayCash?.total ?? null), w);
      if (notes.length) rep.table(NOTE_COLS, notes, { x, width: w, foot: [['Total', '', formatRs(t.dayCash?.total || 0)]] });
      else {
        rep.font(8.5, false, C.muted);
        rep.y += 3;
        rep.text(t.dayCash ? 'Given as one total, not note by note.' : 'No cash written yet.', x, rep.y);
        rep.y += 6;
      }
    },
    (x, w) => {
      rep.colTitle('Change money (till float)', x);
      rep.table(
        [
          { header: '', w: 3 },
          { header: 'Amount', w: 2, align: 'right' },
        ],
        [
          ['Opening float', formatRs(f.float)],
          ['Left in the drawer', f.drawer == null ? (t.status === 'open' ? 'Open' : '-') : formatRs(f.drawer)],
        ],
        { x, width: w, foot: [['Result', diffCell(row.changeDiff)]] }
      );
      if (drawerNotes.length) rep.table(NOTE_COLS, drawerNotes, { x, width: w, foot: [['Left in drawer', '', formatRs(f.drawer || 0)]] });
    }
  );

  expensesTable(rep, t.expenses || [], false);
  discountsTable(rep, t.discounts || []);

  if (t.voided?.length) rep.callout(`Deleted bills in this shift (not counted): ${t.voided.map((v) => `${v.orderNumber} (${formatRs(v.total)})`).join(', ')}`, 'red');

  const notesTxt = [
    t.openNote && `Open note: ${t.openNote}`,
    t.closeNote && `Close note: ${t.closeNote}`,
    t.verifyNote && `Admin note: ${t.verifyNote}`,
  ].filter(Boolean) as string[];
  if (notesTxt.length) {
    rep.section('Notes');
    notesTxt.forEach((n) => rep.note(n, C.text, 8.5));
    rep.gap(3);
  }

  if (t.history?.length) {
    rep.section('History');
    rep.table(
      [
        { header: 'When', w: 2.6 },
        { header: 'What', w: 2.6 },
        { header: 'By', w: 2 },
        { header: 'Note', w: 5 },
      ],
      t.history.map((h) => [pk(h.at), ACTION[h.action] || h.action, person(h.by) || '-', h.note || ''])
    );
  }

  rep.signatures(['Cashier signature', 'Checked by', 'Date']);
  rep.finish(`${t.sessionNo}-overview`);
}

export async function downloadTillBillsPdf(t: TillDetail) {
  const rep = await newReport('portrait', `${t.sessionNo} · Bills`);
  rep.header(`Bills in this till (${t.bills.length})`, t.sessionNo, tillFacts(t), statusBadge(t.status));

  const by: Record<string, number> = {};
  for (const b of t.bills) by[paymentMethodLabel(b.paymentMethod) || 'Other'] = (by[paymentMethodLabel(b.paymentMethod) || 'Other'] || 0) + b.total;
  const sum = (k: 'total' | 'cashSale' | 'cashCredit' | 'cashRefund') => r2(t.bills.reduce((s, b) => s + (b[k] || 0), 0));
  rep.cards([
    { label: 'Bills', value: String(t.bills.length), sub: `total ${formatRs(sum('total'))}` },
    ...Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => ({ label: k, value: formatRs(v), sub: `${t.bills.filter((b) => (paymentMethodLabel(b.paymentMethod) || 'Other') === k).length} bills` })),
  ]);

  rep.table(
    [
      { header: '#', w: 0.9, align: 'center' },
      { header: 'Bill', w: 4.4 },
      { header: 'Time', w: 3 },
      { header: 'Method', w: 1.9 },
      { header: 'Total', w: 2, align: 'right' },
      { header: 'Cash in', w: 2, align: 'right' },
      { header: 'Refund', w: 1.8, align: 'right' },
    ],
    t.bills.map((b, i) => {
      const tags = [b.orderStatus === 'refunded' ? 'refunded' : '', b.pendingAmount > 0 ? `due ${formatRs(b.pendingAmount)}` : '', b.cashCredit > 0 ? `credit ${formatRs(b.cashCredit)}` : '']
        .filter(Boolean)
        .join(', ');
      return [
        String(i + 1),
        tags ? `${b.orderNumber} (${tags})` : b.orderNumber,
        pk(b.createdAt),
        paymentMethodLabel(b.paymentMethod),
        formatRs(b.total),
        b.cashSale + b.cashCredit ? formatRs(b.cashSale + b.cashCredit) : { text: '-', color: C.faint },
        b.cashRefund ? { text: `- ${formatRs(b.cashRefund)}`, color: C.red } : '',
      ];
    }),
    {
      size: 8,
      foot: [['', `Total (${t.bills.length} bills)`, '', '', formatRs(sum('total')), formatRs(r2(sum('cashSale') + sum('cashCredit'))), sum('cashRefund') ? `- ${formatRs(sum('cashRefund'))}` : '']],
    }
  );
  if (t.voided?.length) rep.callout(`Deleted bills in this shift (not counted): ${t.voided.map((v) => `${v.orderNumber} (${formatRs(v.total)})`).join(', ')}`, 'red');
  rep.finish(`${t.sessionNo}-bills`);
}

/* -------------------------------------------------------- all counters */

export async function downloadCombinedDayPdf(tills: TillDetail[], dayLabel: string, day: string) {
  const figs = tills.map(tillFigures);
  const rows = figs.map(rowFigures);
  const add = (k: keyof Omit<TillFigs, 'drawerCount'>) => r2(figs.reduce((t, f) => t + ((f[k] as number | null) || 0), 0));
  const any = (k: 'cash' | 'card' | 'bank' | 'jazz') => figs.some((f) => f[k] != null);
  const sumOf = (vals: (number | null)[]) => (vals.some((v) => v != null) ? r2(vals.reduce<number>((t, v) => t + (v || 0), 0)) : null);
  const foot = {
    given: sumOf(rows.map((r) => r.given)),
    should: r2(rows.reduce((t, r) => t + r.should, 0)),
    salesDiff: sumOf(rows.map((r) => r.salesDiff)),
    changeDiff: sumOf(rows.map((r) => r.changeDiff)),
    totalDiff: sumOf(rows.map((r) => r.totalDiff)),
  };

  const rep = await newReport('landscape', `Cash closing · all counters · ${dayLabel}`);
  rep.header('Cash closing · all counters', dayLabel, [
    ['Counters', tills.map((t) => t.counterName || 'No counter').join(' + ')],
    ['Cashiers', tills.map((t) => t.cashierName).join(', ')],
    ['Tills', tills.map((t) => t.sessionNo).join(', ')],
    ['Status', [...new Set(tills.map((t) => STATUS[t.status] || t.status))].join(', ')],
  ]);
  rep.cards([
    { label: 'Total sales (system)', value: formatRs(r2(add('sysCash') + add('sysCard') + add('sysBank') + add('sysJazz'))) },
    { label: 'Expenses & payments', value: neg(add('expenses')) },
    { label: 'Should hand over', value: formatRs(foot.should) },
    { label: 'Handed over', value: money(foot.given) },
    diffCard('Total over / short', foot.totalDiff, 'sales + change money'),
  ], true);

  // One table: what the system sold, expenses, what should come back, what the cashier gave, over / short.
  const shortTime = (d: string | null | undefined) =>
    d
      ? `${new Date(d).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short' })} ${new Date(d).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit' })}`
      : 'open';
  // Plain numbers (the title says Rs) so the bigger font still fits.
  const num = (n: number | null | undefined) => (n == null ? '-' : r2(n).toLocaleString('en-PK', { maximumFractionDigits: 2 }));
  const less = (n: number) => (n ? `- ${num(n)}` : '-');
  const sumGiven = (k: 'cash' | 'card' | 'bank' | 'jazz') => (any(k) ? num(add(k)) : '-');
  const amt = { w: 1.45, align: 'right' as const };
  rep.section('Each counter', 'Amounts in Rs', true);
  rep.table(
    [
      { header: 'Counter / till', w: 3.6 },
      { header: 'Cash', ...amt },
      { header: 'Card', ...amt },
      { header: 'Bank (UBL)', ...amt },
      { header: 'Jazz Cash', ...amt },
      { header: 'Expenses', w: 1.6, align: 'right' },
      { header: 'Should hand over', w: 1.8, align: 'right' },
      { header: 'Cash', ...amt },
      { header: 'Card', ...amt },
      { header: 'Bank (UBL)', ...amt },
      { header: 'Jazz Cash', ...amt },
      { header: 'Sales', w: 1.9, align: 'right' },
      { header: 'Change money', w: 1.5, align: 'right' },
      { header: 'Total', w: 1.9, align: 'right' },
    ],
    tills.map((t, i) => {
      const f = figs[i];
      const r = rows[i];
      return [
        `${t.counterName || 'No counter'} · ${t.cashierName}
${t.sessionNo}
From ${shortTime(t.openedAt)}
To ${t.closedAt ? shortTime(t.closedAt) : 'still open'}`,
        num(f.sysCash),
        num(f.sysCard),
        num(f.sysBank),
        num(f.sysJazz),
        less(f.expenses),
        { text: num(r.should), bold: true },
        num(f.cash),
        num(f.card),
        num(f.bank),
        num(f.jazz),
        diffCell(r.salesDiff, true),
        f.drawer == null ? { text: '-', color: C.faint } : diffCell(r.changeDiff, true),
        diffCell(r.totalDiff, true),
      ];
    }),
    {
      size: 8.5,
      pad: 1.6,
      groupFill: C.honey,
      groups: [
        { label: '', span: 1 },
        { label: 'Sales (system)', span: 4 },
        { label: '', span: 2 },
        { label: 'Cashier gave', span: 4 },
        { label: 'Over / short', span: 3 },
      ],
      foot: [
        [
          `All counters (${tills.length} tills)`,
          num(add('sysCash')),
          num(add('sysCard')),
          num(add('sysBank')),
          num(add('sysJazz')),
          less(add('expenses')),
          num(foot.should),
          sumGiven('cash'),
          sumGiven('card'),
          sumGiven('bank'),
          sumGiven('jazz'),
          diffCell(foot.salesDiff, true),
          diffCell(foot.changeDiff, true),
          diffCell(foot.totalDiff, true),
        ],
      ],
    }
  );
  {
    const cashSales = add('cashSales');
    const credit = add('credit');
    const refunds = add('refunds');
    const expenses = add('expenses');
    const discounts = add('discounts');
    const parts = [`Cash should be = cash sales ${formatRs(cashSales)}`];
    if (credit > 0) parts.push(`+ credit received ${formatRs(credit)}`);
    if (refunds > 0) parts.push(`- refunds ${formatRs(refunds)}`);
    if (expenses > 0) parts.push(`- expenses, payments & trip costs ${formatRs(expenses)}`);
    parts.push(`= ${formatRs(r2(add('sysCash') - expenses))}.`);
    if (discounts > 0) parts.push(`Sales are after discounts of ${formatRs(discounts)}.`);
    rep.y -= 3.5;
    rep.note(parts.join(' '), C.muted, 7.5);
    rep.gap(4);
  }

  // Cash notes: one column per counter + all.
  const withNotes = tills.filter((t) => t.dayCash && Object.keys(t.dayCash.denominations || {}).length);
  const floatAmt = add('float');
  const drawerAmt = r2(figs.reduce((t, f) => t + (f.drawer ?? f.float), 0));
  rep.sideBySide(
    40,
    (x, w) => {
      const notesTotal = r2(tills.reduce((s, t) => s + (t.dayCash?.total || 0), 0));
      rep.colTitle('Cash notes handed over', x, formatRs(notesTotal), w);
      const dens = [...new Set(withNotes.flatMap((t) => Object.keys(t.dayCash?.denominations || {}).map(Number)))].sort((a, b) => b - a);
      if (!dens.length) {
        rep.font(8.5, false, C.muted);
        rep.y += 3;
        rep.text('No notes counted.', x, rep.y);
        rep.y += 6;
        return;
      }
      const cnt = (t: TillDetail, v: number) => Number(t.dayCash?.denominations?.[String(v)] || 0);
      // One row per counter, one column per note.
      const all = (v: number) => withNotes.reduce((s, t) => s + cnt(t, v), 0);
      rep.table(
        [
          { header: 'Counter', w: 2.2 },
          ...dens.map((v) => ({ header: v.toLocaleString('en-PK'), w: 1.2, align: 'right' as const })),
          { header: 'Total', w: 2.4, align: 'right' as const },
        ],
        withNotes.map((t) => [t.counterName || t.sessionNo, ...dens.map((v) => (cnt(t, v) ? `x ${cnt(t, v)}` : '-')), formatRs(t.dayCash?.total || 0)]),
        { x, width: w, size: 8, foot: [['All', ...dens.map((v) => `x ${all(v)}`), formatRs(notesTotal)]] }
      );
    },
    (x, w) => {
      rep.colTitle('Change money (left in drawers vs float)', x);
      rep.table(
        [
          { header: 'Till', w: 3 },
          { header: 'Float', w: 2, align: 'right' },
          { header: 'Left', w: 2, align: 'right' },
          { header: 'Result', w: 2.4, align: 'right' },
        ],
        tills.map((t, i) => [t.counterName || t.sessionNo, formatRs(figs[i].float), money(figs[i].drawer), diffCell(rows[i].changeDiff)]),
        { x, width: w, size: 8, foot: [['All', formatRs(floatAmt), formatRs(drawerAmt), diffCell(foot.changeDiff)]] }
      );
    }
  );

  const seen = new Set<string>();
  const exp: Expense[] = tills.flatMap((t) =>
    (t.expenses || []).filter((x) => (seen.has(x._id) ? false : (seen.add(x._id), true))).map((x) => ({ ...x, tillCounter: t.counterName || '' }))
  );
  expensesTable(rep, exp, true, 7.5);
  discountsTable(rep, tills.flatMap((t) => t.discounts || []), 7.5);

  rep.signatures([...tills.map((t) => `${t.counterName || t.sessionNo} cashier (${t.cashierName})`), 'Checked by']);
  rep.finish(`cash-closing-all-counters-${day}`);
}
