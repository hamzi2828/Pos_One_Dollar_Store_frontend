'use client';

// Receipt / slip images of an expense: saved ones + new ones, each with an X.
// Click, "Add more" or drag & drop to add. Max 10 in total.

import { useEffect, useRef, useState } from 'react';
import { Upload, X, Plus, Image as ImageIcon } from 'lucide-react';
import { fileUrl } from '../../vendors/components/ReceiptThumbs';
import { MAX_RECEIPTS, type ExpenseReceipt } from '../types';

const MAX_MB = 5;

interface Props {
  /** Saved receipts (edit page). */
  existing?: ExpenseReceipt[];
  onRemoveExisting?: (url: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  onError?: (msg: string | null) => void;
}

export default function ReceiptsPicker({ existing = [], onRemoveExisting, files, onFilesChange, disabled, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const total = existing.length + files.length;
  const room = MAX_RECEIPTS - total;

  // Preview links for new files (freed when the list changes).
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const addFiles = (list: FileList | File[] | null) => {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    const images = picked.filter((f) => f.type.startsWith('image/'));
    const small = images.filter((f) => f.size <= MAX_MB * 1024 * 1024);
    let msg: string | null = null;
    if (images.length < picked.length) msg = 'Only image files can be added.';
    else if (small.length < images.length) msg = `Each image must be under ${MAX_MB} MB.`;
    const fit = small.slice(0, Math.max(0, room));
    if (fit.length < small.length) msg = `At most ${MAX_RECEIPTS} images per expense.`;
    onError?.(msg);
    if (fit.length) onFilesChange([...files, ...fit]);
  };

  const openPicker = () => {
    if (!disabled && room > 0) inputRef.current?.click();
  };

  const removeNew = (i: number) => onFilesChange(files.filter((_, j) => j !== i));

  const thumb = 'relative h-24 w-24 rounded-lg border border-gray-200 bg-gray-50';
  const xBtn =
    'absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <div
      className="space-y-3"
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) addFiles(e.dataTransfer.files);
      }}
    >
      {total === 0 ? (
        <div
          onClick={openPicker}
          aria-disabled={disabled}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver ? 'border-honey-500 bg-honey-50' : 'border-gray-300'} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-honey-500'}`}
        >
          <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Click or drop receipt images here</p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG up to {MAX_MB} MB each, max {MAX_RECEIPTS} images</p>
        </div>
      ) : (
        <div className={`flex flex-wrap gap-3 rounded-lg p-2 ${dragOver ? 'ring-2 ring-honey-400 bg-honey-50' : ''}`}>
          {existing.map((r) => (
            <div key={r.url} className={thumb}>
              <a href={fileUrl(r.url)} target="_blank" rel="noreferrer" title="Open full size" className="block h-full w-full overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(r.url)} alt={r.originalName || 'Receipt'} className="h-full w-full object-cover" />
              </a>
              {onRemoveExisting && (
                <button type="button" onClick={() => onRemoveExisting(r.url)} disabled={disabled} className={xBtn} title="Remove">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {files.map((f, i) => (
            <div key={`${f.name}-${f.size}-${f.lastModified}-${i}`} className={thumb}>
              {previews[i] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[i]} alt={f.name} className="h-full w-full object-cover rounded-lg" />
              )}
              <span className="absolute bottom-1 left-1 rounded bg-honey-500 px-1 text-[10px] font-medium text-gray-900">New</span>
              <button type="button" onClick={() => removeNew(i)} disabled={disabled} className={xBtn} title="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {room > 0 && (
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-honey-500 hover:text-honey-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus className="h-5 w-5" />
              Add more
            </button>
          )}
        </div>
      )}
      {total > 0 && (
        <p className="flex items-center gap-1 text-xs text-gray-500">
          <ImageIcon className="h-3.5 w-3.5" />
          {total} of {MAX_RECEIPTS} images. Drop more images here to add.
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
