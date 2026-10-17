'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Barcode,
  Boxes,
  CircleAlert,
  CircleCheck,
  Layers,
  Package,
  PackagePlus,
  Pencil,
  Printer,
  RefreshCw,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrency } from '@/context/CurrencyContext';
import {
  labelService,
  errorMessage,
  unitKey,
  openPrintWindow,
  showHtmlInWindow,
  printHtmlInHiddenFrame,
  STICKER_SIZES,
  STICKER_TYPES,
  type LabelBatch,
  type LabelData,
  type LabelPrintItem,
  type LabelUnit,
  type StickerSize,
  type StickerType,
} from '../../services/labelService';
import ReceiveStockModal from '../../components/stock/ReceiveStockModal';

// ---------- pure helpers ----------

interface Row {
  key: string;
  unit: LabelUnit;
  code: string | null;
  batch?: LabelBatch;
  suggested: number;
  /** why this line cannot be printed */
  problem?: string;
}

const batchKey = (u: LabelUnit, b: { batchNo: string }) => `${unitKey(u)}|${String(b.batchNo).toUpperCase()}`;

function buildRows(data: LabelData, type: StickerType): Row[] {
  const out: Row[] = [];
  for (const u of data.units) {
    const k = unitKey(u);
    if (type === 'unit' || type === 'box') {
      out.push({
        key: `${type}|${k}`,
        unit: u,
        code: u.printCode,
        suggested: (type === 'box' ? u.suggested.box : u.suggested.unit) || 1,
        problem: u.printCode ? undefined : 'No code yet. Open "Edit product" and save it once to get a code.',
      });
    } else if (type === 'full-box') {
      out.push({
        key: `${type}|${k}`,
        unit: u,
        code: u.fullBoxCode,
        suggested: u.suggested.fullBox || 1,
        problem: u.fullBoxCode ? undefined : 'No full-box code. Turn it on in "Edit product".',
      });
    } else {
      for (const b of u.batches) {
        if (!b.barcode) continue;
        out.push({ key: `${type}|${batchKey(u, b)}`, unit: u, code: b.barcode, batch: b, suggested: b.suggestedCopies || 1 });
      }
    }
  }
  return out;
}

interface TypeInfo {
  type: StickerType;
  title: string;
  help: string;
  icon: React.ComponentType<{ className?: string }>;
  /** null = can be used */
  disabledReason: string | null;
}

function typeInfos(data: LabelData): TypeInfo[] {
  const ppb = data.product.piecesPerBox;
  const hasFullBox = data.units.some((u) => !!u.fullBoxCode);
  const hasBatches = data.units.some((u) => u.batches.some((b) => !!b.barcode));
  return [
    { type: 'unit', title: 'Piece sticker', help: 'One scan sells 1 piece.', icon: Tag, disabledReason: null },
    {
      type: 'box',
      title: 'Box sticker',
      help: 'Stick it on the box. One scan sells 1 piece.',
      icon: Package,
      disabledReason: ppb > 1 ? null : 'Only for items that come in boxes (box size more than 1).',
    },
    {
      type: 'full-box',
      title: 'Full-box sticker',
      help: ppb > 1 ? `One scan sells the whole box (${ppb} pieces).` : 'One scan sells the whole box.',
      icon: Boxes,
      disabledReason:
        ppb <= 1
          ? 'Only for items that come in boxes (box size more than 1).'
          : hasFullBox
            ? null
            : 'Turn on "full-box code" in Edit product first.',
    },
    {
      type: 'batch',
      title: 'Batch sticker',
      help: 'Shows the batch number and expiry date.',
      icon: Layers,
      disabledReason: hasBatches ? null : 'This item has no batches yet.',
    },
  ];
}

const formatDate = (d: string | null) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const clampCopies = (n: number) => Math.max(1, Math.min(1000, Math.floor(n) || 1));

const PREVIEW_MAX = 40; // stickers rendered in the preview

/** Hide the backend toolbar inside the preview (its Print button would print the sample). */
const previewHtml = (html: string) =>
  html.replace('</head>', '<style>.toolbar{display:none!important}</style></head>');

// ---------- component ----------

interface Props {
  productId: string;
  searchParams: { get(name: string): string | null };
}

