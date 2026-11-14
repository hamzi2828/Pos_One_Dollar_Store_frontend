export type ExpenseCategory = string;

// Dynamic expense category from database
export interface ExpenseCategoryItem {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'Cash' | 'Bank Transfer';

export interface Expense {
  _id: string;
  title: string;
  amount: number;
  category: ExpenseCategory; // Can be single category or comma-separated for backward compatibility
  categories?: string[]; // Array of category names
  date: string;
  paymentMethod: PaymentMethod;
  bank?: string | null;
  bankName?: string;
  /** Paid from this counter's till (null = no counter). */
  counter?: string | null;
  counterName?: string;
  investment?: string | null;
  investmentTitle?: string;
  /** Paid from personal money: linked loan. */
  fromPersonal?: boolean;
  loanNo?: string;
  /** Category Refund: the POS bill the money went back on. */
  posOrder?: string | null;
  posOrderNumber?: string;
  /** Added by a cashier while this till was open. */
  cashSession?: string | null;
  createdByName?: string;
  reference: string;
  notes: string;
  receipt: string | null;
  /** All receipt / slip images (old records: the single receipt). */
  receipts?: ExpenseReceipt[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One receipt / slip image of an expense. */
export interface ExpenseReceipt {
  url: string;
  originalName?: string;
  uploadedAt?: string | null;
}

/** Most receipt images per expense. */
export const MAX_RECEIPTS = 10;

/** Receipts of an expense; old records only have `receipt`. */
export const receiptsOf = (e: { receipts?: ExpenseReceipt[] | null; receipt?: string | null }): ExpenseReceipt[] => {
  const list = (e.receipts || []).filter((r) => r && r.url);
  if (list.length) return list;
  return e.receipt ? [{ url: e.receipt }] : [];
};

export interface ExpenseAdjustment {
  amount: number; // + more spent, − less
  note: string;
  byName?: string;
  at: string;
}

export interface RawExpense {
  _id: string | number;
  title?: string;
  amount?: number;
  originalAmount?: number | null;
  adjustments?: ExpenseAdjustment[];
  category?: string;
  date?: string | Date;
  paymentMethod?: string;
  bank?: string | null;
  bankName?: string;
  counter?: string | null;
  counterName?: string;
  investment?: string | null;
  investmentTitle?: string;
  fromPersonal?: boolean;
  loanNo?: string;
  posOrder?: string | null;
  posOrderNumber?: string;
  /** Detail call only: the refund's bill with what is left to refund. */
  refundBill?: RefundBill | null;
  cashSession?: string | null;
  createdByName?: string;
  reference?: string;
  notes?: string;
  receipt?: string | null;
  receipts?: ExpenseReceipt[];
  isActive?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateExpenseData {
  title: string;
  amount: number;
  category?: ExpenseCategory; // Single category for backward compatibility
  categories?: string[]; // Multiple categories
  date?: string;
  paymentMethod?: PaymentMethod;
  bankId?: string;
  /** Counter whose till paid it ('' = none). */
  counter?: string;
  investmentId?: string;
  /** Paid from personal money -> a loan from lenderId is added too. */
  fromPersonal?: boolean;
  lenderId?: string;
  /** Category Refund: the POS bill refunded. */
  posOrderId?: string;
  reference?: string;
  notes?: string;
  receipt?: string | null;
}

export interface UpdateExpenseData {
  title?: string;
  amount?: number;
  category?: ExpenseCategory;
  date?: string;
  paymentMethod?: PaymentMethod;
  bankId?: string;
  counter?: string;
  investmentId?: string;
  reference?: string;
  notes?: string;
  receipt?: string | null;
  isActive?: boolean;
}

/** POS bill for a Refund expense (GET /expenses/refund-bills). */
export interface RefundBill {
  _id: string;
  orderNumber: string;
  offlineNumber?: string;
  createdAt: string;
  total: number;
  /** Money taken on the bill. */
  paid: number;
  /** Already given back by Refund expenses. */
  refunded: number;
  /** Still possible to refund. */
  refundable: number;
  orderStatus: string;
  paymentMethod: string;
  customerName?: string;
}

/** Name of the category that refunds a POS bill. */
export const REFUND_CATEGORY = 'Refund';
export const isRefundCategory = (c: string | string[] | null | undefined) =>
  (Array.isArray(c) ? c : String(c || '').split(',')).some((x) => x.trim().toLowerCase() === 'refund');

/**
 * Cashier view (permission till_expenses without expenses): only their open till.
 * null = full access.
 */
export interface TillScope {
  open: boolean;
  sessionNo: string;
  counterName: string;
  openedAt: string | null;
}

export interface ExpenseSummary {
  totalExpenses: number;
  count: number;
  byCategory: Record<string, number>;
  byPaymentMethod: Record<string, number>;
}

// Default categories (used as fallback if no categories exist in database)
export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Utilities',
  'Rent',
  'Supplies',
  'Maintenance',
  'Salaries',
  'Marketing',
  'Insurance',
  'Taxes',
  'Transportation',
  'Equipment',
  'Other',
];

// Keep for backward compatibility
export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;

export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Bank Transfer'];
