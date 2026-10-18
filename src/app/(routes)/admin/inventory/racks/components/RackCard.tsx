'use client';

// One rack with its shelves (pieces / products per shelf, subtle fill colour).

import React from 'react';
import { Edit2, Loader2, Plus, Printer, Trash2 } from 'lucide-react';
import type { RackView, ShelfView } from '../services/racksApi';

/** Fill colour of a shelf: by capacity when set, else relative to the fullest shelf. */
function fillClass(s: ShelfView, maxPieces: number): string {
  if (!s.isActive) return 'bg-gray-100 text-gray-400';
  if (!s.pieces) return 'bg-white text-gray-400';
  if (s.capacity && s.pieces > s.capacity) return 'bg-amber-100 text-amber-900';
  const ratio = s.capacity ? s.pieces / s.capacity : s.pieces / Math.max(1, maxPieces);
  if (ratio <= 0.25) return 'bg-emerald-50 text-gray-800';
  if (ratio <= 0.5) return 'bg-emerald-100 text-gray-800';
  if (ratio <= 0.75) return 'bg-emerald-200 text-gray-900';
  return 'bg-emerald-300 text-gray-900';
}

export default function RackCard({
  rack,
  maxPieces,
  highlightShelves,
  highlighted,
  busy,
  canEdit,
  canCreate,
  canDelete,
  canPrint,
  onShelf,
  onEdit,
  onAddShelf,
  onPrint,
  onDelete,
}: {
  rack: RackView;
  maxPieces: number;
  highlightShelves: Set<string>;
  highlighted: boolean;
  busy: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canPrint: boolean;
  onShelf: (shelf: ShelfView) => void;
  onEdit: () => void;
  onAddShelf: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const showFooter = canEdit || canCreate || canDelete || canPrint;
  return (
    <div
      id={`rack-${rack.code}`}
      className={`bg-white rounded-lg sm:rounded-xl shadow-sm border overflow-hidden flex flex-col transition-shadow hover:shadow-md ${
        highlighted ? 'border-honey-400 ring-2 ring-honey-300' : 'border-gray-200'
      } ${rack.isActive ? '' : 'opacity-70'}`}
    >
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold font-mono text-gray-900 leading-none">{rack.code}</h3>
          {rack.isActive ? (
            <span className="text-[10px] text-gray-400 tabular-nums">{rack.pieces ? `${rack.pieces} pcs` : 'empty'}</span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-600 rounded">Inactive</span>
          )}
        </div>
        <p className={`mt-1 text-xs truncate ${rack.name ? 'text-gray-700' : 'text-gray-300'}`} title={rack.name || undefined}>
          {rack.name || 'No name'}
        </p>
        {rack.categories.length > 0 && (
          <p className="mt-0.5 text-[10px] text-blue-700 truncate" title={rack.categories.join(', ')}>
            {rack.categories.join(' · ')}
          </p>
        )}
      </div>

      <div className="px-2 pb-2 space-y-1 flex-1">
        {rack.shelves.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-3">No shelves</p>
        ) : (
          rack.shelves.map((s) => {
            const hl = highlightShelves.has(s._id);
            return (
              <button
                key={s._id}
                type="button"
                onClick={() => onShelf(s)}
                className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border text-left transition-colors hover:border-honey-300 ${fillClass(
                  s,
                  maxPieces,
                )} ${hl ? 'border-honey-500 ring-2 ring-honey-300' : 'border-gray-200'}`}
                title={`${s.code}${s.name ? ` · ${s.name}` : ''}: ${s.pieces} pcs, ${s.products} product(s)${s.isActive ? '' : ' (inactive)'}`}
              >
                <span className="font-mono text-xs font-semibold">S{s.level}</span>
                <span className="text-[11px] tabular-nums whitespace-nowrap">
                  {s.pieces ? (
                    <>
                      <span className="font-semibold">{s.pieces}</span> pcs
                      <span className="opacity-60"> · {s.products}</span>
                    </>
                  ) : s.isActive ? (
                    '—'
                  ) : (
                    'off'
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>

      {showFooter && (
        <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-0.5">
            {canEdit && (
              <button type="button" onClick={onEdit} disabled={busy} className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50 disabled:opacity-40" title="Edit rack">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={onAddShelf}
                disabled={busy || !rack.isActive}
                className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50 disabled:opacity-40"
                title="Add the next shelf (S5, S6 …)"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
            {canPrint && (
              <button
                type="button"
                onClick={onPrint}
                disabled={busy || !rack.isActive}
                className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50 disabled:opacity-40"
                title="Print labels for this rack"
              >
                <Printer className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy || rack.pieces > 0}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title={rack.pieces > 0 ? 'Move the pieces off this rack first' : 'Delete rack'}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