export default function StickerPrinter({ productId, searchParams }: Props) {
  const { formatPrice } = useCurrency();
  const isNew = searchParams.get('new') === '1';

  const [data, setData] = useState<LabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [type, setType] = useState<StickerType>('unit');
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [checkedBatches, setCheckedBatches] = useState<Record<string, boolean>>({});
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [size, setSize] = useState<StickerSize>('38x25');
  const [showPrice, setShowPrice] = useState(true);

  const [preview, setPreview] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  const initDone = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await labelService.getLabelData(productId));
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load this product.'));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  // Starting choices from the URL (once, after the first load).
  useEffect(() => {
    if (!data || initDone.current) return;
    initDone.current = true;

    const infos = typeInfos(data);
    const qType = (searchParams.get('type') || '').toLowerCase() as StickerType;
    const startType =
      STICKER_TYPES.includes(qType) && infos.find((t) => t.type === qType)?.disabledReason === null ? qType : 'unit';
    setType(startType);

    const allKeys = data.units.map(unitKey);
    const wanted = (searchParams.get('variantId') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const picked = data.units.filter((u) => u.variantId && wanted.includes(u.variantId)).map(unitKey);
    const units = new Set(picked.length ? picked : allKeys);
    setSelectedUnits(units);

    const qBatch = (searchParams.get('batchNo') || '').trim().toUpperCase();
    const batches: Record<string, boolean> = {};
    for (const u of data.units) {
      for (const b of u.batches) {
        const match = String(b.batchNo).toUpperCase() === qBatch || String(b.barcode || '').toUpperCase() === qBatch;
        batches[batchKey(u, b)] = qBatch ? match : b.quantity > 0;
      }
    }
    setCheckedBatches(batches);

    const qCopies = Number(searchParams.get('copies'));
    if (Number.isInteger(qCopies) && qCopies > 0) {
      const start: Record<string, number> = {};
      for (const r of buildRows(data, startType)) {
        if (!units.has(unitKey(r.unit))) continue;
        if (r.batch && !batches[batchKey(r.unit, r.batch)]) continue;
        start[r.key] = clampCopies(qCopies);
      }
      setCopies(start);
    }

    const qSize = (searchParams.get('size') || '').toLowerCase();
    if (STICKER_SIZES.some((s) => s.key === qSize)) setSize(qSize as StickerSize);
    else if (STICKER_SIZES.some((s) => s.key === data.defaultSize)) setSize(data.defaultSize as StickerSize);
    if (searchParams.get('showPrice') === '0') setShowPrice(false);
  }, [data, searchParams]);

  const infos = useMemo(() => (data ? typeInfos(data) : []), [data]);
  const isVariant = !!data && data.product.productType === 'variant' && data.units.length > 0;

  const rows = useMemo(() => (data ? buildRows(data, type) : []), [data, type]);
  const visibleRows = useMemo(
    () => rows.filter((r) => !isVariant || selectedUnits.has(unitKey(r.unit))),
    [rows, isVariant, selectedUnits]
  );
  const copiesFor = useCallback((r: Row) => copies[r.key] ?? r.suggested, [copies]);
  const activeRows = useMemo(
    () => visibleRows.filter((r) => !r.problem && (!r.batch || checkedBatches[batchKey(r.unit, r.batch)])),
    [visibleRows, checkedBatches]
  );

  const items: LabelPrintItem[] = useMemo(
    () =>
      activeRows.map((r) => ({
        productId,
        variantId: r.unit.variantId || undefined,
        type,
        batchNo: r.batch?.batchNo,
        copies: copiesFor(r),
      })),
    [activeRows, productId, type, copiesFor]
  );
  const total = items.reduce((s, it) => s + (it.copies || 0), 0);
  const tooMany = !!data && total > data.maxLabels;

  // Fewer copies in the preview so it stays quick.
  const previewItems = useMemo(() => {
    if (total <= PREVIEW_MAX) return items;
    const each = Math.max(1, Math.floor(PREVIEW_MAX / Math.max(1, items.length)));
    return items.map((it) => ({ ...it, copies: Math.min(it.copies || 1, each) }));
  }, [items, total]);
  const previewIsSample = total > PREVIEW_MAX;

  const fetchHtml = useCallback(
    async (list: LabelPrintItem[], autoPrint: boolean) => {
      if (list.length === 1) {
        const it = list[0];
        return labelService.getProductStickersHtml(productId, { ...it, size, showPrice, autoPrint });
      }
      return (await labelService.getStickersHtml(list, { size, showPrice, autoPrint })).html;
    },
    [productId, size, showPrice]
  );

  // Live preview (debounced).
  const previewKey = JSON.stringify({ previewItems, size, showPrice });
  useEffect(() => {
    if (!data || !initDone.current) return;
    if (!previewItems.length) {
      setPreview('');
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const html = await fetchHtml(previewItems, false);
        if (!cancelled) {
          setPreview(previewHtml(html));
          setPreviewError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setPreview('');
          setPreviewError(errorMessage(e, 'Could not make the preview.'));
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, data]);

  const handlePrint = async () => {
    if (!items.length || tooMany) return;
    const w = openPrintWindow(); // must run before any await (popup blockers)
    setPrinting(true);
    try {
      const html = await fetchHtml(items, true);
      if (w && !w.closed) {
        showHtmlInWindow(w, html);
      } else {
        toast('Pop-up blocked. Printing from this page instead.');
        await printHtmlInHiddenFrame(html);
      }
    } catch (e) {
      if (w && !w.closed) w.close();
      toast.error(errorMessage(e, 'Could not make the stickers.'));
    } finally {
      setPrinting(false);
    }
  };

  const toggleUnit = (k: string) =>
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // ---------- render ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Loading product…</span>
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="space-y-4">
        <BackLinks productId={productId} />
        <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
          <CircleAlert className="h-10 w-10 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">{loadError || 'Product not found.'}</p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  const ppb = data.product.piecesPerBox;
  const scale = size === 'a4' ? 0.55 : 1;
  const frameHeight = 460;

  return (
    <div className="space-y-3 sm:space-y-6">
      {isNew && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CircleCheck className="h-5 w-5 flex-shrink-0 text-green-600" />
          <span className="font-medium">Product saved. Now print its stickers.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Printer className="h-6 w-6 text-honey-500 flex-shrink-0" />
            Print Stickers
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500 truncate">
            {data.product.name}
            {ppb > 1 && <span className="ml-2 text-amber-700">· Box of {ppb}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BackLinks productId={productId} />
          <button
            onClick={() => setShowReceive(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
          >
            <PackagePlus className="h-4 w-4" />
            Receive stock
          </button>
        </div>
      </div>

      {/* Units */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {isVariant ? 'Which items?' : 'This item'}
          </h2>
          {isVariant && data.units.length > 1 && (
            <div className="flex gap-2 text-xs">
              <button
                className="text-honey-600 hover:underline"
                onClick={() => setSelectedUnits(new Set(data.units.map(unitKey)))}
              >
                Select all
              </button>
              <span className="text-gray-300">|</span>
              <button className="text-gray-500 hover:underline" onClick={() => setSelectedUnits(new Set())}>
                None
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Stock shown is for {data.stockBranch ? 'your branch' : 'all branches'}.
          {isVariant && ' Tick the items you want stickers for.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
          {data.units.map((u) => {
            const k = unitKey(u);
            const on = !isVariant || selectedUnits.has(k);
            return (
              <label
                key={k}
                className={`block rounded-lg border p-3 transition-colors ${
                  isVariant ? 'cursor-pointer' : ''
                } ${on ? 'border-honey-500 bg-honey-50/40' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-start gap-2">
                  {isVariant && (
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleUnit(k)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-honey-500 focus:ring-honey-500"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {u.label || data.product.name}
                      </span>
                      <span
                        className={`text-xs font-semibold whitespace-nowrap ${
                          u.stock <= 0 ? 'text-red-600' : u.stock <= 5 ? 'text-amber-600' : 'text-green-600'
                        }`}
                      >
                        {u.stock} in stock
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">Code</span>
                      <span className="font-mono text-2xl font-bold tracking-wider text-gray-900">
                        {u.shortCode || u.printCode || '—'}
                      </span>
                      <span className="ml-auto text-xs text-gray-500">{formatPrice(u.price)}</span>
                    </div>
                    {(u.barcodes.length > 0 || u.fullBoxCode) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {u.barcodes
                          .filter((b) => b.code !== u.fullBoxCode)
                          .map((b) => (
                            <span
                              key={b.code}
                              className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-700"
                              title={b.label || 'Extra barcode'}
                            >
                              <Barcode className="h-3 w-3" />
                              {b.code}
                              {b.qty > 1 && <span className="text-gray-500">×{b.qty}</span>}
                            </span>
                          ))}
                        {u.fullBoxCode && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] text-amber-800">
                            <Boxes className="h-3 w-3" />
                            {u.fullBoxCode}
                          </span>
                        )}
                      </div>
                    )}
                    {u.batches.length > 0 && (
                      <div className="mt-2 border-t border-gray-100 pt-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Batches</p>
                        <ul className="space-y-0.5">
                          {u.batches.map((b) => (
                            <li key={b.batchNo} className="flex justify-between gap-2 text-xs text-gray-600">
                              <span className="font-mono">{b.batchNo}</span>
                              <span>
                                {b.quantity} pcs{b.expiryDate ? ` · Exp ${formatDate(b.expiryDate)}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-6">
        {/* Controls */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Type */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">1. Sticker type</h2>
            <div className="space-y-2">
              {infos.map((t) => {
                const Icon = t.icon;
                const disabled = t.disabledReason !== null;
                const on = type === t.type;
                return (
                  <label
                    key={t.type}
                    className={`flex items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                      disabled
                        ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
                        : on
                          ? 'cursor-pointer border-honey-500 bg-honey-50'
                          : 'cursor-pointer border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sticker-type"
                      className="mt-1 h-4 w-4 border-gray-300 text-honey-500 focus:ring-honey-500"
                      checked={on}
                      disabled={disabled}
                      onChange={() => setType(t.type)}
                    />
                    <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${on ? 'text-honey-500' : 'text-gray-400'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-500">{disabled ? t.disabledReason : t.help}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Lines + copies */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-gray-900">2. How many?</h2>
            <p className="text-xs text-gray-500 mb-2">
              {type === 'batch'
                ? 'Tick the batches you want. Copies start at the batch size' + (ppb > 1 ? ' (in boxes).' : '.')
                : type === 'unit'
                  ? 'Copies start at the stock you have (one per piece).'
                  : 'Copies start at the number of boxes you have.'}
            </p>
            {visibleRows.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                {isVariant && selectedUnits.size === 0 ? 'Tick at least one item above.' : 'Nothing to print for this type.'}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {visibleRows.map((r) => {
                  const bChecked = r.batch ? !!checkedBatches[batchKey(r.unit, r.batch)] : true;
                  const enabled = !r.problem && bChecked;
                  return (
                    <li key={r.key} className="py-2 flex items-center gap-2">
                      {r.batch && (
                        <input
                          type="checkbox"
                          checked={bChecked}
                          onChange={() =>
                            setCheckedBatches((prev) => ({
                              ...prev,
                              [batchKey(r.unit, r.batch!)]: !bChecked,
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-honey-500 focus:ring-honey-500"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900 truncate">
                          {r.unit.label || data.product.name}
                          {r.batch && <span className="text-gray-500"> · Batch {r.batch.batchNo}</span>}
                        </p>
                        {r.problem ? (
                          <p className="text-xs text-amber-700">{r.problem}</p>
                        ) : (
                          <p className="text-xs text-gray-500 font-mono truncate">
                            {r.code}
                            {r.batch && (
                              <span className="font-sans">
                                {' '}
                                · {r.batch.quantity} pcs left
                                {r.batch.expiryDate ? ` · Exp ${formatDate(r.batch.expiryDate)}` : ''}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {!r.problem && (
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={copiesFor(r)}
                          disabled={!enabled}
                          onChange={(e) =>
                            setCopies((prev) => ({ ...prev, [r.key]: clampCopies(Number(e.target.value)) }))
                          }
                          className="w-20 h-9 rounded-lg border border-gray-300 px-2 text-sm text-right focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                          aria-label="Copies"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Size + price */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">3. Sticker size</h2>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as StickerSize)}
              className="h-10 w-full px-3 rounded-lg border border-gray-300 bg-white text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            >
              {STICKER_SIZES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Pick the size of the sticker roll in your printer.</p>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-gray-900">Show price</span>
                <span className="block text-xs text-gray-500">Print the selling price on the sticker.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={showPrice}
                onClick={() => setShowPrice((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  showPrice ? 'bg-honey-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    showPrice ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
                <p className="text-xs text-gray-500">
                  {total} sticker{total === 1 ? '' : 's'} will print
                  {previewIsSample && ' · preview shows a few of them'}
                </p>
              </div>
              <button
                onClick={handlePrint}
                disabled={!items.length || printing || tooMany}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-honey-500 rounded-lg hover:bg-honey-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {printing ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Print {total > 0 ? total : ''}
              </button>
            </div>
            {tooMany && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                You can print up to {data.maxLabels} stickers at a time. Lower the copies and print in parts.
              </p>
            )}
            <div
              className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-200"
              style={{ height: frameHeight }}
            >
              {preview ? (
                <iframe
                  title="Sticker preview"
                  srcDoc={preview}
                  sandbox=""
                  className="border-0 bg-white"
                  style={{
                    width: `${100 / scale}%`,
                    height: frameHeight / scale,
                    transform: `scale(${scale})`,
                    transformOrigin: '0 0',
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                  {previewError ? (
                    <p className="text-sm text-red-600">{previewError}</p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {items.length ? 'Making preview…' : 'Choose what to print to see a preview.'}
                    </p>
                  )}
                </div>
              )}
              {previewLoading && preview && (
                <div className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow">
                  <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {size === 'a4'
                ? 'In the print window choose paper A4, margins None, scale 100%.'
                : 'In the print window choose your sticker printer, margins None, scale 100%.'}
            </p>
          </div>
        </div>
      </div>

      {showReceive && (
        <ReceiveStockModal
          productId={productId}
          productName={data.product.name}
          initialVariantId={
            isVariant && selectedUnits.size === 1 ? data.units.find((u) => selectedUnits.has(unitKey(u)))?.variantId : undefined
          }
          onClose={(changed) => {
            setShowReceive(false);
            if (changed) load();
          }}
        />
      )}
    </div>
  );
}

function BackLinks({ productId }: { productId: string }) {
  return (
    <>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>
      <Link
        href={`/admin/products/edit/${productId}`}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
      >
        <Pencil className="h-4 w-4" />
        Edit product
      </Link>
    </>
  );
}
