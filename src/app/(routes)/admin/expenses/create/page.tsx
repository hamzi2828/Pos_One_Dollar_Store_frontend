'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Receipt, FileText, CreditCard, Upload, X, Image as ImageIcon, Check, Plus, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { expenseService } from '../service/expenseService';
import type { CreateExpenseData, PaymentMethod, ExpenseCategoryItem } from '../types';
import { PAYMENT_METHODS } from '../types';

export default function CreateExpensePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories from API (dynamic only)
  const [availableCategories, setAvailableCategories] = useState<ExpenseCategoryItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Inline category creation/editing
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  // One lock for every category mutation (create / rename / delete all refetch).
  const categoryLockRef = useRef(false);
  const categoryBusy = creatingCategory || !!deletingCategoryId;

  // Expense Info
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Receipt file
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous submit lock — Enter-key + double-click can't double-submit.
  const submitLockRef = useRef(false);

  const fetchCategories = async () => {
    try {
      const categories = await expenseService.getCategories();
      setAvailableCategories(categories);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setAvailableCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateCategory = async () => {
    if (categoryLockRef.current) return;
    if (!newCategoryName.trim()) return;

    // Check for duplicate
    if (availableCategories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      setError('Category already exists');
      return;
    }

    categoryLockRef.current = true;
    setCreatingCategory(true);
    setError(null);
    try {
      await expenseService.createCategory(newCategoryName.trim());
      await fetchCategories();
      // Auto-select the newly created category
      setSelectedCategories(prev => [...prev, newCategoryName.trim()]);
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch (err) {
      console.error('Failed to create category:', err);
      setError('Failed to create category');
    } finally {
      categoryLockRef.current = false;
      setCreatingCategory(false);
    }
  };

  const handleEditCategory = (category: ExpenseCategoryItem) => {
    setEditingCategoryId(category._id);
    setEditingCategoryName(category.name);
  };

  const handleSaveEditCategory = async () => {
    if (categoryLockRef.current) return;
    if (!editingCategoryId || !editingCategoryName.trim()) return;

    // Check for duplicate (excluding current category)
    if (availableCategories.some(c => c._id !== editingCategoryId && c.name.toLowerCase() === editingCategoryName.trim().toLowerCase())) {
      setError('Category name already exists');
      return;
    }

    categoryLockRef.current = true;
    setCreatingCategory(true);
    setError(null);
    try {
      // Delete old and create new (since backend doesn't have update endpoint)
      const oldCategory = availableCategories.find(c => c._id === editingCategoryId);
      if (oldCategory) {
        // Update selected categories if the name changed
        setSelectedCategories(prev => prev.map(c => c === oldCategory.name ? editingCategoryName.trim() : c));
      }
      await expenseService.deleteCategory(editingCategoryId);
      await expenseService.createCategory(editingCategoryName.trim());
      await fetchCategories();
      setEditingCategoryId(null);
      setEditingCategoryName('');
    } catch (err) {
      console.error('Failed to update category:', err);
      setError('Failed to update category');
    } finally {
      categoryLockRef.current = false;
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (categoryLockRef.current) return;
    if (!confirm(`Are you sure you want to delete "${categoryName}"?`)) return;
    if (categoryLockRef.current) return;

    categoryLockRef.current = true;
    setDeletingCategoryId(categoryId);
    setError(null);
    try {
      await expenseService.deleteCategory(categoryId);
      // Remove from selected if it was selected
      setSelectedCategories(prev => prev.filter(c => c !== categoryName));
      await fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      setError('Failed to delete category');
    } finally {
      categoryLockRef.current = false;
      setDeletingCategoryId(null);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

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
    if (selectedCategories.length === 0) {
      setError('At least one category is required');
      return;
    }

    submitLockRef.current = true;
    setLoading(true);
    try {
      const expenseData: CreateExpenseData = {
        title: title.trim(),
        amount: parseFloat(amount),
        categories: selectedCategories,
        date: date || undefined,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      await expenseService.createExpense(expenseData, receiptFile || undefined);
      router.push('/admin/expenses');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create expense';
      setError(errorMessage);
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Add New Expense</h1>
          <p className="mt-1 text-sm text-gray-500">Record a new business expense</p>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
                placeholder="0.00"
                disabled={loading}
              />
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

            {/* Multi-select Categories */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Categories <span className="text-red-500">*</span>
                  {selectedCategories.length > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({selectedCategories.length} selected)
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(!showAddCategory)}
                  className="text-sm text-honey-700 hover:text-red-700 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Category
                </button>
              </div>

              {/* Inline Add Category Form */}
              {showAddCategory && (
                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateCategory())}
                      placeholder="New category name..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
                      disabled={categoryBusy}
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={categoryBusy || !newCategoryName.trim()}
                      aria-busy={creatingCategory}
                      className="px-3 py-2 bg-honey-500 text-gray-900 text-sm rounded-lg hover:bg-honey-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {creatingCategory ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Adding…
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Add
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }}
                      disabled={creatingCategory}
                      className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {loadingCategories ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading categories...
                </div>
              ) : availableCategories.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">No categories available. Click &quot;Add Category&quot; above to create one.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((category) => {
                    const isSelected = selectedCategories.includes(category.name);
                    const isEditing = editingCategoryId === category._id;
                    const isDeleting = deletingCategoryId === category._id;

                    if (isEditing) {
                      return (
                        <div key={category._id} className="flex items-center gap-1 p-1 border-2 border-honey-500 rounded-lg bg-red-50">
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleSaveEditCategory())}
                            className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-honey-500 focus:border-transparent w-24"
                            disabled={creatingCategory}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveEditCategory}
                            disabled={categoryBusy}
                            aria-busy={creatingCategory}
                            aria-label={creatingCategory ? 'Saving category…' : 'Save category'}
                            className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {creatingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingCategoryId(null); setEditingCategoryName(''); }}
                            disabled={creatingCategory}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={category._id}
                        className={`group flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-honey-500 bg-red-50 text-honey-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleCategoryToggle(category.name)}
                          disabled={loading || isDeleting}
                          className="flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                          {category.name}
                        </button>
                        <div className="hidden group-hover:flex items-center gap-0.5 ml-1 border-l border-gray-300 pl-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEditCategory(category); }}
                            disabled={categoryBusy || loading}
                            className="p-0.5 text-gray-400 hover:text-blue-600 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Edit category"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category._id, category.name); }}
                            disabled={categoryBusy || loading}
                            aria-busy={isDeleting}
                            className="p-0.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                            title={isDeleting ? 'Deleting…' : 'Delete category'}
                          >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedCategories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedCategories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-honey-500 text-gray-900 text-xs rounded-full"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => handleCategoryToggle(cat)}
                        className="hover:bg-red-700 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
              <select
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
            <h2 className="text-lg font-semibold text-gray-900">Receipt / Slip Image</h2>
          </div>

          <div className="space-y-4">
            {receiptPreview ? (
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
            ) : (
              <div
                onClick={() => { if (!loading) fileInputRef.current?.click(); }}
                aria-disabled={loading}
                className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-honey-500'}`}
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Click to upload receipt image</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG up to 10MB</p>
              </div>
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
                Creating…
              </>
            ) : (
              'Create Expense'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
