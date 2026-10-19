'use client';

// Building blocks of the website editor: text with counters, picture upload,
// icon picker, list editor (add / remove / move) and the section card.
import { createContext, useContext, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, ChevronDown, ImageIcon, ImagePlus, Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { BACKEND_URL, apiErrorMessage, storeApi } from '@/lib/storeApi';
import { Toggle, inputClass, secondaryBtn } from '@/components/admin/FormBits';
import { DEFAULT_LIMITS, ICONS, ICON_KEYS, type Limits, type SectionKey } from './types';

// ------------------------------------------------------------------ context
interface EditorCtx {
  canEdit: boolean;
  limits: Limits;
  /** Saved website address, to preview /images/... pictures that live on the website. */
  siteUrl: string;
  requestReset: (section: SectionKey, title: string) => void;
}
export const EditorContext = createContext<EditorCtx>({
  canEdit: false,
  limits: DEFAULT_LIMITS,
  siteUrl: '',
  requestReset: () => {},
});
export const useEditor = () => useContext(EditorContext);

// ------------------------------------------------------------------ text
function Counter({ value, max }: { value: string; max: number }) {
  const n = value.length;
  if (n < max * 0.8) return null;
  return (
    <span className={`text-[11px] tabular-nums ${n >= max ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
      {n} / {max}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  kind = 'line',
  hint,
  placeholder,
  rows,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** line = one line (headings, names); text = a few lines; body = long text. */
  kind?: 'line' | 'text' | 'body';
  hint?: string;
  placeholder?: string;
  rows?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const { canEdit, limits } = useEditor();
  const max = limits[kind];
  return (
    <div>
      <div className="flex items-end justify-between gap-2 mb-1.5">
        <label className="block text-xs font-medium text-gray-700">{label}</label>
        <Counter value={value} max={max} />
      </div>
      {kind === 'line' ? (
        <input
          className={inputClass}
          value={value}
          maxLength={max}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={!canEdit}
          inputMode={inputMode}
        />
      ) : (
        <textarea
          className={`${inputClass} resize-y`}
          value={value}
          maxLength={max}
          rows={rows ?? (kind === 'body' ? 8 : 3)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={!canEdit}
        />
      )}
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

export function UrlField({
  label,
  value,
  onChange,
  hint,
  placeholder = 'https://',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
  placeholder?: string;
}) {
  const { canEdit, limits } = useEditor();
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        className={inputClass}
        value={value}
        maxLength={limits.url}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder={placeholder}
        disabled={!canEdit}
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {hint && <div className="mt-1 text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ pictures
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Where to load a preview from (null = a website file we cannot show here). */
function previewSrc(url: string, siteUrl: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) return `${BACKEND_URL}${url}`;
  if (url.startsWith('/') && siteUrl) return `${siteUrl.replace(/\/+$/, '')}${url}`;
  return null;
}

export function ImageField({
  label,
  value,
  onChange,
  hint,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  /** Smaller preview (inside list items). */
  compact?: boolean;
}) {
  const { canEdit, siteUrl } = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);
  const src = previewSrc(value, siteUrl);
  const showImg = !!src && broken !== src;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error('Use a JPG, PNG or WebP picture');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('The picture is bigger than 5 MB. Use a smaller one.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setUploading(true);
    try {
      const res = await storeApi.upload<{ url: string }>('/website/upload', form);
      onChange(res.data.url);
      toast.success('Picture uploaded. Save changes to put it on the website.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not upload the picture.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const box = compact ? 'h-20 w-28' : 'h-32 w-full sm:w-56';
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
        <div className={`${box} flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center`}>
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(src)} />
          ) : value ? (
            <div className="px-2 text-center text-[11px] text-gray-500 break-all">
              <ImageIcon className="h-5 w-5 mx-auto mb-1 text-gray-400" />
              {value}
            </div>
          ) : (
            <div className="text-center text-[11px] text-gray-400">
              <ImageIcon className="h-6 w-6 mx-auto mb-1" />
              No picture
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_TYPES.join(',')}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <button type="button" className={secondaryBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {value ? 'Change' : 'Upload'}
            </button>
            {value && (
              <button type="button" className={secondaryBtn} onClick={() => onChange('')} disabled={uploading}>
                <X className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ icons
export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { canEdit } = useEditor();
  const [open, setOpen] = useState(false);
  const current = ICONS[value] || ICONS.star;
  const Current = current.Icon;
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">Icon</label>
      <button
        type="button"
        className={`${secondaryBtn} !px-3`}
        onClick={() => setOpen((o) => !o)}
        disabled={!canEdit}
        aria-expanded={open}
      >
        <Current className="h-4 w-4 text-honey-700" />
        {current.label}
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-5 sm:grid-cols-10 gap-1.5 p-2 rounded-lg border border-gray-200 bg-white">
          {ICON_KEYS.map((key) => {
            const { Icon, label } = ICONS[key];
            const active = key === value;
            return (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={`flex items-center justify-center h-9 rounded-md border transition-colors ${
                  active ? 'bg-honey-500 border-honey-500 text-gray-900' : 'border-gray-200 text-gray-600 hover:bg-honey-50'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ lists
export function ListEditor<T>({
  items,
  onChange,
  max,
  newItem,
  itemTitle,
  addLabel,
  emptyText,
  children,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  max: number;
  newItem: () => T;
  itemTitle: (item: T, index: number) => string;
  addLabel: string;
  emptyText: string;
  /** Fields of one item. */
  children: (item: T, set: (patch: Partial<T>) => void, index: number) => React.ReactNode;
}) {
  const { canEdit } = useEditor();
  const setAt = (i: number, patch: Partial<T>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const iconBtn =
    'p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-xs text-gray-500 italic">{emptyText}</p>}
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-gray-50/60">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
            <span className="flex-shrink-0 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded bg-honey-100 text-honey-800 text-[11px] font-semibold">
              {i + 1}
            </span>
            <span className="flex-1 min-w-0 truncate text-xs font-medium text-gray-700">{itemTitle(item, i)}</span>
            {canEdit && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button type="button" className={iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`${iconBtn} hover:!text-red-600 hover:!bg-red-50`}
                  onClick={() => remove(i)}
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="p-3 space-y-3">{children(item, (patch) => setAt(i, patch), i)}</div>
        </div>
      ))}
      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => onChange([...items, newItem()])}
            disabled={items.length >= max}
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
          <span className="text-[11px] text-gray-500 tabular-nums">
            {items.length} / {max}
          </span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ section card
export function SectionCard({
  title,
  subtitle,
  section,
  show,
  onShow,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Section that "Reset to default" puts back (none = no reset button). */
  section?: SectionKey;
  /** Current "Show on website" value (undefined = the section is always shown). */
  show?: boolean;
  onShow?: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const { canEdit, requestReset } = useEditor();
  return (
    <section className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-100">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {canEdit && section && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
            onClick={() => requestReset(section, title)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to default
          </button>
        )}
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        {show !== undefined && onShow && (
          <div className={`rounded-lg px-3 py-2.5 ${show ? 'bg-honey-50 border border-honey-200' : 'bg-gray-50 border border-gray-200'}`}>
            <Toggle
              checked={show}
              onChange={onShow}
              disabled={!canEdit}
              label="Show on website"
              hint={show ? 'People see this section.' : 'Hidden. Your text is kept for later.'}
            />
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">{children}</div>;
}

