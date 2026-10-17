'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, RefreshCw, Globe } from 'lucide-react';
import Image from 'next/image';

interface LogoSettingsProps {
  // Header logo
  currentLogo?: string;
  onUploadLogo: (file: File) => void;
  onRemoveLogo: () => void;
  headerLogoWidth: number;
  headerLogoHeight: number;
  // Footer logo
  currentFooterLogo?: string;
  onUploadFooterLogo: (file: File) => void;
  onRemoveFooterLogo: () => void;
  footerLogoWidth: number;
  footerLogoHeight: number;
  // Favicon
  currentFavicon?: string;
  onUploadFavicon: (file: File) => void;
  onRemoveFavicon: () => void;
  // Common
  isLoading?: boolean;
  onSaveDimensions: (dims: Record<string, number>) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

function getImageUrl(src: string) {
  if (src.startsWith('data:')) return src;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('/')) return `${BACKEND_URL}${src}`;
  return `${BACKEND_URL}/${src}`;
}

// ─── Reusable image uploader ───
function ImageUploader({
  label,
  description,
  icon: Icon,
  currentSrc,
  onUpload,
  onRemove,
  isLoading,
  accept,
  maxSizeMB,
  validateType,
}: {
  label: string;
  description: string;
  icon: typeof ImageIcon;
  currentSrc?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  isLoading?: boolean;
  accept: string;
  maxSizeMB: number;
  validateType: (file: File) => boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFile = (file: File) => {
    if (!validateType(file)) { alert('Invalid file type'); return; }
    if (file.size > maxSizeMB * 1024 * 1024) { alert(`File size must be less than ${maxSizeMB}MB`); return; }
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

  const src = preview || currentSrc;
  const isFavicon = label.toLowerCase().includes('favicon');

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">{label}</h3>
        </div>
        <p className="text-xs sm:text-sm text-gray-500">{description}</p>
      </div>

      {src ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center p-4 sm:p-6 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl">
            {isFavicon ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-gray-200 bg-white flex items-center justify-center overflow-hidden p-2">
                  <Image src={getImageUrl(src)} alt={label} width={64} height={64} className="w-full h-full object-contain" unoptimized />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <Image src={getImageUrl(src)} alt="preview" width={16} height={16} className="w-4 h-4 object-contain" unoptimized />
                  <span className="text-xs text-gray-600 font-medium">Browser Tab Preview</span>
                </div>
              </div>
            ) : (
              <Image src={getImageUrl(src)} alt={label} width={544} height={158} className="max-h-24 w-auto object-contain" unoptimized={src.startsWith('data:')} />
            )}
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> Replace
            </button>
            <button type="button" onClick={handleRemove} disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-50">
              <X className="h-4 w-4" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-lg sm:rounded-xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
            dragActive ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="space-y-3">
            <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-gray-100">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Drop file here, or <span className="text-gray-700 underline">browse</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isFavicon ? 'ICO, PNG, or SVG up to 2MB' : 'PNG, JPG, or SVG up to 5MB'}
              </p>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept={accept} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
    </div>
  );
}

// ─── Main component ───
export default function LogoSettings(props: LogoSettingsProps) {
  const {
    currentLogo, onUploadLogo, onRemoveLogo, headerLogoWidth, headerLogoHeight,
    currentFooterLogo, onUploadFooterLogo, onRemoveFooterLogo, footerLogoWidth, footerLogoHeight,
    currentFavicon, onUploadFavicon, onRemoveFavicon,
    isLoading, onSaveDimensions,
  } = props;

  const [hWidth, setHWidth] = useState(headerLogoWidth);
  const [hHeight, setHHeight] = useState(headerLogoHeight);
  const [fWidth, setFWidth] = useState(footerLogoWidth);
  const [fHeight, setFHeight] = useState(footerLogoHeight);

  const hasChanges =
    hWidth !== headerLogoWidth || hHeight !== headerLogoHeight ||
    fWidth !== footerLogoWidth || fHeight !== footerLogoHeight;

  return (
    <div className="space-y-8">
      {/* ─── Header Logo ─── */}
      <ImageUploader
        label="Header Logo"
        description="This logo appears in the navigation bar."
        icon={ImageIcon}
        currentSrc={currentLogo}
        onUpload={onUploadLogo}
        onRemove={onRemoveLogo}
        isLoading={isLoading}
        accept="image/*"
        maxSizeMB={5}
        validateType={(f) => f.type.startsWith('image/')}
      />

      {/* Header dimensions */}
      <div className="bg-white border border-gray-200 rounded-lg sm:rounded-xl p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Header Logo Display Size</h4>
        <p className="text-xs text-gray-500 mb-3">Controls logo dimensions in the navigation bar.</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Width (px)</label>
            <input type="number" min={20} max={600} value={hWidth} onChange={(e) => setHWidth(Number(e.target.value))} disabled={isLoading}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Height (px)</label>
            <input type="number" min={20} max={200} value={hHeight} onChange={(e) => setHHeight(Number(e.target.value))} disabled={isLoading}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all disabled:opacity-50" />
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* ─── Footer Logo ─── */}
      <ImageUploader
        label="Footer Logo"
        description="This logo appears in the footer. If not set, the header logo will be used."
        icon={ImageIcon}
        currentSrc={currentFooterLogo}
        onUpload={onUploadFooterLogo}
        onRemove={onRemoveFooterLogo}
        isLoading={isLoading}
        accept="image/*"
        maxSizeMB={5}
        validateType={(f) => f.type.startsWith('image/')}
      />

      {/* Footer dimensions */}
      <div className="bg-white border border-gray-200 rounded-lg sm:rounded-xl p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Footer Logo Display Size</h4>
        <p className="text-xs text-gray-500 mb-3">Controls logo dimensions in the footer.</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Width (px)</label>
            <input type="number" min={20} max={600} value={fWidth} onChange={(e) => setFWidth(Number(e.target.value))} disabled={isLoading}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Height (px)</label>
            <input type="number" min={20} max={200} value={fHeight} onChange={(e) => setFHeight(Number(e.target.value))} disabled={isLoading}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all disabled:opacity-50" />
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* ─── Favicon ─── */}
      <ImageUploader
        label="Favicon"
        description="The small icon shown in browser tabs. Recommended: 32x32 or 64x64 pixels."
        icon={Globe}
        currentSrc={currentFavicon}
        onUpload={onUploadFavicon}
        onRemove={onRemoveFavicon}
        isLoading={isLoading}
        accept=".ico,.png,.svg,.jpg,.jpeg,.webp,image/*"
        maxSizeMB={2}
        validateType={(f) => f.type.startsWith('image/') || f.name.endsWith('.ico')}
      />

      {/* ─── Save Button ─── */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={() => onSaveDimensions({
            headerLogoWidth: hWidth, headerLogoHeight: hHeight,
            footerLogoWidth: fWidth, footerLogoHeight: fHeight,
          })}
          disabled={isLoading || !hasChanges}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
