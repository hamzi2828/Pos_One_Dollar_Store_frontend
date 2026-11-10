// Bank check API (Reports > Spending > Bank check). Backend: pos_backend docs/BANK_CHECK.md.
import { storeApi } from '@/lib/storeApi';

export type LineStatus = 'ok' | 'fix' | 'missing' | 'in';

export interface BankRef {
  _id: string;
  name: string;
  accountNumber?: string;
}

export interface StatementCounts {
  ok: number;
  fix: number;
  missing: number;
  credits: number;
  reused: number;
}

export interface StatementTotals {
  debits: number;
  credits: number;
  ok: number;
  fix: number;
  missing: number;
}

export interface NotOnStatement {
  src: string;
  id: string;
  ref: string;
  date: string;
  amount: number;
  method: string;
  who: string;
}

export interface MoneyIn {
  cardSales: number;
  cardSettled: number;
  cashCounted: number;
  cashDeposited: number;
  otherIn: { date?: string; amount?: number; label?: string; particulars?: string; payee?: string }[];
}

export interface BankStatement {
  _id: string;
  statementNo: string;
  bank: BankRef | string | null;
  fileName: string;
  originalUrl?: string;
  markedUrl?: string;
  accountNumber?: string;
  periodFrom?: string;
  periodTo?: string;
  checkFrom?: string;
  checkTo?: string;
  counts?: Partial<StatementCounts>;
  totals?: Partial<StatementTotals>;
  notOnStatement?: NotOnStatement[];
  moneyIn?: Partial<MoneyIn>;
  createdByName?: string;
  createdAt?: string;
}

export interface LineMatch {
  src: string;
  id: string;
  ref?: string;
  label?: string;
  date?: string;
  amount?: number;
  method?: string;
}

export interface BankLine {
  _id: string;
  date: string;
  particulars: string;
  payee?: string;
  direction: 'out' | 'in';
  amount: number;
  balance: number;
  status: LineStatus;
  issue?: string;
  match?: LineMatch | null;
  manual?: { status: 'ok' | 'fix' | 'missing'; note?: string; byName?: string; at?: string } | null;
}

export interface StatementDetail {
  statement: BankStatement;
  lines: BankLine[];
  notOnStatement?: NotOnStatement[];
  moneyIn?: Partial<MoneyIn>;
}

export interface Preview {
  accountNumber: string;
  bankId: string | null;
  banks: BankRef[];
  periodFrom: string;
  periodTo: string;
  lineCount: number;
  lastChecked: { to: string; statementNo: string } | null;
  suggestedFrom: string;
  suggestedTo: string;
  alreadyDone: number;
}

const fileForm = (file: File) => {
  const f = new FormData();
  f.append('file', file);
  return f;
};

export const bankCheckApi = {
  preview: (file: File) => storeApi.upload<Preview>('/bank-statements/preview', fileForm(file)),
  run: (file: File, bankId: string, from: string, to: string) => {
    const f = fileForm(file);
    f.append('bankId', bankId);
    f.append('from', from);
    f.append('to', to);
    return storeApi.upload<StatementDetail>('/bank-statements', f);
  },
  list: () => storeApi.get<BankStatement[]>('/bank-statements'),
  get: (id: string) => storeApi.get<StatementDetail>(`/bank-statements/${id}`),
  recheck: (id: string) => storeApi.post<StatementDetail>(`/bank-statements/${id}/recheck`),
  setLine: (id: string, status: 'ok' | 'fix' | 'missing', note: string) =>
    storeApi.put<BankLine>(`/bank-statement-lines/${id}`, { status, note }),
  remove: (id: string) => storeApi.del<unknown>(`/bank-statements/${id}`),
};

/** Status to show: the owner's own decision wins over the automatic one. */
export const lineStatus = (l: BankLine): LineStatus => l.manual?.status || l.status;

export const bankName = (b: BankStatement['bank']) =>
  !b ? '—' : typeof b === 'string' ? '—' : b.name || '—';

/** Page to open for a matched record, when there is one. */
export function matchHref(m?: LineMatch | null): string | null {
  if (!m?.src) return null;
  const s = m.src.toLowerCase();
  if (s.includes('vendor')) return '/admin/vendors/payments';
  if (s.includes('expense') && m.id) return `/admin/expenses/edit/${m.id}`;
  if (s.includes('loan')) return '/admin/loans';
  if (s.includes('invest')) return '/admin/investments';
  if (s.includes('advance')) return '/admin/hr/advances';
  if (s.includes('payroll')) return '/admin/hr/payroll';
  if (s.includes('purchase') || s.includes('trip') || s.includes('po')) return '/admin/purchasing/orders';
  return null;
}
