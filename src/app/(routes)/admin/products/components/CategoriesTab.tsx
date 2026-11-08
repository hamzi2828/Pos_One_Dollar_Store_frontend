"use client";
import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Edit2,
  Trash2,
  Package,
  Layers,
  Search,
  CheckCircle,
  Grid3X3,
  List,
  GripVertical,
  Loader2
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SearchSelect } from '@/components/ui/SearchSelect';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  thumbnailUrl?: string;
  thumbnailUrls?: string[];
  active: boolean;
  parentId?: string | null;
  parentName?: string | null;
  /** Other names (old categories merged into this one), e.g. "Tissue". */
  tags?: string[];
}

export interface CategoryWithCount extends Category {
  count: number;
  activeCount: number;
  inactiveCount: number;
}

interface CategoriesTabProps {
  categories: CategoryWithCount[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
  onReorder?: (reorderedCategories: Category[]) => void;
  /** category id -> request in progress for it (shows a spinner and disables that row's actions) */
  busy?: Record<string, "active" | "delete">;
}

/** True when one of the category's tags (other names) contains the search text. */
const tagsMatch = (cat: Category, q: string) => {
  const needle = q.trim().toLowerCase();
  return !!needle && (cat.tags || []).some((t) => t.toLowerCase().includes(needle));
};

/** Tag chips ("Tissue" "Towel" "Jabtco") = other names of a category. `max` shows only the first N + "+N". */
function TagChips({ tags, max, className = "" }: { tags?: string[]; max?: number; className?: string }) {
  if (!tags?.length) return null;
  const shown = max ? tags.slice(0, max) : tags;
  const hidden = tags.length - shown.length;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`} title={`Also: ${tags.join(", ")}`}>
      {shown.map((t) => (
        <span key={t} className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] leading-4">
          {t}
        </span>
      ))}
      {hidden > 0 && (
        <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] leading-4 font-medium">
          +{hidden}
        </span>
      )}
    </div>
  );
}

export default function CategoriesTab({ categories, onEdit, onDelete, onToggleActive, onReorder, busy = {} }: CategoriesTabProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Whether drag is possible (no search/filter active)
  const isDragEnabled = !searchQuery && filterStatus === "all" && !!onReorder;

  // Categories are flat: every category (even one that still has a parentId) is listed as a normal category.
  const displayCategories = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return categories.filter(cat => {
      const matchesSearch = cat.name.toLowerCase().includes(q) ||
                           cat.slug.toLowerCase().includes(q) ||
                           tagsMatch(cat, searchQuery);
      const matchesFilter = filterStatus === "all" ||
                           (filterStatus === "active" && cat.active) ||
                           (filterStatus === "inactive" && !cat.active);
      return matchesSearch && matchesFilter;
    });
  }, [categories, searchQuery, filterStatus]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = displayCategories.findIndex((c) => c.id === active.id);
    const newIndex = displayCategories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(displayCategories, oldIndex, newIndex) as Category[]);
  };

  const handleImageError = (categoryId: string) => {
    setImageErrors(prev => new Set([...prev, categoryId]));
  };

  const getImageSrc = (thumbnailUrl: string) => {
    return thumbnailUrl.startsWith('/')
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}${thumbnailUrl}`
      : thumbnailUrl;
  };

  // Stats
  const stats = useMemo(() => ({
    total: categories.length,
    active: categories.filter(c => c.active).length,
    totalProducts: categories.reduce((acc, c) => acc + c.count, 0),
  }), [categories]);

