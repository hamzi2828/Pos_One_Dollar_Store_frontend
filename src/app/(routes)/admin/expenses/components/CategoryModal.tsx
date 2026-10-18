'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Loader2, Tag } from 'lucide-react';
import { expenseService } from '../service/expenseService';
import type { ExpenseCategoryItem } from '../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChange: () => void;
}

export default function CategoryModal({ isOpen, onClose, onCategoriesChange }: CategoryModalProps) {
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One shared lock: create and delete both refetch the list, so only one
  // mutation may be in flight at a time.
  const busyRef = useRef(false);
  const busy = creating || !!deletingId;

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await expenseService.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (busyRef.current) return;
    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    // Check for duplicate
    if (categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      setError('Category already exists');
      return;
    }

    busyRef.current = true;
    setCreating(true);
    setError(null);
    try {
      await expenseService.createCategory(newCategoryName.trim());
      setNewCategoryName('');
      await fetchCategories();
      onCategoriesChange();
    } catch (err) {
      console.error('Error creating category:', err);
      setError('Failed to create category');
    } finally {
      busyRef.current = false;
      setCreating(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (busyRef.current) return;
    if (!confirm('Are you sure you want to delete this category?')) return;
    if (busyRef.current) return;

    busyRef.current = true;
    setDeletingId(categoryId);
    setError(null);
    try {
      await expenseService.deleteCategory(categoryId);
      await fetchCategories();
      onCategoriesChange();
    } catch (err) {
      console.error('Error deleting category:', err);
      setError('Failed to delete category');
    } finally {
      busyRef.current = false;
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => { if (!busy) onClose(); }} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-honey-700" />
            <h2 className="text-lg font-bold text-gray-900">Manage Categories</h2>
          </div>
          <button onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-600 disabled:opacity-60 disabled:cursor-not-allowed">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Add New Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Add New Category
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateCategory()}
                placeholder="Category name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500 focus:border-transparent"
                disabled={busy}
              />
              <button
                onClick={handleCreateCategory}
                disabled={busy || !newCategoryName.trim()}
                aria-busy={creating}
                aria-label={creating ? 'Adding category…' : 'Add category'}
                title={creating ? 'Adding…' : 'Add category'}
                className="px-3 py-2 bg-honey-500 text-gray-900 rounded-lg hover:bg-honey-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Categories List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Categories ({categories.length})</h3>

            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Loading categories...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Tag className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No categories yet</p>
                <p className="text-xs text-gray-400 mt-1">Add a category using the form above</p>
              </div>
            ) : (
              <div className="space-y-1">
                {categories.map((category) => (
                  <div
                    key={category._id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <span className="text-sm text-gray-700">{category.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(category._id)}
                      disabled={busy}
                      aria-busy={deletingId === category._id}
                      aria-label={deletingId === category._id ? 'Deleting category…' : 'Delete category'}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {deletingId === category._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={busy}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
