'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, RefreshCw, Globe, Loader2 } from 'lucide-react';
import type { SettingsBusyAction } from '../services/settingsService';
import Image from 'next/image';

interface LogoSettingsProps {
  currentLogo?: string;
  onUploadLogo: (file: File) => void;
  onRemoveLogo: () => void;
  currentFavicon?: string;
  onUploadFavicon: (file: File) => void;
  onRemoveFavicon: () => void;
  isLoading?: boolean;
  /** Which settings action is in flight, so only the matching button spins. */
  busyAction?: SettingsBusyAction | null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Uploaded files live on the backend (/uploads/...); built-in defaults such as
// /images/logo.png are files of this app.
function getImageUrl(src: string) {
  if (src.startsWith('data:') || /^https?:\/\//.test(src)) return src;
  if (src.startsWith('/uploads')) return `${BACKEND_URL}${src}`;
  if (src.startsWith('/')) return src;
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
  isUploading,
  isRemoving,
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
  isUploading?: boolean;
  isRemoving?: boolean;
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
    if (isLoading) return;
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFile = (file: File) => {
    if (isLoading) return;
    if (!validateType(file)) { alert('Invalid file type'); return; }
    if (file.size > maxSizeMB * 1024 * 1024) { alert(`File size must be less than ${maxSizeMB}MB`); return; }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    onUpload(file);
  };

  const handleRemove = () => {
    if (isLoading) return;
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
              <Image src={getImageUrl(src)} alt={label} width={544} height={158} className="max-h-24 w-auto object-contain" unoptimized />
            )}
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} aria-busy={isUploading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {isUploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Replace</>
              )}
            </button>
            <button type="button" onClick={handleRemove} disabled={isLoading} aria-busy={isRemoving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {isRemoving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Removing…</>
              ) : (
                <><X className="h-4 w-4" /> Remove</>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-lg sm:rounded-xl p-6 sm:p-8 text-center transition-all ${
            isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          } ${
            dragActive ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          aria-busy={isUploading}
          aria-disabled={isLoading}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          onClick={() => { if (!isLoading) fileInputRef.current?.click(); }}
        >
          <div className="space-y-3">
            <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-gray-100">
              {isUploading ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              )}
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

      <input ref={fileInputRef} type="file" accept={accept} disabled={isLoading} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
    </div>
  );
}

// ─── Main component ───
export default function LogoSettings({
  currentLogo, onUploadLogo, onRemoveLogo,
  currentFavicon, onUploadFavicon, onRemoveFavicon,
  isLoading, busyAction,
}: LogoSettingsProps) {
  return (
    <div className="space-y-8">
      <ImageUploader
        label="Shop Logo"
        description="Printed on documents such as staff contract letters."
        icon={ImageIcon}
        currentSrc={currentLogo}
        onUpload={onUploadLogo}
        onRemove={onRemoveLogo}
        isLoading={isLoading}
        isUploading={busyAction === 'uploadLogo'}
        isRemoving={busyAction === 'removeLogo'}
        accept="image/*"
        maxSizeMB={5}
        validateType={(f) => f.type.startsWith('image/')}
      />

      <hr className="border-gray-200" />

      <ImageUploader
        label="Favicon"
        description="The small icon shown in browser tabs. Recommended: 32x32 or 64x64 pixels."
        icon={Globe}
        currentSrc={currentFavicon}
        onUpload={onUploadFavicon}
        onRemove={onRemoveFavicon}
        isLoading={isLoading}
        isUploading={busyAction === 'uploadFavicon'}
        isRemoving={busyAction === 'removeFavicon'}
        accept=".ico,.png,.svg,.jpg,.jpeg,.webp,image/*"
        maxSizeMB={2}
        validateType={(f) => f.type.startsWith('image/') || f.name.endsWith('.ico')}
      />
    </div>
  );
}
