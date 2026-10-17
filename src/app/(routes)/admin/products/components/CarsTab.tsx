"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Search,
  FolderTree,
  Grid3X3,
  List,
  Layers,
  ArrowLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  carService,
  type CarMakeUI,
  type CarModelUI,
  type CarVariantUI,
} from "../services/carService";
import Select, { type StylesConfig, type SingleValue } from "react-select";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// ────────────────────── Year select ──────────────────────

type YearOption = { value: string; label: string };

const YEAR_OPTIONS: YearOption[] = (() => {
  const current = new Date().getFullYear();
  const opts: YearOption[] = [];
  for (let y = current + 1; y >= 1970; y--) {
    opts.push({ value: String(y), label: String(y) });
  }
  return opts;
})();

const yearSelectStyles: StylesConfig<YearOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 8,
    borderColor: state.isFocused ? "#6366f1" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 1px #6366f1" : "none",
    fontSize: 14,
    backgroundColor: "white",
    cursor: "pointer",
    "&:hover": { borderColor: state.isFocused ? "#6366f1" : "#9ca3af" },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 8px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, padding: 6, color: "#6b7280" }),
  clearIndicator: (base) => ({ ...base, padding: 4, color: "#9ca3af" }),
  menu: (base) => ({
    ...base,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    overflow: "hidden",
    zIndex: 210,
  }),
  menuList: (base) => ({ ...base, maxHeight: 180 }),
  option: (base, state) => ({
    ...base,
    fontSize: 13,
    padding: "8px 12px",
    backgroundColor: state.isSelected ? "#6366f1" : state.isFocused ? "#f3f4f6" : "white",
    color: state.isSelected ? "white" : "#111827",
    cursor: "pointer",
  }),
  placeholder: (base) => ({ ...base, color: "#9ca3af", fontSize: 13 }),
  singleValue: (base) => ({ ...base, color: "#111827", fontSize: 13 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

const resolveLogoUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads")) return `${BACKEND_URL}${url}`;
  return url;
};

// ────────────────────── Modal kinds ──────────────────────

type LogoMode = "upload" | "url";
type MakeDraft = {
  name: string;
  active: boolean;
  logoMode: LogoMode;
  logo: File | null;
  logoUrlInput: string;
  existingLogoUrl: string;
};
type ModelDraft = { name: string; active: boolean };
type ImageMode = "upload" | "url";
type VariantDraft = {
  name: string;
  yearStart: string;
  yearEnd: string;
  active: boolean;
  imageMode: ImageMode;
  image: File | null;
  imageUrlInput: string;
  existingImageUrl: string;
};

type ModalState =
  | { kind: "make-create" }
  | { kind: "make-edit"; make: CarMakeUI }
  | { kind: "model-create"; makeId: string; makeName: string }
  | { kind: "model-edit"; model: CarModelUI; makeName: string }
  | { kind: "variant-create"; modelId: string; modelName: string; makeName: string }
  | {
      kind: "variant-edit";
      variant: CarVariantUI;
      modelName: string;
      makeName: string;
    }
  | null;

export default function CarsTab() {
  const [makes, setMakes] = useState<CarMakeUI[]>([]);
  const [models, setModels] = useState<CarModelUI[]>([]);
  const [variants, setVariants] = useState<CarVariantUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedMakes, setExpandedMakes] = useState<Set<string>>(new Set());
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

  // View mode + search
  const [viewMode, setViewMode] = useState<"tree" | "drilldown" | "grid" | "list">("tree");
  const [searchQuery, setSearchQuery] = useState("");

  // Drilldown navigation state
  const [drillMakeId, setDrillMakeId] = useState<string | null>(null);
  const [drillModelId, setDrillModelId] = useState<string | null>(null);

  // Modal state + drafts
  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [makeDraft, setMakeDraft] = useState<MakeDraft>({
    name: "",
    active: true,
    logoMode: "upload",
    logo: null,
    logoUrlInput: "",
    existingLogoUrl: "",
  });
  const [modelDraft, setModelDraft] = useState<ModelDraft>({ name: "", active: true });
  const [variantDraft, setVariantDraft] = useState<VariantDraft>({
    name: "",
    yearStart: "",
    yearEnd: "",
    active: true,
    imageMode: "upload",
    image: null,
    imageUrlInput: "",
    existingImageUrl: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const variantFileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, mo, v] = await Promise.all([
        carService.listMakes(),
        carService.listModels(),
        carService.listVariants(),
      ]);
      setMakes(m);
      setModels(mo);
      setVariants(v);
    } catch (e) {
      console.error("Failed to load cars", e);
      setError("Failed to load cars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Group for rendering
  const modelsByMake = useMemo(() => {
    const map = new Map<string, CarModelUI[]>();
    for (const m of models) {
      if (!map.has(m.makeId)) map.set(m.makeId, []);
      map.get(m.makeId)!.push(m);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [models]);

  const variantsByModel = useMemo(() => {
    const map = new Map<string, CarVariantUI[]>();
    for (const v of variants) {
      if (!map.has(v.modelId)) map.set(v.modelId, []);
      map.get(v.modelId)!.push(v);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ay = a.yearStart || 0;
        const by = b.yearStart || 0;
        if (by !== ay) return by - ay;
        return a.name.localeCompare(b.name);
      });
    }
    return map;
  }, [variants]);

  const sortedMakes = useMemo(
    () => [...makes].sort((a, b) => a.name.localeCompare(b.name)),
    [makes]
  );

  const toggleMake = (id: string) =>
    setExpandedMakes((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleModel = (id: string) =>
    setExpandedModels((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ─────────────── Modal openers ───────────────

  const openCreateMake = () => {
    setMakeDraft({
      name: "",
      active: true,
      logoMode: "upload",
      logo: null,
      logoUrlInput: "",
      existingLogoUrl: "",
    });
    setFormError(null);
    setModal({ kind: "make-create" });
  };
  const openEditMake = (make: CarMakeUI) => {
    // Default to URL mode if the existing logo looks like an absolute URL
    const isRemote = /^https?:\/\//i.test(make.logoUrl);
    setMakeDraft({
      name: make.name,
      active: make.active,
      logoMode: isRemote ? "url" : "upload",
      logo: null,
      logoUrlInput: isRemote ? make.logoUrl : "",
      existingLogoUrl: make.logoUrl,
    });
    setFormError(null);
    setModal({ kind: "make-edit", make });
  };
  const openCreateModel = (makeId: string, makeName: string) => {
    setModelDraft({ name: "", active: true });
    setFormError(null);
    setModal({ kind: "model-create", makeId, makeName });
  };
  const openEditModel = (model: CarModelUI, makeName: string) => {
    setModelDraft({ name: model.name, active: model.active });
    setFormError(null);
    setModal({ kind: "model-edit", model, makeName });
  };
  const openCreateVariant = (modelId: string, modelName: string, makeName: string) => {
    setVariantDraft({
      name: "",
      yearStart: "",
      yearEnd: "",
      active: true,
      imageMode: "upload",
      image: null,
      imageUrlInput: "",
      existingImageUrl: "",
    });
    setFormError(null);
    setModal({ kind: "variant-create", modelId, modelName, makeName });
  };
  const openEditVariant = (variant: CarVariantUI, modelName: string, makeName: string) => {
    const isRemote = /^https?:\/\//i.test(variant.imageUrl);
    setVariantDraft({
      name: variant.name,
      yearStart: variant.yearStart ? String(variant.yearStart) : "",
      yearEnd: variant.yearEnd ? String(variant.yearEnd) : "",
      active: variant.active,
      imageMode: isRemote ? "url" : "upload",
      image: null,
      imageUrlInput: isRemote ? variant.imageUrl : "",
      existingImageUrl: variant.imageUrl,
    });
    setFormError(null);
    setModal({ kind: "variant-edit", variant, modelName, makeName });
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
    setFormError(null);
  };

  // ─────────────── Form submit ───────────────

  const submitMake = async () => {
    const name = makeDraft.name.trim();
    if (!name) {
      setFormError("Make name is required");
      return;
    }

    // Validate URL if in URL mode
    const trimmedUrl = makeDraft.logoUrlInput.trim();
    if (makeDraft.logoMode === "url" && trimmedUrl) {
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        setFormError("Logo URL must start with http:// or https://");
        return;
      }
    }

    try {
      setSaving(true);
      if (modal?.kind === "make-create") {
        const created = await carService.createMake({
          name,
          active: makeDraft.active,
          logo: makeDraft.logoMode === "upload" ? makeDraft.logo : null,
          logoUrl: makeDraft.logoMode === "url" ? trimmedUrl : undefined,
        });
        setMakes((prev) => [...prev, created]);
        setExpandedMakes((s) => new Set(s).add(created.id));
      } else if (modal?.kind === "make-edit") {
        // Determine what to send:
        // - upload mode with a new file → send file
        // - upload mode without a file → leave logo untouched unless user removed it
        // - url mode → send the URL string (empty string clears it)
        const payload: {
          name: string;
          active: boolean;
          logo?: File | null;
          logoUrl?: string;
        } = {
          name,
          active: makeDraft.active,
        };
        if (makeDraft.logoMode === "upload") {
          if (makeDraft.logo) {
            payload.logo = makeDraft.logo;
          } else if (makeDraft.existingLogoUrl === "") {
            // User explicitly removed the existing logo
            payload.logoUrl = "";
          }
        } else {
          // URL mode
          payload.logoUrl = trimmedUrl;
        }
        const updated = await carService.updateMake(modal.make.id, payload);
        setMakes((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
      closeModal();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setFormError(e?.response?.data?.message || e?.message || "Failed to save make");
    } finally {
      setSaving(false);
    }
  };

  const submitModel = async () => {
    const name = modelDraft.name.trim();
    if (!name) {
      setFormError("Model name is required");
      return;
    }
    try {
      setSaving(true);
      if (modal?.kind === "model-create") {
        const created = await carService.createModel({
          makeId: modal.makeId,
          name,
          active: modelDraft.active,
        });
        setModels((prev) => [...prev, created]);
        setExpandedModels((s) => new Set(s).add(created.id));
      } else if (modal?.kind === "model-edit") {
        const updated = await carService.updateModel(modal.model.id, {
          name,
          active: modelDraft.active,
        });
        setModels((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
      closeModal();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setFormError(e?.response?.data?.message || e?.message || "Failed to save model");
    } finally {
      setSaving(false);
    }
  };

  const submitVariant = async () => {
    const name = variantDraft.name.trim();
    const ys = variantDraft.yearStart.trim() ? Number(variantDraft.yearStart) : null;
    const ye = variantDraft.yearEnd.trim() ? Number(variantDraft.yearEnd) : null;
    if (ys && (Number.isNaN(ys) || ys < 1900 || ys > 2100)) {
      setFormError("Year Start must be between 1900 and 2100");
      return;
    }
    if (ye && (Number.isNaN(ye) || ye < 1900 || ye > 2100)) {
      setFormError("Year End must be between 1900 and 2100");
      return;
    }
    if (ys && ye && ye < ys) {
      setFormError("Year End cannot be earlier than Year Start");
      return;
    }

    // Validate URL if in URL mode
    const trimmedUrl = variantDraft.imageUrlInput.trim();
    if (variantDraft.imageMode === "url" && trimmedUrl) {
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        setFormError("Image URL must start with http:// or https://");
        return;
      }
    }

    try {
      setSaving(true);
      if (modal?.kind === "variant-create") {
        const created = await carService.createVariant({
          modelId: modal.modelId,
          name,
          yearStart: ys,
          yearEnd: ye,
          active: variantDraft.active,
          image: variantDraft.imageMode === "upload" ? variantDraft.image : null,
          imageUrl: variantDraft.imageMode === "url" ? trimmedUrl : undefined,
        });
        setVariants((prev) => [...prev, created]);
      } else if (modal?.kind === "variant-edit") {
        const payload: {
          name: string;
          yearStart: number | null;
          yearEnd: number | null;
          active: boolean;
          image?: File | null;
          imageUrl?: string;
        } = {
          name,
          yearStart: ys,
          yearEnd: ye,
          active: variantDraft.active,
        };
        if (variantDraft.imageMode === "upload") {
          if (variantDraft.image) {
            payload.image = variantDraft.image;
          } else if (variantDraft.existingImageUrl === "") {
            payload.imageUrl = "";
          }
        } else {
          payload.imageUrl = trimmedUrl;
        }
        const updated = await carService.updateVariant(modal.variant.id, payload);
        setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      }
      closeModal();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setFormError(e?.response?.data?.message || e?.message || "Failed to save variant");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────── Toggle featured ───────────────

  const toggleFeatured = async (make: CarMakeUI) => {
    try {
      const updated = await carService.toggleFeatured(make.id);
      setMakes((p) => p.map((m) => (m.id === make.id ? updated : m)));
    } catch (e) {
      console.error("Failed to toggle featured", e);
      alert("Failed to toggle featured");
    }
  };

  // ─────────────── Delete handlers ───────────────

  const deleteMake = async (make: CarMakeUI) => {
    if (
      !confirm(
        `Delete "${make.name}" and ALL its models and variants? This cannot be undone.`
      )
    )
      return;
    try {
      await carService.deleteMake(make.id);
      const modelIds = models.filter((m) => m.makeId === make.id).map((m) => m.id);
      setMakes((p) => p.filter((m) => m.id !== make.id));
      setModels((p) => p.filter((m) => m.makeId !== make.id));
      setVariants((p) => p.filter((v) => !modelIds.includes(v.modelId)));
    } catch (e) {
      console.error("Failed to delete make", e);
      alert("Failed to delete make");
    }
  };
  const deleteModel = async (model: CarModelUI) => {
    if (!confirm(`Delete "${model.name}" and all its variants?`)) return;
    try {
      await carService.deleteModel(model.id);
      setModels((p) => p.filter((m) => m.id !== model.id));
      setVariants((p) => p.filter((v) => v.modelId !== model.id));
    } catch (e) {
      console.error("Failed to delete model", e);
      alert("Failed to delete model");
    }
  };
  const deleteVariant = async (variant: CarVariantUI) => {
    if (!confirm(`Delete this variant?`)) return;
    try {
      await carService.deleteVariant(variant.id);
      setVariants((p) => p.filter((v) => v.id !== variant.id));
    } catch (e) {
      console.error("Failed to delete variant", e);
      alert("Failed to delete variant");
    }
  };

  // ─────────────── Filtered data ───────────────

  const totalModels = models.length;
  const totalVariants = variants.length;

  const q = searchQuery.toLowerCase().trim();

  // For grid/list views — flat list of makes filtered by search
  const filteredMakes = useMemo(() => {
    if (!q) return sortedMakes;
    return sortedMakes.filter((make) => {
      // Match if make name matches
      if (make.name.toLowerCase().includes(q)) return true;
      // Match if any child model or variant matches
      const makeModels = modelsByMake.get(make.id) || [];
      for (const model of makeModels) {
        if (model.name.toLowerCase().includes(q)) return true;
        const modelVariants = variantsByModel.get(model.id) || [];
        for (const v of modelVariants) {
          if (v.name.toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [q, sortedMakes, modelsByMake, variantsByModel]);

  // Helper to get year label for a variant
  const getYearLabel = (variant: CarVariantUI) => {
    if (variant.yearStart && variant.yearEnd) {
      return variant.yearStart === variant.yearEnd
        ? `${variant.yearStart}`
        : `${variant.yearStart}–${variant.yearEnd}`;
    }
    if (variant.yearStart) return `${variant.yearStart}+`;
    if (variant.yearEnd) return `–${variant.yearEnd}`;
    return "";
  };

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Cars</h3>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
              {makes.length} make{makes.length !== 1 ? "s" : ""} · {totalModels} model
              {totalModels !== 1 ? "s" : ""} · {totalVariants} variant
              {totalVariants !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateMake}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <span className="text-lg leading-none">+</span> Add Car
          </button>
        </div>

        {/* Search + View Toggle Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3 sm:mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search makes, models, variants…"
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-gray-300 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Expand/Collapse for tree view */}
            {viewMode === "tree" && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedMakes(new Set(sortedMakes.map((m) => m.id)));
                    setExpandedModels(new Set(models.map((m) => m.id)));
                  }}
                  className="text-[11px] px-2 py-1 text-gray-600 hover:text-gray-900 border border-gray-300 rounded"
                  title="Expand all"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedMakes(new Set());
                    setExpandedModels(new Set());
                  }}
                  className="text-[11px] px-2 py-1 text-gray-600 hover:text-gray-900 border border-gray-300 rounded"
                  title="Collapse all"
                >
                  Collapse all
                </button>
              </div>
            )}

            {/* View mode toggle */}
            <div className="flex items-center border border-gray-300 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={`p-1.5 transition-all duration-200 ${
                  viewMode === "tree"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title="Tree view"
              >
                <FolderTree className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("drilldown");
                  setDrillMakeId(null);
                  setDrillModelId(null);
                }}
                className={`p-1.5 transition-all duration-200 ${
                  viewMode === "drilldown"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title="Drill-down view"
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title="Grid view"
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1.5 transition-all duration-200 ${
                  viewMode === "list"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-4 text-sm text-gray-500">Loading…</div>
        ) : error ? (
          <div className="p-4 text-sm text-red-600">{error}</div>
        ) : filteredMakes.length === 0 ? (
          <div className="p-8 text-center border rounded-lg">
            <p className="text-sm text-gray-500">
              {q ? "No results match your search." : "No car makes yet."}
            </p>
            {!q && (
              <button
                type="button"
                onClick={openCreateMake}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                + Add your first make
              </button>
            )}
          </div>
        ) : viewMode === "tree" ? (
          /* ══════════ TREE VIEW ══════════ */
          <div className="border rounded-lg divide-y divide-gray-100">
            {filteredMakes.map((make) => {
              const makeExpanded = expandedMakes.has(make.id);
              const makeModels = modelsByMake.get(make.id) || [];
              const variantCount = makeModels.reduce(
                (sum, m) => sum + (variantsByModel.get(m.id)?.length || 0),
                0
              );
              return (
                <div key={make.id}>
                  {/* Make row */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <button
                      type="button"
                      onClick={() => toggleMake(make.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <span
                        className={`inline-block w-3 text-gray-400 transition-transform ${
                          makeExpanded ? "rotate-90" : ""
                        }`}
                      >
                        ▶
                      </span>
                      {make.logoUrl ? (
                        <Image
                          src={resolveLogoUrl(make.logoUrl)}
                          alt={make.name}
                          width={32}
                          height={32}
                          className="w-8 h-8 object-contain rounded bg-white border border-gray-200"
                          unoptimized
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-400">
                          {make.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {make.name}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        {makeModels.length} model{makeModels.length !== 1 ? "s" : ""} ·{" "}
                        {variantCount} variant{variantCount !== 1 ? "s" : ""}
                      </span>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`hidden sm:inline-flex items-center justify-center h-6 rounded-full px-2 text-[10px] font-medium ${
                          make.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {make.active ? "Active" : "Inactive"}
                      </span>
                      <button
                        type="button"
                        onClick={() => openCreateModel(make.id, make.name)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                      >
                        + Model
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditMake(make)}
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMake(make)}
                        className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFeatured(make)}
                        title={make.featuredOnHome ? "Remove from homepage" : "Show on homepage"}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          make.featuredOnHome ? "bg-honey-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            make.featuredOnHome ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Models */}
                  {makeExpanded && (
                    <div className="bg-gray-50/60">
                      {makeModels.length === 0 ? (
                        <div className="pl-12 pr-4 py-3 text-xs text-gray-400 italic">
                          No models yet.{" "}
                          <button
                            type="button"
                            onClick={() => openCreateModel(make.id, make.name)}
                            className="text-indigo-600 hover:text-indigo-700 not-italic font-semibold"
                          >
                            Add one
                          </button>
                        </div>
                      ) : (
                        makeModels.map((model) => {
                          const modelExpanded = expandedModels.has(model.id);
                          const modelVariants = variantsByModel.get(model.id) || [];
                          return (
                            <div key={model.id}>
                              <div className="flex items-center gap-3 pl-10 pr-4 py-2 hover:bg-gray-100 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => toggleModel(model.id)}
                                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                >
                                  <span
                                    className={`inline-block w-3 text-gray-400 transition-transform ${
                                      modelExpanded ? "rotate-90" : ""
                                    }`}
                                  >
                                    ▶
                                  </span>
                                  <span className="text-sm font-medium text-gray-800 truncate">
                                    {model.name}
                                  </span>
                                  <span className="text-xs text-gray-500 truncate">
                                    {modelVariants.length} variant
                                    {modelVariants.length !== 1 ? "s" : ""}
                                  </span>
                                </button>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span
                                    className={`hidden sm:inline-flex items-center justify-center h-6 rounded-full px-2 text-[10px] font-medium ${
                                      model.active
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {model.active ? "Active" : "Inactive"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openCreateVariant(model.id, model.name, make.name)}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                                  >
                                    + Variant
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditModel(model, make.name)}
                                    className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteModel(model)}
                                    className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>

                              {/* Variants */}
                              {modelExpanded && (
                                <div className="bg-white">
                                  {modelVariants.length === 0 ? (
                                    <div className="pl-16 pr-4 py-3 text-xs text-gray-400 italic border-t border-gray-100">
                                      No variants yet.{" "}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openCreateVariant(model.id, model.name, make.name)
                                        }
                                        className="text-indigo-600 hover:text-indigo-700 not-italic font-semibold"
                                      >
                                        Add one
                                      </button>
                                    </div>
                                  ) : (
                                    modelVariants.map((variant) => {
                                      const yearLabel = getYearLabel(variant);
                                      return (
                                        <div
                                          key={variant.id}
                                          className="flex items-center justify-between pl-16 pr-4 py-2 border-t border-gray-100"
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            {variant.imageUrl ? (
                                              <Image
                                                src={resolveLogoUrl(variant.imageUrl)}
                                                alt={variant.name || "variant"}
                                                width={24}
                                                height={24}
                                                className="w-6 h-6 object-contain rounded bg-white border border-gray-200 flex-shrink-0"
                                                unoptimized
                                              />
                                            ) : null}
                                            <span className="text-sm text-gray-900 truncate">
                                              {variant.name || (
                                                <span className="italic text-gray-400">(base)</span>
                                              )}
                                            </span>
                                            {yearLabel && (
                                              <span className="text-xs text-gray-500">
                                                · {yearLabel}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <span
                                              className={`inline-flex items-center justify-center h-6 rounded-full px-2 text-[10px] font-medium ${
                                                variant.active
                                                  ? "bg-green-100 text-green-700"
                                                  : "bg-red-100 text-red-700"
                                              }`}
                                            >
                                              {variant.active ? "Active" : "Inactive"}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openEditVariant(variant, model.name, make.name)
                                              }
                                              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => deleteVariant(variant)}
                                              className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : viewMode === "drilldown" ? (
          /* ══════════ DRILLDOWN VIEW ══════════ */
          (() => {
            const selectedMake = drillMakeId ? makes.find((m) => m.id === drillMakeId) : null;
            const selectedModel = drillModelId ? models.find((m) => m.id === drillModelId) : null;

            // Level 3: Variants of selected model
            if (selectedMake && selectedModel) {
              const modelVariants = variantsByModel.get(selectedModel.id) || [];
              const filtered = q
                ? modelVariants.filter((v) => v.name.toLowerCase().includes(q))
                : modelVariants;
              return (
                <div>
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-1.5 mb-4 text-sm">
                    <button
                      type="button"
                      onClick={() => { setDrillMakeId(null); setDrillModelId(null); }}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      All Makes
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setDrillModelId(null)}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      {selectedMake.name}
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-700 font-medium">{selectedModel.name}</span>
                  </div>

                  {/* Back + header */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => setDrillModelId(null)}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Models
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateVariant(selectedModel.id, selectedModel.name, selectedMake.name)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                    >
                      + Variant
                    </button>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="p-8 text-center border rounded-lg">
                      <p className="text-sm text-gray-500">
                        {q ? "No variants match your search." : "No variants yet."}
                      </p>
                      {!q && (
                        <button
                          type="button"
                          onClick={() => openCreateVariant(selectedModel.id, selectedModel.name, selectedMake.name)}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          + Add first variant
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {filtered.map((variant) => {
                        const yearLabel = getYearLabel(variant);
                        return (
                          <div
                            key={variant.id}
                            className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                          >
                            {/* Image */}
                            <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center p-3 border-b border-gray-100">
                              {variant.imageUrl ? (
                                <Image
                                  src={resolveLogoUrl(variant.imageUrl)}
                                  alt={variant.name || "variant"}
                                  width={80}
                                  height={80}
                                  className="max-w-full max-h-full object-contain"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-400">
                                  {(variant.name || "V").substring(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="text-sm font-semibold text-gray-900 truncate">
                                  {variant.name || <span className="italic text-gray-400">(base)</span>}
                                </h4>
                                <span
                                  className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    variant.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {variant.active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              {yearLabel && (
                                <p className="text-xs text-gray-500 mb-2">{yearLabel}</p>
                              )}
                              <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                                <button
                                  type="button"
                                  onClick={() => openEditVariant(variant, selectedModel.name, selectedMake.name)}
                                  className="flex-1 text-[11px] text-gray-600 hover:text-gray-800 py-1 rounded hover:bg-gray-100 text-center"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteVariant(variant)}
                                  className="flex-1 text-[11px] text-red-600 hover:text-red-700 py-1 rounded hover:bg-red-50 text-center"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Level 2: Models of selected make
            if (selectedMake) {
              const makeModels = modelsByMake.get(selectedMake.id) || [];
              const filtered = q
                ? makeModels.filter((m) => m.name.toLowerCase().includes(q))
                : makeModels;
              return (
                <div>
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-1.5 mb-4 text-sm">
                    <button
                      type="button"
                      onClick={() => { setDrillMakeId(null); setDrillModelId(null); }}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      All Makes
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-700 font-medium">{selectedMake.name}</span>
                  </div>

                  {/* Back + header */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => { setDrillMakeId(null); setDrillModelId(null); }}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Makes
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateModel(selectedMake.id, selectedMake.name)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                    >
                      + Model
                    </button>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="p-8 text-center border rounded-lg">
                      <p className="text-sm text-gray-500">
                        {q ? "No models match your search." : "No models yet."}
                      </p>
                      {!q && (
                        <button
                          type="button"
                          onClick={() => openCreateModel(selectedMake.id, selectedMake.name)}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          + Add first model
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {filtered.map((model) => {
                        const mv = variantsByModel.get(model.id) || [];
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => setDrillModelId(model.id)}
                            className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-indigo-200 transition-all text-left group"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700">
                                {model.name}
                              </h4>
                              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 flex-shrink-0 mt-0.5" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {mv.length} variant{mv.length !== 1 ? "s" : ""}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  model.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}
                              >
                                {model.active ? "Active" : "Inactive"}
                              </span>
                            </div>
                            {/* Quick actions (stop propagation to prevent drill) */}
                            <div className="flex items-center gap-1 pt-2 mt-2 border-t border-gray-100">
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); openEditModel(model, selectedMake.name); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); openEditModel(model, selectedMake.name); } }}
                                className="flex-1 text-[11px] text-gray-600 hover:text-gray-800 py-1 rounded hover:bg-gray-100 text-center cursor-pointer"
                              >
                                Edit
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); deleteModel(model); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); deleteModel(model); } }}
                                className="flex-1 text-[11px] text-red-600 hover:text-red-700 py-1 rounded hover:bg-red-50 text-center cursor-pointer"
                              >
                                Delete
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Level 1: All makes
            return (
              <div>
                {filteredMakes.length === 0 ? (
                  <div className="p-8 text-center border rounded-lg">
                    <p className="text-sm text-gray-500">
                      {q ? "No makes match your search." : "No car makes yet."}
                    </p>
                    {!q && (
                      <button
                        type="button"
                        onClick={openCreateMake}
                        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        + Add your first make
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {filteredMakes.map((make) => {
                      const makeModels = modelsByMake.get(make.id) || [];
                      const variantCount = makeModels.reduce(
                        (sum, m) => sum + (variantsByModel.get(m.id)?.length || 0),
                        0
                      );
                      return (
                        <button
                          key={make.id}
                          type="button"
                          onClick={() => setDrillMakeId(make.id)}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all text-left group"
                        >
                          {/* Logo */}
                          <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center p-4 border-b border-gray-100">
                            {make.logoUrl ? (
                              <Image
                                src={resolveLogoUrl(make.logoUrl)}
                                alt={make.name}
                                width={80}
                                height={80}
                                className="max-w-full max-h-full object-contain"
                                unoptimized
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-xl font-bold text-gray-400">
                                {make.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700">
                                {make.name}
                              </h4>
                              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 flex-shrink-0 mt-0.5" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {makeModels.length} model{makeModels.length !== 1 ? "s" : ""} · {variantCount} variant{variantCount !== 1 ? "s" : ""}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  make.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}
                              >
                                {make.active ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()
        ) : viewMode === "grid" ? (
          /* ══════════ GRID VIEW ══════════ */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredMakes.map((make) => {
              const makeModels = modelsByMake.get(make.id) || [];
              const variantCount = makeModels.reduce(
                (sum, m) => sum + (variantsByModel.get(m.id)?.length || 0),
                0
              );
              return (
                <div
                  key={make.id}
                  className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Card image / logo */}
                  <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center p-4 border-b border-gray-100">
                    {make.logoUrl ? (
                      <Image
                        src={resolveLogoUrl(make.logoUrl)}
                        alt={make.name}
                        width={80}
                        height={80}
                        className="max-w-full max-h-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-xl font-bold text-gray-400">
                        {make.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{make.name}</h4>
                      <span
                        className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          make.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {make.active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">
                      {makeModels.length} model{makeModels.length !== 1 ? "s" : ""} · {variantCount} variant{variantCount !== 1 ? "s" : ""}
                    </p>

                    {/* Models list */}
                    {makeModels.length > 0 && (
                      <div className="space-y-1 mb-3 max-h-28 overflow-y-auto">
                        {makeModels.map((model) => {
                          const mv = variantsByModel.get(model.id) || [];
                          return (
                            <div
                              key={model.id}
                              className="flex items-center justify-between text-xs px-2 py-1 rounded bg-gray-50"
                            >
                              <span className="text-gray-700 truncate">{model.name}</span>
                              <span className="text-gray-400 flex-shrink-0 ml-2">
                                {mv.length}v
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => openCreateModel(make.id, make.name)}
                        className="flex-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 py-1 rounded hover:bg-indigo-50 text-center"
                      >
                        + Model
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditMake(make)}
                        className="flex-1 text-[11px] text-gray-600 hover:text-gray-800 py-1 rounded hover:bg-gray-100 text-center"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMake(make)}
                        className="flex-1 text-[11px] text-red-600 hover:text-red-700 py-1 rounded hover:bg-red-50 text-center"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFeatured(make)}
                        title={make.featuredOnHome ? "Remove from homepage" : "Show on homepage"}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          make.featuredOnHome ? "bg-honey-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            make.featuredOnHome ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ══════════ LIST VIEW ══════════ */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Make
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Models
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variants
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Homepage
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMakes.map((make) => {
                    const makeModels = modelsByMake.get(make.id) || [];
                    const variantCount = makeModels.reduce(
                      (sum, m) => sum + (variantsByModel.get(m.id)?.length || 0),
                      0
                    );
                    return (
                      <tr key={make.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {make.logoUrl ? (
                              <Image
                                src={resolveLogoUrl(make.logoUrl)}
                                alt={make.name}
                                width={32}
                                height={32}
                                className="w-8 h-8 object-contain rounded bg-white border border-gray-200"
                                unoptimized
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-400">
                                {make.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm font-semibold text-gray-900">{make.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {makeModels.length === 0 ? (
                              <span className="text-xs text-gray-400">—</span>
                            ) : (
                              makeModels.slice(0, 4).map((model) => (
                                <span
                                  key={model.id}
                                  className="inline-flex items-center text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5"
                                >
                                  {model.name}
                                </span>
                              ))
                            )}
                            {makeModels.length > 4 && (
                              <span className="text-xs text-gray-400">
                                +{makeModels.length - 4} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">
                          {variantCount}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center h-6 rounded-full px-2 text-[10px] font-medium ${
                              make.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {make.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => toggleFeatured(make)}
                            title={make.featuredOnHome ? "Remove from homepage" : "Show on homepage"}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              make.featuredOnHome ? "bg-honey-500" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                make.featuredOnHome ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openCreateModel(make.id, make.name)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                            >
                              + Model
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditMake(make)}
                              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMake(make)}
                              className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Search results count */}
        {q && (
          <div className="mt-3 text-sm text-gray-500 text-center">
            Showing {filteredMakes.length} of {makes.length} makes
          </div>
        )}
      </div>

      {/* ───────────── Modals ───────────── */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-100">
              <h4 className="text-sm sm:text-base font-semibold text-gray-900">
                {modal.kind === "make-create" && "Add Car (New Make)"}
                {modal.kind === "make-edit" && `Edit Make — ${modal.make.name}`}
                {modal.kind === "model-create" && `Add Model — ${modal.makeName}`}
                {modal.kind === "model-edit" && `Edit Model — ${modal.makeName}`}
                {modal.kind === "variant-create" &&
                  `Add Variant — ${modal.makeName} ${modal.modelName}`}
                {modal.kind === "variant-edit" &&
                  `Edit Variant — ${modal.makeName} ${modal.modelName}`}
              </h4>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* ─── Body ─── */}
            <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 space-y-3 sm:space-y-4">
              {/* Make form */}
              {(modal.kind === "make-create" || modal.kind === "make-edit") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Make Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={makeDraft.name}
                      onChange={(e) => setMakeDraft((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., Toyota"
                      className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Logo
                    </label>

                    {/* Source toggle */}
                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 mb-3">
                      <button
                        type="button"
                        onClick={() =>
                          setMakeDraft((p) => ({ ...p, logoMode: "upload" }))
                        }
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          makeDraft.logoMode === "upload"
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Upload Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setMakeDraft((p) => ({ ...p, logoMode: "url" }))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          makeDraft.logoMode === "url"
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Image URL
                      </button>
                    </div>

                    {/* Preview + control */}
                    <div className="flex items-start gap-3">
                      {(() => {
                        let previewSrc = "";
                        if (makeDraft.logoMode === "upload") {
                          if (makeDraft.logo) previewSrc = URL.createObjectURL(makeDraft.logo);
                          else if (makeDraft.existingLogoUrl)
                            previewSrc = resolveLogoUrl(makeDraft.existingLogoUrl);
                        } else {
                          if (makeDraft.logoUrlInput.trim()) previewSrc = makeDraft.logoUrlInput.trim();
                          else if (makeDraft.existingLogoUrl)
                            previewSrc = resolveLogoUrl(makeDraft.existingLogoUrl);
                        }
                        return previewSrc ? (
                          <div className="w-14 h-14 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewSrc}
                              alt="preview"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                              }}
                            />
                          </div>
                        ) : null;
                      })()}

                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        {makeDraft.logoMode === "upload" ? (
                          <>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                setMakeDraft((p) => ({
                                  ...p,
                                  logo: e.target.files?.[0] || null,
                                }))
                              }
                              className="block text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                            />
                            {(makeDraft.logo || makeDraft.existingLogoUrl) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMakeDraft((p) => ({
                                    ...p,
                                    logo: null,
                                    existingLogoUrl: "",
                                  }));
                                  if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                                className="text-left text-[11px] text-red-600 hover:text-red-700"
                              >
                                Remove logo
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <input
                              type="url"
                              value={makeDraft.logoUrlInput}
                              onChange={(e) =>
                                setMakeDraft((p) => ({
                                  ...p,
                                  logoUrlInput: e.target.value,
                                }))
                              }
                              placeholder="https://example.com/logo.png"
                              className="w-full h-9 rounded-lg border border-gray-300 px-3 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            {(makeDraft.logoUrlInput || makeDraft.existingLogoUrl) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setMakeDraft((p) => ({
                                    ...p,
                                    logoUrlInput: "",
                                    existingLogoUrl: "",
                                  }))
                                }
                                className="text-left text-[11px] text-red-600 hover:text-red-700"
                              >
                                Clear URL
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <ActiveToggle
                      value={makeDraft.active}
                      onChange={(v) => setMakeDraft((p) => ({ ...p, active: v }))}
                    />
                  </div>
                </>
              )}

              {/* Model form */}
              {(modal.kind === "model-create" || modal.kind === "model-edit") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Model Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={modelDraft.name}
                      onChange={(e) => setModelDraft((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., Corolla"
                      className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <ActiveToggle
                      value={modelDraft.active}
                      onChange={(v) => setModelDraft((p) => ({ ...p, active: v }))}
                    />
                  </div>
                </>
              )}

              {/* Variant form */}
              {(modal.kind === "variant-create" || modal.kind === "variant-edit") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Variant Name
                    </label>
                    <input
                      type="text"
                      value={variantDraft.name}
                      onChange={(e) => setVariantDraft((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., GLi 1.6 (optional)"
                      className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                        Year Start
                      </label>
                      <Select<YearOption, false>
                        options={YEAR_OPTIONS}
                        value={YEAR_OPTIONS.find((o) => o.value === variantDraft.yearStart) || null}
                        onChange={(opt: SingleValue<YearOption>) =>
                          setVariantDraft((p) => ({ ...p, yearStart: opt?.value || "" }))
                        }
                        isClearable
                        placeholder="Select year"
                        styles={yearSelectStyles}
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        menuPlacement="auto"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                        Year End
                      </label>
                      <Select<YearOption, false>
                        options={YEAR_OPTIONS}
                        value={YEAR_OPTIONS.find((o) => o.value === variantDraft.yearEnd) || null}
                        onChange={(opt: SingleValue<YearOption>) =>
                          setVariantDraft((p) => ({ ...p, yearEnd: opt?.value || "" }))
                        }
                        isClearable
                        placeholder="Select year"
                        styles={yearSelectStyles}
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        menuPlacement="auto"
                      />
                    </div>
                  </div>

                  {/* Image upload / URL */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Image
                    </label>

                    {/* Source toggle */}
                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 mb-3">
                      <button
                        type="button"
                        onClick={() =>
                          setVariantDraft((p) => ({ ...p, imageMode: "upload" }))
                        }
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          variantDraft.imageMode === "upload"
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Upload Image
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setVariantDraft((p) => ({ ...p, imageMode: "url" }))
                        }
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          variantDraft.imageMode === "url"
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Image URL
                      </button>
                    </div>

                    {/* Preview + control */}
                    <div className="flex items-start gap-3">
                      {(() => {
                        let previewSrc = "";
                        if (variantDraft.imageMode === "upload") {
                          if (variantDraft.image)
                            previewSrc = URL.createObjectURL(variantDraft.image);
                          else if (variantDraft.existingImageUrl)
                            previewSrc = resolveLogoUrl(variantDraft.existingImageUrl);
                        } else {
                          if (variantDraft.imageUrlInput.trim())
                            previewSrc = variantDraft.imageUrlInput.trim();
                          else if (variantDraft.existingImageUrl)
                            previewSrc = resolveLogoUrl(variantDraft.existingImageUrl);
                        }
                        return previewSrc ? (
                          <div className="w-14 h-14 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewSrc}
                              alt="preview"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                              }}
                            />
                          </div>
                        ) : null;
                      })()}

                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        {variantDraft.imageMode === "upload" ? (
                          <>
                            <input
                              ref={variantFileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                setVariantDraft((p) => ({
                                  ...p,
                                  image: e.target.files?.[0] || null,
                                }))
                              }
                              className="block text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                            />
                            {(variantDraft.image || variantDraft.existingImageUrl) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVariantDraft((p) => ({
                                    ...p,
                                    image: null,
                                    existingImageUrl: "",
                                  }));
                                  if (variantFileInputRef.current)
                                    variantFileInputRef.current.value = "";
                                }}
                                className="text-left text-[11px] text-red-600 hover:text-red-700"
                              >
                                Remove image
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <input
                              type="url"
                              value={variantDraft.imageUrlInput}
                              onChange={(e) =>
                                setVariantDraft((p) => ({
                                  ...p,
                                  imageUrlInput: e.target.value,
                                }))
                              }
                              placeholder="https://example.com/image.png"
                              className="w-full h-9 rounded-lg border border-gray-300 px-3 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            {(variantDraft.imageUrlInput || variantDraft.existingImageUrl) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setVariantDraft((p) => ({
                                    ...p,
                                    imageUrlInput: "",
                                    existingImageUrl: "",
                                  }))
                                }
                                className="text-left text-[11px] text-red-600 hover:text-red-700"
                              >
                                Clear URL
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <ActiveToggle
                      value={variantDraft.active}
                      onChange={(v) => setVariantDraft((p) => ({ ...p, active: v }))}
                    />
                  </div>
                </>
              )}

              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            {/* ─── Footer ─── */}
            <div className="flex items-center justify-end gap-2 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modal.kind === "make-create" || modal.kind === "make-edit") submitMake();
                  else if (modal.kind === "model-create" || modal.kind === "model-edit")
                    submitModel();
                  else submitVariant();
                }}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : modal.kind.endsWith("edit")
                    ? "Save Changes"
                    : modal.kind === "make-create"
                      ? "Add Make"
                      : modal.kind === "model-create"
                        ? "Add Model"
                        : "Add Variant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────── Reusable toggle ───────────────

function ActiveToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      className={`inline-flex items-center h-6 w-11 rounded-full transition ${
        value ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
