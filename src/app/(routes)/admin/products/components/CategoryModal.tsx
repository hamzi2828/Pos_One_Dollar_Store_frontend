"use client";
import React, { useEffect, useMemo, useState } from "react";
import { FiX, FiImage } from "react-icons/fi";
import Image from "next/image";

export interface CategoryInput {
  name: string;
  slug: string;
  description: string;
  active: boolean;
  featured?: boolean;
  thumbnailUrl?: string;
  bannerUrl?: string;
}

interface CategoryModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<CategoryInput>;
  onClose: () => void;
  onSubmit: (data: CategoryInput | FormData) => void;
}

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default function CategoryModal({ open, mode, initial, onClose, onSubmit }: CategoryModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(initial?.thumbnailUrl || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(initial?.bannerUrl || null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setActive(initial?.active ?? true);
      setFeatured(initial?.featured ?? false);
      setThumbnailFile(null);
      setBannerFile(null);
      setThumbnailPreview(initial?.thumbnailUrl || null);
      setBannerPreview(initial?.bannerUrl || null);
    }
  }, [open, initial]);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onload = () => setThumbnailPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  const removeBanner = () => {
    setBannerFile(null);
    setBannerPreview(null);
  };

  const slug = useMemo(() => slugify(name), [name]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-30" onClick={onClose} />
      <div className="relative bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b">
          <h3 className="text-base sm:text-lg font-medium text-gray-900">
            {mode === "create" ? "Add Category" : "Edit Category"}
          </h3>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            
            // If we have files, use FormData
            if (thumbnailFile || bannerFile) {
              const formData = new FormData();
              formData.append('name', name.trim());
              formData.append('slug', slug);
              formData.append('description', description.trim());
              formData.append('active', active.toString());
              formData.append('featured', featured.toString());
              
              if (thumbnailFile) {
                formData.append('thumbnail', thumbnailFile);
              }
              if (bannerFile) {
                formData.append('banner', bannerFile);
              }
              
              onSubmit(formData);
            } else {
              // Otherwise use regular JSON
              onSubmit({ 
                name: name.trim(), 
                slug, 
                description: description.trim(), 
                active,
                featured,
                thumbnailUrl: thumbnailPreview || undefined,
                bannerUrl: bannerPreview || undefined
              });
            }
          }}
        >
          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                placeholder="e.g., Bottoms"
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
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={4}
                placeholder="Optional: short description of this category"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Thumbnail Upload */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Thumbnail Image (Optional)
              </label>
              {thumbnailPreview ? (
                <div className="relative inline-block">
                  <Image
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    width={120}
                    height={120}
                    className="w-30 h-30 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removeThumbnail}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <FiX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex justify-center px-3 sm:px-6 pt-4 sm:pt-5 pb-4 sm:pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400">
                  <div className="space-y-1 text-center">
                    <FiImage className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="thumbnail-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>Upload thumbnail</span>
                        <input
                          id="thumbnail-upload"
                          name="thumbnail-upload"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleThumbnailChange}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* Banner Upload */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Banner Image (Optional)
              </label>
              {bannerPreview ? (
                <div className="relative inline-block">
                  <Image
                    src={bannerPreview}
                    alt="Banner preview"
                    width={240}
                    height={120}
                    className="w-60 h-30 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removeBanner}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <FiX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex justify-center px-3 sm:px-6 pt-4 sm:pt-5 pb-4 sm:pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400">
                  <div className="space-y-1 text-center">
                    <FiImage className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="banner-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>Upload banner</span>
                        <input
                          id="banner-upload"
                          name="banner-upload"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleBannerChange}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
              )}
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
              <div className="flex items-center gap-1.5 sm:gap-2">
                <input
                  id="featured"
                  type="checkbox"
                  className="h-4 w-4 text-yellow-600 border-gray-300 rounded"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                />
                <label htmlFor="featured" className="text-xs sm:text-sm text-gray-700">Featured</label>
              </div>
            </div>
          </div>

          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t flex justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {mode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
