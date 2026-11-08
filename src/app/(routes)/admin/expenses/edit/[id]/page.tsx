'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Receipt, FileText, CreditCard, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { expenseService } from '../../service/expenseService';
import type { UpdateExpenseData, RawExpense, ExpenseCategory, PaymentMethod, ExpenseReceipt } from '../../types';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, receiptsOf } from '../../types';
import ReceiptsPicker from '../../components/ReceiptsPicker';
import { SearchSelect } from '@/components/ui/SearchSelect';
import BankSelect from '../../components/BankSelect';
import CounterSelect from '../../components/CounterSelect';
import InvestmentBillSelect from '../../components/InvestmentBillSelect';
import ExpenseAdjustments from '../../components/ExpenseAdjustments';
import type { ExpenseAdjustment } from '../../types';

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const expenseId = params.id as string;

  // Expense Info
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [originalAmount, setOriginalAmount] = useState<number | null>(null);
  const [adjustments, setAdjustments] = useState<ExpenseAdjustment[]>([]);
  const [category, setCategory] = useState<ExpenseCategory>('Other');
  const [date, setDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [reference, setReference] = useState('');
  const [bankId, setBankId] = useState('');
  const [counterId, setCounterId] = useState('');
  const [counterName, setCounterName] = useState('');
  const [investmentId, setInvestmentId] = useState('');
  const [linked, setLinked] = useState<{ id: string; title: string; mine: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Receipt / slip images: saved ones, ones to remove on save, new files
  const [savedReceipts, setSavedReceipts] = useState<ExpenseReceipt[]>([]);
  const [removedUrls, setRemovedUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Synchronous submit lock — Enter-key + double-click can't double-submit.
  const submitLockRef = useRef(false);

  // Fetch expense data
  useEffect(() => {
    const fetchExpense = async () => {
      try {
        setFetching(true);
        const data: RawExpense = await expenseService.getExpense(expenseId);

        setTitle(data.title || '');
        setAmount(String(data.amount ?? ''));
        setOriginalAmount(data.originalAmount ?? null);
        setAdjustments(data.adjustments || []);
        setCategory((data.category as ExpenseCategory) || 'Other');
        setDate(data.date ? new Date(data.date).toISOString().split('T')[0] : '');
        setPaymentMethod((data.paymentMethod as PaymentMethod) || 'Cash');
        setReference(data.reference || '');
        setBankId(data.bank ? String(data.bank) : '');
        setCounterId(data.counter ? String(data.counter) : '');
        setCounterName(data.counterName || '');
        setInvestmentId(data.investment ? String(data.investment) : '');
        setLinked(data.investment ? { id: String(data.investment), title: data.investmentTitle || 'Investment bill', mine: Number(data.amount) || 0 } : null);
        setNotes(data.notes || '');
        setIsActive(typeof data.isActive === 'boolean' ? data.isActive : true);
        setSavedReceipts(receiptsOf(data));
      } catch (err) {
        console.error('Error fetching expense:', err);
        setError('Failed to load expense data');
      } finally {
        setFetching(false);
      }
    };

    if (expenseId) {
      fetchExpense();
    }
  }, [expenseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    setError(null);

    // Validation
    if (!title.trim()) {
      setError('Expense title is required');
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError('Valid amount is required');
      return;
    }
    if (!category) {
      setError('Category is required');
      return;
    }

    submitLockRef.current = true;
    setLoading(true);
    try {
      const expenseData: UpdateExpenseData = {
        title: title.trim(),
        amount: parseFloat(amount),
        category,
        date: date || undefined,
        paymentMethod,
        bankId: paymentMethod === 'Bank Transfer' ? bankId : '',
        counter: paymentMethod === 'Cash' ? counterId : '',
        investmentId,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive,
      };

      await expenseService.updateExpense(expenseId, expenseData, newFiles, removedUrls);
      router.push('/admin/expenses');
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const errorMessage = apiMsg || (err instanceof Error ? err.message : 'Failed to update expense');
      setError(errorMessage);
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-honey-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/expenses"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Expense</h1>
          <p className="mt-1 text-sm text-gray-500">Update expense information</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Expense Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="h-5 w-5 text-honey-700" />
            <h2 className="text-lg font-semibold text-gray-900">Expense Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
                placeholder="e.g., Office Supplies, Electricity Bill"
                disabled={loading}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <ExpenseAdjustments
                expenseId={expenseId}
                amount={Number(amount) || 0}
                originalAmount={originalAmount}
                adjustments={adjustments}
                disabled={loading}
                onChanged={(next) => {
                  setAmount(String(next.amount));
                  setOriginalAmount(next.originalAmount);
                  setAdjustments(next.adjustments);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <SearchSelect
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
                disabled={loading}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </SearchSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <SearchSelect
                value={isActive ? 'active' : 'inactive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </SearchSelect>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-honey-700" />
            <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <SearchSelect
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
                disabled={loading}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </SearchSelect>
            </div>
            {paymentMethod === 'Bank Transfer' && <BankSelect value={bankId} onChange={setBankId} disabled={loading} />}
            {paymentMethod === 'Cash' && <CounterSelect value={counterId} onChange={setCounterId} savedName={counterName} disabled={loading} />}
            <div className="md:col-span-2">
              <InvestmentBillSelect value={investmentId} current={linked} disabled={loading} onChange={(id) => setInvestmentId(id)} />
              {linked && (
                <Link href="/admin/investments" className="mt-1 inline-block text-xs font-medium text-honey-800 hover:underline">
                  Open investments → {linked.title}
                </Link>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference / Receipt Number
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
                placeholder="e.g., INV-12345"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Receipt Upload */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="h-5 w-5 text-honey-700" />
            <h2 className="text-lg font-semibold text-gray-900">Receipt / Slip Images</h2>
          </div>

          <ReceiptsPicker
            existing={savedReceipts.filter((r) => !removedUrls.includes(r.url))}
            onRemoveExisting={(url) => setRemovedUrls((prev) => [...prev, url])}
            files={newFiles}
            onFilesChange={setNewFiles}
            disabled={loading}
            onError={setError}
          />
          {removedUrls.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              {removedUrls.length} saved image{removedUrls.length > 1 ? 's' : ''} will be removed when you save.{' '}
              <button type="button" onClick={() => setRemovedUrls([])} disabled={loading} className="underline">
                Undo
              </button>
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-honey-700" />
            <h2 className="text-lg font-semibold text-gray-900">Additional Notes</h2>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
            placeholder="Any additional information about this expense..."
            rows={4}
            disabled={loading}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/admin/expenses"
            aria-disabled={loading}
            tabIndex={loading ? -1 : undefined}
            className={`px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors ${loading ? 'opacity-60 pointer-events-none' : ''}`}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="px-6 py-2 bg-honey-500 text-gray-900 rounded-lg hover:bg-honey-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
