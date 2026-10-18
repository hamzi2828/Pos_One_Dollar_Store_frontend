'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Receipt, FileText, CreditCard, Upload, X, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { expenseService } from '../../service/expenseService';
import type { UpdateExpenseData, RawExpense, ExpenseCategory, PaymentMethod } from '../../types';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../types';

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const expenseId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expense Info
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Other');
  const [date, setDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Receipt
  const [existingReceipt, setExistingReceipt] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);

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
        setCategory((data.category as ExpenseCategory) || 'Other');
        setDate(data.date ? new Date(data.date).toISOString().split('T')[0] : '');
        setPaymentMethod((data.paymentMethod as PaymentMethod) || 'Cash');
        setReference(data.reference || '');
        setNotes(data.notes || '');
        setIsActive(typeof data.isActive === 'boolean' ? data.isActive : true);
        setExistingReceipt(data.receipt || null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
      setRemoveReceipt(false);
      setError(null);
    }
  };

  const handleRemoveFile = () => {
    setReceiptFile(null);
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
      setReceiptPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveExistingReceipt = () => {
    setExistingReceipt(null);
    setRemoveReceipt(true);
  };

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
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive,
      };

      await expenseService.updateExpense(expenseId, expenseData, receiptFile || undefined, removeReceipt);
      router.push('/admin/expenses');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update expense';
      setError(errorMessage);
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#dc2626]" />
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
            <Receipt className="h-5 w-5 text-[#dc2626]" />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
                placeholder="e.g., Office Supplies, Electricity Bill"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
                disabled={loading}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={isActive ? 'active' : 'inactive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
                disabled={loading}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-[#dc2626]" />
            <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
                disabled={loading}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference / Receipt Number
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
                placeholder="e.g., INV-12345"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Receipt Upload */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="h-5 w-5 text-[#dc2626]" />
            <h2 className="text-lg font-semibold text-gray-900">Receipt / Slip Image</h2>
          </div>

          <div className="space-y-4">
            {/* Show existing receipt */}
            {existingReceipt && !receiptFile && (
              <div className="relative inline-block">
                <Image
                  src={existingReceipt}
                  alt="Current receipt"
                  width={200}
                  height={200}
                  className="rounded-lg border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveExistingReceipt}
                  disabled={loading}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Show new file preview */}
            {receiptPreview && (
              <div className="relative inline-block">
                <Image
                  src={receiptPreview}
                  alt="Receipt preview"
                  width={200}
                  height={200}
                  className="rounded-lg border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={loading}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Show upload area if no receipt */}
            {!existingReceipt && !receiptPreview && (
              <div
                onClick={() => { if (!loading) fileInputRef.current?.click(); }}
                aria-disabled={loading}
                className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-[#dc2626]'}`}
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Click to upload receipt image</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG up to 10MB</p>
              </div>
            )}

            {/* Change receipt button */}
            {(existingReceipt || receiptPreview) && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="text-sm text-[#dc2626] hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Change receipt image
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-[#dc2626]" />
            <h2 className="text-lg font-semibold text-gray-900">Additional Notes</h2>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
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
            className="px-6 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
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
