'use client';

import { useState, useRef } from 'react';
import { Upload, X, Globe, RefreshCw } from 'lucide-react';
import Image from 'next/image';

interface FaviconUploadProps {
  currentFavicon?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  isLoading?: boolean;
}

export default function FaviconUpload({ currentFavicon, onUpload, onRemove, isLoading }: FaviconUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const allowed = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type) && !file.name.endsWith('.ico')) {
      alert('Please select an ICO, PNG, SVG, or JPG file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    onUpload(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onRemove();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const faviconSrc = preview || currentFavicon;

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
          <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">Favicon</h3>
        </div>
        <p className="text-xs sm:text-sm text-gray-500">
          The small icon shown in browser tabs. Recommended: 32x32 or 64x64 pixels.
        </p>
      </div>

      {/* Upload Area */}
      {faviconSrc ? (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center p-6 sm:p-8 md:p-10 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl">
            <div className="relative flex flex-col items-center gap-3">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-gray-200 bg-white flex items-center justify-center overflow-hidden p-2">
                <Image
                  src={getImageUrl(faviconSrc)}
                  alt="Favicon"
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              {/* Browser tab preview */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm">
                <Image
                  src={getImageUrl(faviconSrc)}
                  alt="Favicon preview"
                  width={16}
                  height={16}
                  className="w-4 h-4 object-contain"
                  unoptimized
                />
                <span className="text-xs text-gray-600 font-medium">Browser Tab Preview</span>
              </div>
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
              onClick={handleRemove}
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
                Drop your favicon here, or <span className="text-gray-700 underline">browse</span>
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                ICO, PNG, or SVG up to 2MB
              </p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".ico,.png,.svg,.jpg,.jpeg,.webp,image/*"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
