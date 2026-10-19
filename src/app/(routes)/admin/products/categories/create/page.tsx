'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { categoryService } from '../../services/categoryService';
import { SearchSelect } from '@/components/ui/SearchSelect';

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

interface ParentCategory {
  id: string;
  name: string;
  slug: string;
}

const MAX_THUMBNAILS = 10;

const CreateCategoryPage = () => {
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [parentId, setParentId] = useState<string>('');
  const [parentCategories, setParentCategories] = useState<ParentCategory[]>([]);
  const [thumbnailFiles, setThumbnailFiles] = useState<File[]>([]);
  const [thumbnailPreviews, setThumbnailPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [loadingParents, setLoadingParents] = useState(true);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const slug = useMemo(() => slugify(name), [name]);

  // Load parent categories for dropdown
  useEffect(() => {
    const loadParentCategories = async () => {
      try {
        setLoadingParents(true);
        const categories = await categoryService.listParentCategories();
        setParentCategories(categories as unknown as ParentCategory[]);
      } catch (error) {
        console.error('Failed to load parent categories:', error);
      } finally {
        setLoadingParents(false);
      }
    };
    loadParentCategories();
  }, []);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const available = Math.max(0, MAX_THUMBNAILS - thumbnailFiles.length);
    const toAdd = Array.from(files).slice(0, available);
    if (toAdd.length === 0) {
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
      return;
    }

    const readers = toAdd.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers)
      .then((previews) => {
        setThumbnailFiles((prev) => [...prev, ...toAdd]);
        setThumbnailPreviews((prev) => [...prev, ...previews]);
      })
      .catch((err) => {
        console.error('Failed to read thumbnail files', err);
      })
      .finally(() => {
        if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
      });
  };

  const removeThumbnailAt = (index: number) => {
    setThumbnailFiles((prev) => prev.filter((_, i) => i !== index));
    setThumbnailPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Synchronous lock: Enter + click (or a double click) must not submit twice
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    try {
      if (thumbnailFiles.length > 0) {
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('slug', slug);
        formData.append('description', description);
        formData.append('active', active.toString());
        formData.append('parentId', parentId || '');

        for (const file of thumbnailFiles) {
          formData.append('thumbnail', file);
        }

        await categoryService.createCategory(formData);
      } else {
        await categoryService.createCategory({
          name: name.trim(),
          slug,
          description,
          active,
          parentId: parentId || null,
        });
      }

      router.push('/admin/products/categories');
    } catch (e) {
      console.error('Failed to create category', e);
      alert('Failed to create category');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b">
        <h3 className="text-base sm:text-lg font-medium text-gray-900">Add Category</h3>
      </div>
      <form onSubmit={handleSubmit} aria-busy={loading}>
       <fieldset disabled={loading} className="min-w-0">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              placeholder="e.g., Kitchen & Home"
              className="mt-1 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Slug (auto)</label>
            <input
              type="text"
              className="mt-1 h-11 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600"
              value={slug}
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Parent Category (Optional)</label>
            <p className="text-xs text-gray-500 mb-1">Select a parent to create this as a subcategory</p>
            <div className="relative">
              <SearchSelect
                className="mt-1 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                disabled={loadingParents}
              >
                <option value="">None (Top-level category)</option>
                {parentCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </SearchSelect>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              rows={3}
              placeholder="Short note about this category (optional)"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Thumbnail Images */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Thumbnail Images (Optional)</label>
              <span className="text-[11px] text-gray-400">{thumbnailPreviews.length} / {MAX_THUMBNAILS}</span>
            </div>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleThumbnailChange}
              className="hidden"
            />
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
              {thumbnailPreviews.map((preview, index) => (
                <div
                  key={index}
                  className="relative group aspect-square rounded-md border border-gray-200 overflow-hidden bg-gray-50"
                >
                  <Image
                    src={preview}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => removeThumbnailAt(index)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-white/90 hover:bg-red-500 text-gray-600 hover:text-white rounded-full flex items-center justify-center shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                    aria-label={`Remove thumbnail ${index + 1}`}
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {thumbnailPreviews.length < MAX_THUMBNAILS && (
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="aspect-square rounded-md border border-dashed border-gray-300 hover:border-gray-900 bg-gray-50 hover:bg-white flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"
                  aria-label="Add thumbnail images"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-400">PNG, JPG, GIF up to 10 images</p>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                id="active"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <label htmlFor="active" className="text-xs sm:text-sm text-gray-700">Active</label>
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t flex justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/products/categories')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating category…
              </>
            ) : (
              'Create'
            )}
          </button>
        </div>
       </fieldset>
      </form>
    </div>
  );
};

export default CreateCategoryPage;
