'use client';

// Racks & Shelves: the shop's rack layout (A1..D20, 4 shelves each), what is on
// every shelf, and shelf labels. Stock is moved on the Warehouse & Put-away page
// or from the shelf drawer here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Boxes,
  LayoutGrid,
  Loader2,
  PackageOpen,
  Plus,
  Printer,
  Rows3,
  Search,
  Wand2,
  X,
} from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/lib/storeApi';
import { HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { invalidateShelfOptions } from '@/components/store/ShelfPicker';
import {
  racksApi,
  unitKey,
  unitName,
  type RackListMeta,
  type RackView,
  type ShelfView,
  type UnitLocation,
} from './services/racksApi';
import { StatTile } from './components/shared';
import RackCard from './components/RackCard';
import ShelfDrawer from './components/ShelfDrawer';
import GenerateLayoutModal from './components/GenerateLayoutModal';
import RackFormModal, { type RackFormValues } from './components/RackFormModal';
import PrintLabelsModal from './components/PrintLabelsModal';

const ALL = '__all__';
const CODE_RX = /^[A-Z]{1,2}\d+(-S?\d*)?$/;

type ModalState =
  | null
  | { kind: 'generate' }
  | { kind: 'rack'; rack: RackView | null }
  | { kind: 'labels'; rack?: RackView | null; zone?: string | null };

export default function RacksPage() {
  const { can } = useAccess();
  const canView = can(['racks', 'stock_putaway'], 'view');
  const canCreate = can('racks', 'create');
  const canEdit = can('racks', 'edit');
  const canDelete = can('racks', 'delete');
  const canPrint = can('racks', 'view');
  const canMove = can('stock_putaway', 'create');

  const [racks, setRacks] = useState<RackView[]>([]);
  const [meta, setMeta] = useState<RackListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<{ term: string; units: UnitLocation[] } | null>(null);
  const [hlShelves, setHlShelves] = useState<Set<string>>(new Set());
  const [hlRacks, setHlRacks] = useState<Set<string>>(new Set());
  const [drawerShelf, setDrawerShelf] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [busyRack, setBusyRack] = useState<string | null>(null);
  const lock = useRef(false);

  const load = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError(null);
      const res = await racksApi.list();
      setRacks(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the racks.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView, load]);

  const zones = useMemo(() => meta?.zones ?? [], [meta]);
  // Default tab: first zone (the whole layout can be long).
  const activeZone = zone ?? zones[0]?.zone ?? ALL;
  const visible = useMemo(() => (activeZone === ALL ? racks : racks.filter((r) => r.zone === activeZone)), [racks, activeZone]);

  const stats = useMemo(() => {
    let shelves = 0;
    let empty = 0;
    let pieces = 0;
    let maxPieces = 0;
    for (const r of racks) {
      for (const s of r.shelves) {
        if (!s.isActive) continue;
        shelves += 1;
        pieces += s.pieces;
        if (!s.pieces) empty += 1;
        if (s.pieces > maxPieces) maxPieces = s.pieces;
      }
    }
    return { racks: racks.length, shelves, empty, pieces, maxPieces };
  }, [racks]);

  const scrollTo = (rackCode: string) =>
    window.setTimeout(() => document.getElementById(`rack-${rackCode}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);

  const clearSearch = () => {
    setSearch('');
    setFound(null);
    setHlShelves(new Set());
    setHlRacks(new Set());
  };

  /** Find a shelf / rack code locally, else products (name / barcode) on the server. */
  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const term = search.trim();
    if (!term) return clearSearch();
    const T = term.toUpperCase();
    setFound(null);

    if (CODE_RX.test(T)) {
      for (const r of racks) {
        const shelf = r.shelves.find((s) => s.code === T);
        if (shelf) {
          setHlShelves(new Set([shelf._id]));
          setHlRacks(new Set());
          setZone(r.zone);
          scrollTo(r.code);
          setDrawerShelf(shelf._id);
          return;
        }
      }
      const rack = racks.find((r) => r.code === T);
      if (rack) {
        setHlRacks(new Set([rack._id]));
        setHlShelves(new Set());
        setZone(rack.zone);
        scrollTo(rack.code);
        return;
      }
      // "A3-S" / "A3-" -> every shelf starting with it
      const prefix = racks.flatMap((r) => r.shelves.filter((s) => s.code.startsWith(T)).map((s) => ({ r, s })));
      if (prefix.length) {
        setHlShelves(new Set(prefix.map((x) => x.s._id)));
        setHlRacks(new Set());
        setZone(prefix[0].r.zone);
        scrollTo(prefix[0].r.code);
        return;
      }
    }

    try {
      setFinding(true);
      const units = await racksApi.searchProducts(term);
      setFound({ term, units });
      const ids = new Set(units.flatMap((u) => u.shelves.map((s) => s.shelfId)));
      setHlShelves(ids);
      setHlRacks(new Set());
      if (!units.length) toast.error(`No shelf, rack or product matches "${term}"`);
      else if (!ids.size) toast(`Found ${units.length} item(s), but none is on a shelf yet`, { icon: '📦' });
      else {
        const first = racks.find((r) => r.shelves.some((s) => ids.has(s._id)));
        if (first) {
          const zonesHit = new Set(racks.filter((r) => r.shelves.some((s) => ids.has(s._id))).map((r) => r.zone));
          setZone(zonesHit.size > 1 ? ALL : first.zone);
          scrollTo(first.code);
        }
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Search failed.'));
    } finally {
      setFinding(false);
    }
  };

  const highlightKeys = useMemo(() => new Set((found?.units ?? []).map(unitKey)), [found]);

  const nextNumber = useCallback(
    (z: string) => racks.filter((r) => r.zone === z).reduce((m, r) => Math.max(m, r.number), 0) + 1,
    [racks],
  );

  const saveRack = async (values: RackFormValues) => {
    if (modal?.kind !== 'rack') return;
    if (modal.rack) {
      await racksApi.update(modal.rack._id, {
        name: values.name,
        description: values.description,
        categories: values.categories,
        sortOrder: values.sortOrder,
        isActive: values.isActive,
      });
      toast.success(`Rack ${modal.rack.code} saved`);
    } else {
      const rack = await racksApi.create({
        zone: values.zone,
        number: values.number,
        name: values.name,
        description: values.description,
        categories: values.categories,
        shelves: values.shelves,
      });
      toast.success(`Rack ${rack.code} added`);
      setZone(rack.zone);
      scrollTo(rack.code);
    }
    invalidateShelfOptions();
    setModal(null);
    await load(true);
  };

  /** Rack-level action with a lock (no double clicks). */
  const rackAction = async (rack: RackView, fn: () => Promise<void>, fallback: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusyRack(rack._id);
    try {
      await fn();
      invalidateShelfOptions();
      await load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, fallback), { duration: 6000 });
    } finally {
      lock.current = false;
      setBusyRack(null);
    }
  };

  const addShelf = (rack: RackView) =>
    rackAction(
      rack,
      async () => {
        const updated = await racksApi.addShelf(rack._id);
        const added = updated.shelves[updated.shelves.length - 1];
        toast.success(`Shelf ${added?.code ?? ''} added`);
      },
      'Could not add a shelf.',
    );

  const deleteRack = (rack: RackView) => {
    if (!window.confirm(`Delete rack ${rack.code} and its ${rack.shelves.length} shelves?\n\nOnly an empty rack can be deleted.`)) return;
    rackAction(
      rack,
      async () => {
        await racksApi.remove(rack._id);
        toast.success(`Rack ${rack.code} deleted`);
      },
      'Could not delete the rack.',
    );
  };

  const openShelf = (s: ShelfView) => setDrawerShelf(s._id);

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const noRacks = !loading && !error && racks.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Racks &amp; Shelves</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
              Every rack (A1, A2 …) and its shelves (A1-S1 … A1-S4). Click a shelf to see what is on it.
            </p>
          </div>
          {!noRacks && (
            <div className="flex flex-wrap items-center gap-2">
              {canPrint && racks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModal({ kind: 'labels', zone: activeZone === ALL ? null : activeZone })}
                  className={secondaryBtn}
                >
                  <Printer className="h-4 w-4" /> Print labels
                </button>
              )}
              {canCreate && (
                <>
                  <button type="button" onClick={() => setModal({ kind: 'generate' })} className={secondaryBtn}>
                    <Wand2 className="h-4 w-4" /> Generate / extend
                  </button>
                  <button type="button" onClick={() => setModal({ kind: 'rack', rack: null })} className={primaryBtn}>
                    <Plus className="h-4 w-4" /> Add rack
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <LoadingCard text="Loading racks…" />
        ) : error ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={() => load()} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : noRacks ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-12 sm:py-16 px-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-honey-50">
              <LayoutGrid className="h-8 w-8 text-honey-700" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No racks yet</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
              Create the whole layout at once — for example zones A, B, C, D with 20 racks each and 4 shelves per rack (A1-S1 …
              D20-S4). You can name racks and add or remove shelves afterwards.
            </p>
            {canCreate ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <button type="button" onClick={() => setModal({ kind: 'generate' })} className={`${primaryBtn} !px-6 !py-3 !text-base`}>
                  <Wand2 className="h-5 w-5" /> Generate layout
                </button>
                <button type="button" onClick={() => setModal({ kind: 'rack', rack: null })} className={secondaryBtn}>
                  <Plus className="h-4 w-4" /> Add one rack
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Ask someone with the Racks &amp; Shelves “create” permission to set them up.</p>
            )}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-3 mb-4">
              <StatTile icon={<Rows3 className="h-3 w-3 sm:h-4 sm:w-4 text-honey-700" />} bg="bg-honey-50" value={stats.racks} label="Racks" />
              <StatTile icon={<LayoutGrid className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />} bg="bg-blue-50" value={stats.shelves} label="Shelves in use" />
              <StatTile icon={<Boxes className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />} bg="bg-emerald-50" value={stats.pieces.toLocaleString()} label="Pieces on shelves" />
              <StatTile icon={<PackageOpen className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />} bg="bg-gray-100" value={stats.empty} label="Empty shelves" />
            </div>

            {/* Search */}
            <form onSubmit={runSearch} className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='Find a shelf ("A3-S2"), a rack ("B7") or a product (name / barcode)…'
                    className={`${inputClass} pl-9 pr-8`}
                  />
                  {search && (
                    <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button type="submit" disabled={finding} aria-busy={finding} className={primaryBtn}>
                  {finding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="hidden sm:inline">Find</span>
                </button>
              </div>

              {found && found.units.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-xs text-gray-500">
                    {found.units.length} item(s) match “{found.term}”. Highlighted shelves hold them.
                  </p>
                  <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                    {found.units.map((u) => (
                      <li key={unitKey(u)} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-medium text-gray-900">{unitName(u)}</span>
                        {u.code && <span className="font-mono text-[11px] text-gray-500">{u.code}</span>}
                        <span className="text-[11px] text-gray-500">
                          {u.total} pcs · {u.warehouse} in warehouse
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {u.shelves.length === 0 ? (
                            <span className="text-[11px] text-gray-400">not on a shelf</span>
                          ) : (
                            u.shelves.map((s) => (
                              <button
                                key={s.shelfId}
                                type="button"
                                onClick={() => setDrawerShelf(s.shelfId)}
                                className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                              >
                                {s.code} · {s.qty}
                                {s.isHome ? ' ★' : ''}
                              </button>
                            ))
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>

            {/* Zone tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
              {zones.map((z) => (
                <button
                  key={z.zone}
                  type="button"
                  onClick={() => setZone(z.zone)}
                  className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    activeZone === z.zone ? 'bg-honey-500 border-honey-500 text-gray-900 font-semibold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Zone {z.zone} <span className="opacity-70 text-xs">({z.racks})</span>
                </button>
              ))}
              {zones.length > 1 && (
                <button
                  type="button"
                  onClick={() => setZone(ALL)}
                  className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    activeZone === ALL ? 'bg-honey-500 border-honey-500 text-gray-900 font-semibold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
              )}
              <span className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-gray-400 flex-shrink-0">
                <span className="inline-block h-3 w-3 rounded bg-white border border-gray-200" /> empty
                <span className="inline-block h-3 w-3 rounded bg-emerald-100 border border-gray-200" /> some
                <span className="inline-block h-3 w-3 rounded bg-emerald-300 border border-gray-200" /> full
              </span>
            </div>

            {/* Racks */}
            {visible.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 text-center py-10 text-sm text-gray-500">No racks in this zone.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {visible.map((r) => (
                  <RackCard
                    key={r._id}
                    rack={r}
                    maxPieces={stats.maxPieces}
                    highlightShelves={hlShelves}
                    highlighted={hlRacks.has(r._id)}
                    busy={busyRack === r._id}
                    canEdit={canEdit}
                    canCreate={canCreate}
                    canDelete={canDelete}
                    canPrint={canPrint}
                    onShelf={openShelf}
                    onEdit={() => setModal({ kind: 'rack', rack: r })}
                    onAddShelf={() => addShelf(r)}
                    onPrint={() => setModal({ kind: 'labels', rack: r })}
                    onDelete={() => deleteRack(r)}
                  />
                ))}
              </div>
            )}

            <div className="mt-6">
              <HelpBox>
                New goods first stay in the <strong>warehouse</strong>. Put them on shelves on the{' '}
                <Link href="/admin/inventory/putaway" className="font-semibold underline">
                  Warehouse → Shop
                </Link>{' '}
                page (scan the product, then the shelf label). Every move is recorded: when it arrived, when it went on a shelf and
                when it was sold.
              </HelpBox>
            </div>
          </>
        )}
      </div>

      {drawerShelf && (
        <ShelfDrawer
          shelfId={drawerShelf}
          canEdit={canEdit}
          canDelete={canDelete}
          canMove={canMove}
          highlightKeys={highlightKeys}
          onClose={() => setDrawerShelf(null)}
          onChanged={() => load(true)}
        />
      )}

      {modal?.kind === 'generate' && (
        <GenerateLayoutModal
          onClose={() => setModal(null)}
          onDone={async () => {
            setModal(null);
            setZone(null);
            await load(true);
          }}
        />
      )}
      {modal?.kind === 'rack' && (
        <RackFormModal
          rack={modal.rack}
          defaultZone={activeZone === ALL ? zones[0]?.zone ?? 'A' : activeZone}
          nextNumber={nextNumber}
          onClose={() => setModal(null)}
          onSave={saveRack}
        />
      )}
      {modal?.kind === 'labels' && (
        <PrintLabelsModal rack={modal.rack} zone={modal.zone} zones={zones} racks={racks} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
