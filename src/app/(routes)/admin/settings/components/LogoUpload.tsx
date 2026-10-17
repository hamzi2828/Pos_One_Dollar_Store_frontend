'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, RefreshCw } from 'lucide-react';
import Image from 'next/image';

interface LogoUploadProps {
  currentLogo?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  isLoading?: boolean;
  headerLogoWidth: number;
  headerLogoHeight: number;
  onSave: (dims: { headerLogoWidth: number; headerLogoHeight: number }) => void;
}

export default function LogoUpload({ currentLogo, onUpload, onRemove, isLoading, headerLogoWidth, headerLogoHeight, onSave }: LogoUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localWidth, setLocalWidth] = useState(headerLogoWidth);
  const [localHeight, setLocalHeight] = useState(headerLogoHeight);

  const hasChanges = localWidth !== headerLogoWidth || localHeight !== headerLogoHeight;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    onUpload(file);
  };

  const handleRemoveLogo = () => {
    setPreview(null);
    onRemove();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const logoSrc = preview || currentLogo;

  const getImageUrl = (src: string) => {
    if (src.startsWith('data:')) return src;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('/')) return `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}${src}`;
    return `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/${src}`;
  };

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">Header Logo</h3>
        </div>
        <p className="text-xs sm:text-sm text-gray-500">
          This logo appears in the navigation bar.
        </p>
      </div>

      {/* Upload Area */}
      {logoSrc ? (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center p-4 sm:p-6 md:p-8 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl">
            <div className="relative">
              <Image
                src={getImageUrl(logoSrc)}
                alt="Header Logo"
                width={544}
                height={158}
                className="max-h-24 w-auto object-contain"
                unoptimized={logoSrc.startsWith('data:')}
              />
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemoveLogo}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all duration-200 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-lg sm:rounded-xl p-6 sm:p-8 md:p-12 text-center transition-all duration-200 cursor-pointer ${
            dragActive ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="space-y-3 sm:space-y-4">
            <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-gray-100">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-500" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-medium text-gray-900">
                Drop your logo here, or <span className="text-gray-700 underline">browse</span>
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                PNG, JPG, or SVG up to 5MB
              </p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Header Logo Dimensions */}
      <div className="bg-white border border-gray-200 rounded-lg sm:rounded-xl p-4 sm:p-5">
        <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-1">Display Size</h4>
        <p className="text-xs text-gray-500 mb-3">Controls logo dimensions in the navigation bar.</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Width (px)</label>
            <input
              type="number"
              min={20}
              max={600}
              value={localWidth}
              onChange={(e) => setLocalWidth(Number(e.target.value))}
              disabled={isLoading}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Height (px)</label>
            <input
              type="number"
              min={20}
              max={200}
              value={localHeight}
              onChange={(e) => setLocalHeight(Number(e.target.value))}
              disabled={isLoading}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onSave({ headerLogoWidth: localWidth, headerLogoHeight: localHeight })}
          disabled={isLoading || !hasChanges}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
