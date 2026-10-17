"use client";
import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Edit2,
  Trash2,
  Star,
  Sparkles,
  Package,
  Layers,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Grid3X3,
  List,
  ChevronRight,
  ChevronDown,
  FolderTree,
  X,
  ArrowLeft,
  GripVertical
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

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  thumbnailUrl?: string;
  thumbnailUrls?: string[];
  bannerUrl?: string;
  active: boolean;
  featured?: boolean;
  parentId?: string | null;
  parentName?: string | null;
  shippingCost?: number;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
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
  onToggleFeatured: (id: string) => void;
  onReorder?: (reorderedCategories: Category[]) => void;
  onFeatureProducts?: (id: string) => void;
}

export default function CategoriesTab({ categories, onEdit, onDelete, onToggleActive, onToggleFeatured, onReorder, onFeatureProducts }: CategoriesTabProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"tree" | "grid" | "list">("tree");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const toggleParentExpanded = (id: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedParents(new Set(categories.filter((c) => !c.parentId).map((p) => p.id)));
  };

  const collapseAll = () => {
    setExpandedParents(new Set());
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Whether drag is possible (no search/filter active)
  const isDragEnabled = !searchQuery && filterStatus === "all" && !!onReorder;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const sourceList = selectedParentId ? filteredSubcategories : filteredParentCategories;
    const oldIndex = sourceList.findIndex((c) => c.id === active.id);
    const newIndex = sourceList.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sourceList, oldIndex, newIndex);

    // Build the full categories list with reordered items in place
    const reorderedIds = new Set(reordered.map((c) => c.id));
    const otherCategories = categories.filter((c) => !reorderedIds.has(c.id));
    onReorder([...reordered, ...otherCategories] as Category[]);
  };

  const handleImageError = (categoryId: string) => {
    setImageErrors(prev => new Set([...prev, categoryId]));
  };

  const getImageSrc = (thumbnailUrl: string) => {
    return thumbnailUrl.startsWith('/')
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}${thumbnailUrl}`
      : thumbnailUrl;
  };

  // Get parent categories only
  const parentCategories = useMemo(() => {
    return categories.filter(cat => !cat.parentId);
  }, [categories]);

  // Get subcategories for a parent
  const getSubcategories = (parentId: string) => {
    return categories.filter(cat => cat.parentId === parentId);
  };

  // Get subcategory count for each parent
  const getSubcategoryCount = (parentId: string) => {
    return categories.filter(cat => cat.parentId === parentId).length;
  };

  // Filter and search parent categories
  const filteredParentCategories = useMemo(() => {
    return parentCategories.filter(cat => {
      const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           cat.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === "all" ||
                           (filterStatus === "active" && cat.active) ||
                           (filterStatus === "inactive" && !cat.active);
      return matchesSearch && matchesFilter;
    });
  }, [parentCategories, searchQuery, filterStatus]);

  // Get selected parent details
  const selectedParent = useMemo(() => {
    if (!selectedParentId) return null;
    return categories.find(c => c.id === selectedParentId);
  }, [selectedParentId, categories]);

  // Get filtered subcategories when viewing a parent's subcategories
  const filteredSubcategories = useMemo(() => {
    if (!selectedParentId) return [];
    const subs = getSubcategories(selectedParentId);
    return subs.filter(cat => {
      const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           cat.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === "all" ||
                           (filterStatus === "active" && cat.active) ||
                           (filterStatus === "inactive" && !cat.active);
      return matchesSearch && matchesFilter;
    });
  }, [selectedParentId, categories, searchQuery, filterStatus]);

  // Stats
  const stats = useMemo(() => ({
    total: categories.length,
    active: categories.filter(c => c.active).length,
    inactive: categories.filter(c => !c.active).length,
    featured: categories.filter(c => c.featured).length,
    totalProducts: categories.reduce((acc, c) => acc + c.count, 0),
    parents: parentCategories.length,
    subcategories: categories.filter(c => c.parentId).length,
  }), [categories, parentCategories]);

  // Category Card Component
  const CategoryCard = ({ cat, showSubcategoryButton = false }: { cat: CategoryWithCount; showSubcategoryButton?: boolean }) => {
    const subcategoryCount = showSubcategoryButton ? getSubcategoryCount(cat.id) : 0;
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
              <span className="text-2xl font-bold text-honey-500">
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

          {/* Featured Badge */}
          {cat.featured && (
            <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-500 text-white text-[10px] font-medium rounded-full">
              <Star className="h-2.5 w-2.5 fill-current" />
              Featured
            </div>
          )}
        </div>

        {/* Category Info */}
        <div className="p-3">
          <div className="mb-1.5">
            <h3 className="text-sm font-medium text-gray-900 truncate" title={cat.name}>
              {cat.name}
            </h3>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-medium rounded">
              <Package className="h-2.5 w-2.5" />
              {cat.count}
            </span>
            {showSubcategoryButton && subcategoryCount > 0 && (
              <button
                onClick={() => setSelectedParentId(cat.id)}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded hover:bg-blue-200 transition-colors"
              >
                <FolderTree className="h-2.5 w-2.5" />
                {subcategoryCount} subs
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1">
              {/* Active Toggle */}
              <button
                onClick={() => onToggleActive(cat.id)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  cat.active ? 'bg-green-500' : 'bg-gray-300'
                }`}
                title={cat.active ? "Set inactive" : "Set active"}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                    cat.active ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>

              {/* Featured Toggle */}
              <button
                title={cat.featured ? "Remove from featured" : "Make featured"}
                onClick={() => onToggleFeatured(cat.id)}
                className={`p-1 rounded transition-colors ${
                  cat.featured
                    ? "text-yellow-500 bg-yellow-50 hover:bg-yellow-100"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${cat.featured ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="flex items-center">
              {onFeatureProducts && (
                <button
                  onClick={() => onFeatureProducts(cat.id)}
                  className="p-1 text-gray-500 hover:text-honey-600 hover:bg-honey-50 rounded transition-colors"
                  title="Choose featured products"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onEdit(cat.id)}
                className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Edit category"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(cat.id)}
                className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete category"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Category Row Component for List View
  const CategoryRow = ({ cat, showSubcategoryButton = false }: { cat: CategoryWithCount; showSubcategoryButton?: boolean }) => {
    const subcategoryCount = showSubcategoryButton ? getSubcategoryCount(cat.id) : 0;
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
                <span className="text-lg font-bold text-honey-500">
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
        <td className="px-6 py-4 whitespace-nowrap">
          {showSubcategoryButton && subcategoryCount > 0 ? (
            <button
              onClick={() => setSelectedParentId(cat.id)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-200 transition-colors"
            >
              <FolderTree className="h-3 w-3" />
              {subcategoryCount} subcategories
              <ChevronRight className="h-3 w-3" />
            </button>
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-honey-500 focus:ring-offset-2 ${
              cat.active ? 'bg-green-500' : 'bg-gray-300'
            }`}
            title={cat.active ? "Set inactive" : "Set active"}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                cat.active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <button
            onClick={() => onToggleFeatured(cat.id)}
            className={`p-2 rounded-lg transition-colors ${
              cat.featured
                ? "text-yellow-500 bg-yellow-50 hover:bg-yellow-100"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
            title={cat.featured ? "Remove from featured" : "Make featured"}
          >
            <Star className={`h-5 w-5 ${cat.featured ? 'fill-current' : ''}`} />
          </button>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right">
          <div className="flex items-center justify-end gap-1">
            {onFeatureProducts && (
              <button
                onClick={() => onFeatureProducts(cat.id)}
                className="p-2 text-gray-500 hover:text-honey-600 hover:bg-honey-50 rounded-lg transition-colors"
                title="Choose featured products"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onEdit(cat.id)}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit category"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(cat.id)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete category"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // Determine which categories to display
  const displayCategories = selectedParentId ? filteredSubcategories : filteredParentCategories;
  const isViewingSubcategories = !!selectedParentId;

  return (
    <div className="space-y-2 sm:space-y-3 md:space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <div className="bg-white rounded-lg border border-gray-200 p-2.5 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sage-200 rounded">
              <Layers className="h-4 w-4 text-honey-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{stats.parents}</p>
              <p className="text-[10px] text-gray-500">Categories</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-2.5 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded">
              <FolderTree className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{stats.subcategories}</p>
              <p className="text-[10px] text-gray-500">Subs</p>
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
            <div className="p-1.5 bg-yellow-100 rounded">
              <Star className="h-4 w-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{stats.featured}</p>
              <p className="text-[10px] text-gray-500">Featured</p>
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

      {/* Subcategory View Header */}
      {isViewingSubcategories && selectedParent && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
          <button
            onClick={() => setSelectedParentId(null)}
            className="p-2 bg-white rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-blue-600" />
          </button>
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-blue-600" />
            <span className="text-blue-700 font-medium">
              Subcategories of <strong>{selectedParent.name}</strong>
            </span>
          </div>
          <span className="ml-auto text-sm text-blue-600">
            {filteredSubcategories.length} subcategories
          </span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-2.5">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder={isViewingSubcategories ? "Search subcategories..." : "Search categories..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-honey-500 focus:border-honey-500 transition-all duration-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
              className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-honey-500 focus:border-honey-500 transition-all duration-200"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {viewMode === "tree" && !isViewingSubcategories && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-[11px] px-2 py-1 text-gray-600 hover:text-gray-900 border border-gray-300 rounded"
                  title="Expand all"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-[11px] px-2 py-1 text-gray-600 hover:text-gray-900 border border-gray-300 rounded"
                  title="Collapse all"
                >
                  Collapse all
                </button>
              </div>
            )}

            <div className="flex items-center border border-gray-300 rounded overflow-hidden">
              <button
                onClick={() => setViewMode("tree")}
                className={`p-1.5 transition-all duration-200 ${
                  viewMode === "tree"
                    ? "bg-honey-500 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title="Tree view"
              >
                <FolderTree className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-honey-500 text-white"
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
                    ? "bg-honey-500 text-white"
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
            {isViewingSubcategories ? "No subcategories found" : "No categories found"}
          </h3>
          <p className="text-sm text-gray-500">
            {searchQuery || filterStatus !== "all"
              ? "Try adjusting your search or filter criteria."
              : isViewingSubcategories
                ? "This category has no subcategories yet."
                : "Create your first category to get started."}
          </p>
          {isViewingSubcategories && (
            <button
              onClick={() => setSelectedParentId(null)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Categories
            </button>
          )}
        </div>
      ) : viewMode === "tree" && !isViewingSubcategories ? (
        /* Tree View — parents with subcategories nested inline */
        <div className="space-y-2">
          {filteredParentCategories.map((parent) => {
            const subs = getSubcategories(parent.id);
            const visibleSubs = subs.filter((s) => {
              const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesFilter = filterStatus === "all" ||
                (filterStatus === "active" && s.active) ||
                (filterStatus === "inactive" && !s.active);
              return matchesSearch && matchesFilter;
            }) as CategoryWithCount[];
            const isExpanded = expandedParents.has(parent.id);

            return (
              <div key={parent.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Parent row */}
                <div className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleParentExpanded(parent.id)}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {parent.thumbnailUrl && !imageErrors.has(parent.id) ? (
                    <div className="relative h-10 w-10 rounded-md overflow-hidden flex-shrink-0 border border-gray-200">
                      <Image
                        src={getImageSrc(parent.thumbnailUrl)}
                        alt={parent.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                        onError={() => handleImageError(parent.id)}
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-sage-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-honey-500">
                        {parent.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleParentExpanded(parent.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{parent.name}</h3>
                      {parent.featured && (
                        <Star className="h-3 w-3 text-yellow-500 fill-current flex-shrink-0" />
                      )}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          parent.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {parent.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {subs.length} subcategories · {parent.count} products
                    </p>
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleFeatured(parent.id)}
                      className={`p-1.5 rounded-md transition-colors ${
                        parent.featured
                          ? "text-yellow-500 bg-yellow-50 hover:bg-yellow-100"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      }`}
                      title={parent.featured ? "Remove from featured" : "Make featured"}
                    >
                      <Star className={`h-4 w-4 ${parent.featured ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleActive(parent.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        parent.active ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={parent.active ? "Set inactive" : "Set active"}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                          parent.active ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                    {onFeatureProducts && (
                      <button
                        type="button"
                        onClick={() => onFeatureProducts(parent.id)}
                        className="p-1.5 text-gray-500 hover:text-honey-600 hover:bg-honey-50 rounded-md transition-colors"
                        title="Choose featured products"
                      >
                        <Sparkles className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(parent.id)}
                      className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                      title="Edit category"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(parent.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Subcategories nested */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {visibleSubs.length === 0 ? (
                      <div className="px-12 py-3 text-xs text-gray-400">
                        No subcategories
                        {searchQuery || filterStatus !== "all" ? " match the current filters" : " yet"}.
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {visibleSubs.map((sub) => (
                          <li
                            key={sub.id}
                            className="flex items-center gap-3 pl-12 pr-3 py-2 hover:bg-white transition-colors"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-800 truncate">{sub.name}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                    sub.active
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {sub.active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 truncate">
                                /{sub.slug} · {sub.count} products
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => onToggleActive(sub.id)}
                                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                                  sub.active ? "bg-green-500" : "bg-gray-300"
                                }`}
                                title={sub.active ? "Set inactive" : "Set active"}
                              >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                                    sub.active ? "translate-x-3.5" : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                              {onFeatureProducts && (
                                <button
                                  type="button"
                                  onClick={() => onFeatureProducts(sub.id)}
                                  className="p-1 text-gray-400 hover:text-honey-600 hover:bg-honey-50 rounded transition-colors"
                                  title="Choose featured products"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onEdit(sub.id)}
                                className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                title="Edit subcategory"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(sub.id)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete subcategory"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === "grid" ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayCategories.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {displayCategories.map((cat) => (
                <CategoryCard key={cat.id} cat={cat} showSubcategoryButton={!isViewingSubcategories} />
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
                        {isViewingSubcategories ? "Subcategory" : "Category"}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subcategories
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Products
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Featured
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayCategories.map((cat) => (
                      <CategoryRow key={cat.id} cat={cat} showSubcategoryButton={!isViewingSubcategories} />
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
          Showing {displayCategories.length} {isViewingSubcategories ? "subcategories" : "categories"}
        </div>
      )}
    </div>
  );
}
