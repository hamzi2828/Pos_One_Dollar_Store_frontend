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
  reference: string;
  notes: string;
  receipt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RawExpense {
  _id: string | number;
  title?: string;
  amount?: number;
  category?: string;
  date?: string | Date;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  receipt?: string | null;
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
  reference?: string;
  notes?: string;
  receipt?: string | null;
  isActive?: boolean;
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