  // Category Card Component
  const CategoryCard = ({ cat }: { cat: CategoryWithCount }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: cat.id,
      disabled: !isDragEnabled,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200 group relative"
      >
        {/* Drag Handle */}
        {isDragEnabled && (
          <button
            {...attributes}
            {...listeners}
            className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 p-1 bg-white/80 backdrop-blur-sm rounded-md shadow-sm border border-gray-200 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        {/* Category Image */}
        <div className="relative aspect-[3/2] bg-gray-100">
          {cat.thumbnailUrl && !imageErrors.has(cat.id) ? (
            <Image
              src={getImageSrc(cat.thumbnailUrl)}
              alt={cat.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              onError={() => handleImageError(cat.id)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-sage-100">
              <span className="text-2xl font-bold text-honey-700">
                {cat.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Status Badge */}
          <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
            cat.active
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}>
            {cat.active ? "Active" : "Inactive"}
          </div>
        </div>

        {/* Category Info */}
        <div className="p-3">
          <div className="mb-1.5">
            <h3 className="text-sm font-medium text-gray-900 truncate" title={cat.name}>
              {cat.name}
            </h3>
            <TagChips tags={cat.tags} className="mt-1" />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-medium rounded">
              <Package className="h-2.5 w-2.5" />
              {cat.count}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1">
              {/* Active Toggle */}
              <button
                onClick={() => onToggleActive(cat.id)}
                disabled={!!busy[cat.id]}
                aria-busy={busy[cat.id] === "active"}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
                  cat.active ? 'bg-green-500' : 'bg-gray-300'
                }`}
                title={cat.active ? "Set inactive" : "Set active"}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                    cat.active ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
                {busy[cat.id] === "active" && <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" />}
              </button>
            </div>

            <div className="flex items-center">
              <button
                onClick={() => onEdit(cat.id)}
                className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Edit category"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(cat.id)}
                disabled={!!busy[cat.id]}
                aria-busy={busy[cat.id] === "delete"}
                className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                title="Delete category"
              >
                {busy[cat.id] === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Category Row Component for List View
  const CategoryRow = ({ cat }: { cat: CategoryWithCount }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: cat.id,
      disabled: !isDragEnabled,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <tr ref={setNodeRef} style={style} className="hover:bg-gray-50 transition-colors">
        {isDragEnabled && (
          <td className="px-3 py-4 whitespace-nowrap">
            <button
              {...attributes}
              {...listeners}
              className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </td>
        )}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-3">
            {cat.thumbnailUrl && !imageErrors.has(cat.id) ? (
              <div className="relative h-10 w-10 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                  src={getImageSrc(cat.thumbnailUrl)}
                  alt={cat.name}
                  fill
                  className="object-cover"
                  sizes="40px"
                  onError={() => handleImageError(cat.id)}
                />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-lg bg-sage-200 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-honey-700">
                  {cat.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{cat.name}</p>
              <p className="text-xs text-gray-400 truncate">/{cat.slug}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          {cat.tags?.length ? (
            <TagChips tags={cat.tags} max={6} className="max-w-xs" />
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{cat.count}</span>
            <span className="text-xs text-gray-500">
              ({cat.activeCount} active, {cat.inactiveCount} draft)
            </span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <button
            onClick={() => onToggleActive(cat.id)}
            disabled={!!busy[cat.id]}
            aria-busy={busy[cat.id] === "active"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-honey-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
              cat.active ? 'bg-green-500' : 'bg-gray-300'
            }`}
            title={cat.active ? "Set inactive" : "Set active"}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                cat.active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
            {busy[cat.id] === "active" && <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" />}
          </button>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onEdit(cat.id)}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit category"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(cat.id)}
              disabled={!!busy[cat.id]}
              aria-busy={busy[cat.id] === "delete"}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Delete category"
            >
              {busy[cat.id] === "delete" ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        </td>
      </tr>
    );
  };


  return (
    <div className="space-y-2 sm:space-y-3 md:space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg border border-gray-200 p-2.5 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sage-200 rounded">
              <Layers className="h-4 w-4 text-honey-700" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{stats.total}</p>
              <p className="text-[10px] text-gray-500">Categories</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-2.5 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-100 rounded">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{stats.active}</p>
              <p className="text-[10px] text-gray-500">Active</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-2.5 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 rounded">
              <Package className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{stats.totalProducts}</p>
              <p className="text-[10px] text-gray-500">Products</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-2.5">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-honey-500 focus:border-honey-500 transition-all duration-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <SearchSelect
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
              className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-honey-500 focus:border-honey-500 transition-all duration-200"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SearchSelect>

            <div className="flex items-center border border-gray-300 rounded overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-honey-500 text-gray-900"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title="Grid view"
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 transition-all duration-200 ${
                  viewMode === "list"
                    ? "bg-honey-500 text-gray-900"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid/List */}
      {displayCategories.length === 0 ? (
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-6 sm:p-8 md:p-12 text-center">
          <Layers className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1.5 sm:mb-2">
            No categories found
          </h3>
          <p className="text-sm text-gray-500">
            {searchQuery || filterStatus !== "all"
              ? "Try adjusting your search or filter criteria."
              : "Create your first category to get started."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayCategories.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {displayCategories.map((cat) => (
                <CategoryCard key={cat.id} cat={cat} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        /* List View */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {isDragEnabled && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tags
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Products
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayCategories.map((cat) => (
                      <CategoryRow key={cat.id} cat={cat} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Results count */}
      {(searchQuery || filterStatus !== "all") && (
        <div className="text-sm text-gray-500 text-center">
          Showing {displayCategories.length} categories
        </div>
      )}
    </div>
  );
}
