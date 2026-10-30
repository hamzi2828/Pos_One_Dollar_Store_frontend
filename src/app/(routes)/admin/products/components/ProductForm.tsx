"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import type { Product, ProductVariant } from "./AllProducts";
import type { Category } from "./CategoriesTab";
import { slugify, buildVariantCombos, syncVariants, type Variant } from "../services/productCreateService";
import { productService, type ProductUI } from "../services/productService";
import { useCurrency } from "@/context/CurrencyContext";
import { ChevronDown, Hash, Loader2 } from "lucide-react";
import PackagingStockCard from "./packaging/PackagingStockCard";
import VariantCodesRow from "./packaging/VariantCodesRow";
import {
  type PackagingState,
  type ProductCodeFields,
  type VariantCodeFields,
  appendPackagingFields,
  computedStock,
  initPackaging,
  normalizeCode,
  piecesPerSaleOf,
  readBackendError,
  validatePackaging,
  variantPayload,
} from "./packaging/packagingUtils";
import PriceTierSelect, { syncProductTier, type TierChoice } from "../price-tiers/components/PriceTierSelect";
import { SearchSelect } from "@/components/ui/SearchSelect";
import NumberMoneyInput from "./NumberMoneyInput";

// Product as loaded for editing (fields not shown in the list type)
interface ExtendedProduct extends Product {
  description?: string;
  shortDescription?: string;
  sku?: string;
  costPrice?: number;
  dimensionLength?: string;
  dimensionWidth?: string;
  dimensionHeight?: string;
  weight?: string;
  createdAt?: string;
}

export interface ProductFormData extends Omit<Product, "id"> {
  description?: string;
  shortDescription?: string;
  subCategory?: string;
  sku?: string;
  costPrice?: number;
  videoUrl?: string;
  dimensionLength?: string;
  dimensionWidth?: string;
  dimensionHeight?: string;
  weight?: string;
}

interface ProductFormProps {
  mode: "create" | "edit";
  initialData?: Product;
  categories: Category[];
  colorOptions: string[];
  sizeOptions: string[];
  onSubmit?: (data: ProductFormData) => void;
  onCancel?: () => void;
  // Gets the saved product (create: use its id to open the stickers page)
  // receivedPieces: receiving popup only (pieces typed in "Stock Quantity", entered with the delivery)
  onSuccess?: (product?: ProductUI, extra?: { receivedPieces?: number }) => void;
  onManageAttributes?: () => void;
  /** Receiving goods: stock comes from the delivery entry, so no stock is typed here (saved as 0). */
  noStock?: boolean;
  /** Create: name to start with (e.g. what was searched). */
  defaultName?: string;
}

type VariantWithCodes = ProductVariant & VariantCodeFields;

// Per-colour picture. Banner images / video saved on older products are kept as they are.
interface ColorMediaData {
  thumbnailUrl?: string;
  bannerUrls: string[];
  thumbFile?: File;
  videoUrl?: string;
  modified?: boolean;
}

// Helper to validate URLs before passing to Image component
const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// The shop sells most things at one price: new products start at Rs 300.
const DEFAULT_SALE_PRICE = 300;

const initialFormData: ProductFormData = {
  name: "",
  category: "",
  subCategory: "",
  price: DEFAULT_SALE_PRICE,
  discountedPrice: DEFAULT_SALE_PRICE,
  costPrice: undefined,
  stock: 0,
  status: "draft",
  thumbnailUrl: "",
  bannerUrls: [],
  videoUrl: "",
  productType: "single",
  variants: [],
  description: "",
  shortDescription: "",
  features: "",
  sku: "",
  dimensionLength: "",
  dimensionWidth: "",
  dimensionHeight: "",
  weight: ""
};

// Valid tab keys (the variant tab is only shown when editing a variant product)
type TabKey = "content" | "variant";
const VALID_TABS: TabKey[] = ["content", "variant"];

export default function ProductForm({
  mode,
  initialData,
  categories,
  colorOptions,
  sizeOptions,
  onSubmit,
  onCancel,
  onSuccess,
  onManageAttributes,
  noStock = false,
  defaultName = "",
}: ProductFormProps) {
  const { currency } = useCurrency();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Create: one step. Edit: the variant tab only for variant products.
  const wasVariant = mode === "edit" && (initialData as { productType?: string } | undefined)?.productType === "variant";
  const effectiveValidTabs: TabKey[] =
    mode === "edit" ? (wasVariant ? VALID_TABS : VALID_TABS.filter((t) => t !== "variant")) : ["content"];

  // Get initial tab from URL or default to "content"
  const getInitialTab = (): TabKey => {
    const tabParam = searchParams.get("tab");
    if (tabParam && effectiveValidTabs.includes(tabParam as TabKey)) {
      return tabParam as TabKey;
    }
    return "content";
  };

  const [form, setForm] = useState<ProductFormData>(initialData ? {
    ...initialData,
    // Add backend URL prefix to image URLs for display (if not already present)
    thumbnailUrl: initialData.thumbnailUrl
      ? (initialData.thumbnailUrl.startsWith('http')
          ? initialData.thumbnailUrl
          : `${process.env.NEXT_PUBLIC_BACKEND_URL}${initialData.thumbnailUrl}`)
      : initialData.thumbnailUrl,
    bannerUrls: Array.isArray(initialData.bannerUrls)
      ? initialData.bannerUrls.map((url: string) =>
          url.startsWith('http')
            ? url
            : `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`)
      : initialData.bannerUrls,
    description: (initialData as ExtendedProduct)?.description || "",
    shortDescription: (initialData as ExtendedProduct)?.shortDescription || "",
    features: (initialData as ExtendedProduct)?.features || "",
    subCategory: (initialData as any)?.subCategory || "",
    sku: (initialData as ExtendedProduct)?.sku || "",
    costPrice: (initialData as ExtendedProduct)?.costPrice,
    videoUrl: (initialData as any)?.videoUrl || "",
    dimensionLength: (initialData as ExtendedProduct)?.dimensionLength || "",
    dimensionWidth: (initialData as ExtendedProduct)?.dimensionWidth || "",
    dimensionHeight: (initialData as ExtendedProduct)?.dimensionHeight || "",
    weight: (initialData as ExtendedProduct)?.weight || ""
  } : { ...initialFormData, name: defaultName, ...(noStock ? { status: "published" as const } : {}) });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab);
  const [isLoading, setIsLoading] = useState(false);
  // Synchronous lock: Enter + click (or a double click) must not create/update the product twice
  const submittingRef = useRef(false);
  // Price tier (dollar-store price point): locks the sale price; saved after the product.
  const [priceTier, setPriceTier] = useState<TierChoice>(null);
  // Receiving popup: pieces received now (go in with the delivery entry, not as opening stock)
  const [receivedPieces, setReceivedPieces] = useState("");
  const savedTierId = useRef<string | null>(null);

  // Packaging / barcodes / batches (single products). Edit: loaded from the product.
  const [packaging, setPackaging] = useState<PackagingState>(() =>
    initPackaging(initialData && initialData.productType !== "variant" ? (initialData as unknown as ProductCodeFields) : null)
  );
  // Errors from the backend for a code (409 duplicate / 400 invalid short code)
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});
  // Variant rows with the "options & barcodes" row open (key = color|size)
  const [openVariantRows, setOpenVariantRows] = useState<Record<string, boolean>>({});
  const productId = mode === "edit" ? (initialData as Product | undefined)?.id : undefined;
  // Pieces handed over in one sale (single products): prices and stock are per sale.
  const pps = form.productType === "variant" ? 1 : piecesPerSaleOf(packaging);
  const savedStock = Number((initialData as Product | undefined)?.stock) || 0;

  // Update URL when tab changes
  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // Sync tab state with URL changes (e.g., browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && effectiveValidTabs.includes(tabParam as TabKey) && tabParam !== activeTab) {
      setActiveTab(tabParam as TabKey);
    }
  }, [searchParams, effectiveValidTabs]);
  
  // Picked thumbnail (single products)
  const [thumbFile, setThumbFile] = useState<File | null>(null);

  // Variant state
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [colorMedia, setColorMedia] = useState<Record<string, ColorMediaData>>({});

  // Product type change confirmation modal
  const [showTypeChangeModal, setShowTypeChangeModal] = useState<{ show: boolean; targetType: 'single' | 'variant' }>({ show: false, targetType: 'single' });

  // Category dropdown state (Select2 style)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Subcategory dropdown state (Select2 style)
  const [subCategoryDropdownOpen, setSubCategoryDropdownOpen] = useState(false);
  const [subCategorySearchQuery, setSubCategorySearchQuery] = useState("");
  const subCategoryDropdownRef = useRef<HTMLDivElement>(null);

  // Variant colors multi-select dropdown state (Select2 style)
  const [variantColorDropdownOpen, setVariantColorDropdownOpen] = useState(false);
  const [variantColorSearchQuery, setVariantColorSearchQuery] = useState("");
  const variantColorDropdownRef = useRef<HTMLDivElement>(null);

  // Variant sizes multi-select dropdown state (Select2 style)
  const [variantSizeDropdownOpen, setVariantSizeDropdownOpen] = useState(false);
  const [variantSizeSearchQuery, setVariantSizeSearchQuery] = useState("");
  const variantSizeDropdownRef = useRef<HTMLDivElement>(null);

  // Top-level (parent) categories for Category Select2
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parentId && c.active !== false),
    [categories]
  );

  const filteredParentCategories = useMemo(() => {
    const q = categorySearchQuery.toLowerCase().trim();
    if (!q) return parentCategories;
    return parentCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [parentCategories, categorySearchQuery]);

  // Children of the currently selected Category, for Subcategory Select2
  const childCategories = useMemo(() => {
    if (!form.category) return [];
    const parent = categories.find((c) => c.name === form.category);
    if (!parent) return [];
    return categories.filter((c) => c.parentId === parent.id && c.active !== false);
  }, [categories, form.category]);

  const filteredChildCategories = useMemo(() => {
    const q = subCategorySearchQuery.toLowerCase().trim();
    if (!q) return childCategories;
    return childCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [childCategories, subCategorySearchQuery]);

  // Filter colors for variant multi-select
  const filteredVariantColorOptions = useMemo(() => {
    if (!variantColorSearchQuery.trim()) return colorOptions;
    return colorOptions.filter(color =>
      color.toLowerCase().includes(variantColorSearchQuery.toLowerCase())
    );
  }, [colorOptions, variantColorSearchQuery]);

  // Filter sizes for variant multi-select
  const filteredVariantSizeOptions = useMemo(() => {
    if (!variantSizeSearchQuery.trim()) return sizeOptions;
    return sizeOptions.filter(size =>
      size.toLowerCase().includes(variantSizeSearchQuery.toLowerCase())
    );
  }, [sizeOptions, variantSizeSearchQuery]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
        setCategorySearchQuery("");
      }
      if (subCategoryDropdownRef.current && !subCategoryDropdownRef.current.contains(event.target as Node)) {
        setSubCategoryDropdownOpen(false);
        setSubCategorySearchQuery("");
      }
      if (variantColorDropdownRef.current && !variantColorDropdownRef.current.contains(event.target as Node)) {
        setVariantColorDropdownOpen(false);
        setVariantColorSearchQuery("");
      }
      if (variantSizeDropdownRef.current && !variantSizeDropdownRef.current.contains(event.target as Node)) {
        setVariantSizeDropdownOpen(false);
        setVariantSizeSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Refs
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const colorThumbRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isVariant = form.productType === "variant";

  // New single product: pick a free 5-digit short code now, so the form can show
  // the real short code + SKU before saving (backend re-checks on save).
  const pickingCodeRef = useRef(false);
  const [pickingCode, setPickingCode] = useState(false);
  useEffect(() => {
    if (mode !== "create" || isVariant || packaging.shortCode || pickingCodeRef.current) return;
    pickingCodeRef.current = true;
    setPickingCode(true);
    (async () => {
      let picked = "";
      for (let i = 0; i < 8 && !picked; i++) {
        const code = String(10000 + Math.floor(Math.random() * 90000));
        try {
          const res = await productService.checkCode(code);
          if (res.available) picked = code;
        } catch {
          break; // offline / no permission: the backend makes one on save
        }
      }
      if (picked) setPackaging((prev) => (prev.shortCode ? prev : { ...prev, shortCode: picked }));
      pickingCodeRef.current = false;
      setPickingCode(false);
    })();
  }, [mode, isVariant, packaging.shortCode]);
  const nameInitials = (form.name || "")
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const autoSku =
    mode === "create" && !isVariant && packaging.shortCode
      ? `${nameInitials || "P"}-${packaging.shortCode}`
      : form.sku || "";

  const slug = useMemo(() => slugify(form.name), [form.name]);
  
  
  // Helper to clean URL for sending to backend (remove domain, keep relative path)
  const cleanUrlForBackend = (url: string): string => {
    if (!url) return url;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    let cleanUrl = url;
    if (backendUrl && cleanUrl.startsWith(backendUrl)) {
      cleanUrl = cleanUrl.replace(backendUrl, '');
    }
    // Don't add '/' prefix to absolute URLs (http/https)
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      return cleanUrl;
    }
    return cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
  };
  // Helper to resolve URLs from backend (handles absolute URLs and corrupted /https:// URLs)
  const resolveBackendUrl = (url: string, backendUrl: string): string => {
    if (!url) return url;
    // Fix corrupted URLs that have /https:// or /http://
    if (url.startsWith('/https://') || url.startsWith('/http://')) {
      return url.substring(1); // Remove the leading /
    }
    // Don't modify absolute URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Prepend backendUrl to relative URLs
    return backendUrl ? `${backendUrl}${url}` : url;
  };

  // Initialize form data from initialData for edit mode
  useEffect(() => {
    if (mode === "edit" && initialData) {
      // Extract variants information to set selected colors and sizes
      if (initialData.productType === "variant" && initialData.variants) {
        const colors = Array.from(new Set((initialData.variants as ProductVariant[]).map(v => v.color).filter(Boolean)));
        const sizes = Array.from(new Set((initialData.variants as ProductVariant[]).map(v => v.size).filter(Boolean)));
        setSelectedColors(colors);
        setSelectedSizes(sizes);

        // Initialize colorMedia from existing product data
        if (initialData.colorMedia && typeof initialData.colorMedia === 'object') {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
          const colorMediaData: Record<string, ColorMediaData> = {};
          Object.entries(initialData.colorMedia).forEach(([color, media]) => {
            if (media && typeof media === 'object') {
              colorMediaData[color] = {
                thumbnailUrl: media.thumbnailUrl ? resolveBackendUrl(media.thumbnailUrl, backendUrl) : undefined,
                bannerUrls: Array.isArray(media.bannerUrls)
                  ? media.bannerUrls.map((url: string) => resolveBackendUrl(url, backendUrl))
                  : [],
                videoUrl: (media as any).videoUrl ? resolveBackendUrl((media as any).videoUrl, backendUrl) : undefined,
                modified: false // Mark as not modified initially
              };
            }
          });
          setColorMedia(colorMediaData);
        }
      }
    }
  }, [mode, initialData]);
  
  // Build all color-size combinations
  const variantCombos = useMemo(
    () => buildVariantCombos(selectedColors, selectedSizes),
    [selectedColors, selectedSizes]
  );
  
  // Keep form.variants in sync with selections
  useEffect(() => {
    if (!isVariant) return;

    // In edit mode, protect existing variant data by only syncing when actually needed
    if (mode === "edit" && initialData?.variants && Array.isArray(initialData.variants)) {
      const currentVariants = form.variants || [];

      // If we have no current variants but should have them from initialData,
      // or if variantCombos length is 0 (indicating initialization phase), skip
      if (variantCombos.length === 0 || currentVariants.length === 0) {
        return;
      }

      // Check if current variants match the variant combos exactly
      const hasAllCombos = variantCombos.every(combo =>
        currentVariants.some(v => v.color === combo.color && v.size === combo.size)
      );
      const hasExtraVariants = currentVariants.some(v =>
        !variantCombos.some(combo => combo.color === v.color && combo.size === v.size)
      );

      // Only sync if the combinations don't match (user changed color/size selections)
      if (!hasAllCombos || hasExtraVariants) {
        const next = syncVariants((form.variants || []) as unknown as Variant[], variantCombos);
        if (JSON.stringify(next) !== JSON.stringify(form.variants || [])) {
          setField("variants", next as ProductVariant[]);
        }
      }
    } else if (mode === "create") {
      // For create mode, always sync when combinations change
      const next = syncVariants((form.variants || []) as unknown as Variant[], variantCombos);
      if (JSON.stringify(next) !== JSON.stringify(form.variants || [])) {
        setField("variants", next as ProductVariant[]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantCombos, isVariant, mode]);
  
  const safeRevoke = useCallback((url?: string) => {
    if (url && url.startsWith("blob:")) {
      try { URL.revokeObjectURL(url); } catch {}
    }
  }, []);
  
  const validate = (): { isValid: boolean; errors: Record<string, string> } => {
    const e: Record<string, string> = {};

    // Basic validations
    if (!form.name?.trim()) e.name = "Name is required";
    if (!form.category) e.category = "Category is required";

    if (!isVariant) {
      if (form.stock < 0) e.stock = "Stock cannot be negative";
      // Thumbnail is optional so simple items (pens, cables) can be added quickly.
      // Required fields for single products (SKU is optional: the short code is the main code)
      if (form.costPrice === undefined || form.costPrice === null) e.costPrice = "Cost Price is required";
      if (form.discountedPrice === undefined || form.discountedPrice === null || Number(form.discountedPrice) <= 0) e.discountedPrice = "Sale Price is required";
      // Boxes / batches / short code
      Object.assign(e, validatePackaging(packaging, mode));
    } else {
      if (selectedColors.length === 0 && selectedSizes.length === 0 && (form.variants || []).length === 0) {
        e.colors = "Select at least one color or one size";
      }
    }

    // Dimensions and weight are optional

    setErrors(e);
    return { isValid: Object.keys(e).length === 0, errors: e };
  };

  // Navigation helpers
  const currentTabIndex = effectiveValidTabs.indexOf(activeTab);
  const isLastTab = currentTabIndex === effectiveValidTabs.length - 1;
  const isFirstTab = activeTab === "content";

  const goToNextTab = () => {
    if (currentTabIndex < effectiveValidTabs.length - 1) {
      handleTabChange(effectiveValidTabs[currentTabIndex + 1]);
    }
  };

  const goToPreviousTab = () => {
    if (currentTabIndex > 0) {
      handleTabChange(effectiveValidTabs[currentTabIndex - 1]);
    }
  };
  
  const setField = useCallback(<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Box / batch mode: stock is computed (boxes x pieces + loose, or sum of batches)
  useEffect(() => {
    if (isVariant) return;
    const c = computedStock(packaging);
    if (c !== null && c !== form.stock) setField("stock", c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packaging, isVariant]);

  const updatePackaging = useCallback((next: PackagingState) => {
    setPackaging(next);
    setCodeErrors((prev) => (prev.shortCode || prev.barcodes ? { ...prev, shortCode: "", barcodes: "" } : prev));
  }, []);

  const updateVariantAt = (index: number, patch: Partial<VariantWithCodes>) => {
    const newVariants = [...((form.variants as VariantWithCodes[]) || [])];
    newVariants[index] = { ...newVariants[index], ...patch };
    setField("variants", newVariants as ProductVariant[]);
    if (codeErrors[`variant-${index}`]) setCodeErrors((prev) => ({ ...prev, [`variant-${index}`]: "" }));
  };
  
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (form.thumbnailUrl && form.thumbnailUrl.toString().startsWith("blob:")) {
      safeRevoke(form.thumbnailUrl.toString());
    }
    setThumbFile(file);
    setField("thumbnailUrl", URL.createObjectURL(file));
    setErrors(prev => ({ ...prev, thumbnail: "" }));
  };

  const handleColorThumbFiles = (color: string, files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;

    setColorMedia((prev) => {
      const prevUrl = prev[color]?.thumbnailUrl;
      if (prevUrl && prevUrl.startsWith("blob:")) {
        safeRevoke(prevUrl);
      }
      const url = URL.createObjectURL(file);
      return {
        ...prev,
        [color]: {
          ...prev[color],
          thumbnailUrl: url,
          thumbFile: file,
          bannerUrls: prev[color]?.bannerUrls || [],
          modified: true
        },
      };
    });
  };

  const clearColorMedia = (color: string) => {
    setColorMedia((prev) => {
      const curr = prev[color];
      if (curr?.thumbnailUrl) safeRevoke(curr.thumbnailUrl);
      (curr?.bannerUrls || []).forEach(safeRevoke);
      if (curr?.videoUrl) safeRevoke(curr.videoUrl);
      return {
        ...prev,
        [color]: { bannerUrls: [], videoUrl: undefined, modified: true }
      };
    });
    if (colorThumbRefs.current[color]) colorThumbRefs.current[color]!.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const validation = validate();
    if (!validation.isValid) {
      const errs = validation.errors;
      // Navigate to the tab with the first error
      if (errs.colors || errs.sizes) {
        handleTabChange("variant");
        toast.error(errs.colors || errs.sizes);
      } else if (errs.name || errs.category || errs.price || errs.stock || errs.costPrice || errs.discountedPrice || errs.piecesPerBox || errs.piecesPerSale || errs.boxes || errs.batches || errs.shortCode) {
        handleTabChange("content");
        toast.error("Please fix the errors in Product Details tab");
      } else if (errs.thumbnail) {
        handleTabChange(isVariant ? "variant" : "content");
        toast.error(errs.thumbnail);
      }
      return;
    }
    
    submittingRef.current = true;
    setIsLoading(true);
    try {
      const formData = new FormData();
      
      // Basic fields
      formData.append("name", form.name);
      formData.append("slug", slug);
      formData.append("category", form.category);
      if (form.subCategory) {
        formData.append("subCategory", form.subCategory);
      }
      // Only "Sale Price" is typed: it is both the price and the sale price.
      formData.append("price", String(form.discountedPrice ?? form.price ?? 0));
      if (form.discountedPrice !== undefined && form.discountedPrice !== null) {
        formData.append("discountedPrice", String(form.discountedPrice));
      }
      formData.append("stock", String(form.stock ?? 0));
      formData.append("status", form.status);
      formData.append("productType", form.productType || "single");

      // Description fields
      formData.append("description", form.description || "");
      formData.append("shortDescription", form.shortDescription || "");

      // Features as a simple string
      formData.append("features", form.features || "");

      // SKU: on create the one shown in the form (name initials + short code);
      // on edit the saved one is sent back unchanged.
      if (!isVariant && mode === "create" && autoSku) {
        formData.append("sku", autoSku);
      } else if (!isVariant && mode === "edit" && form.sku?.trim()) {
        formData.append("sku", form.sku.trim());
      }

      // Boxes / batches / barcodes / short code (single products).
      // Overrides `stock` when it is computed from boxes or batches.
      if (!isVariant) {
        appendPackagingFields(formData, packaging, mode);
      }

      // Cost Price for single products
      if (!isVariant && form.costPrice !== undefined && form.costPrice !== null) {
        formData.append("costPrice", String(form.costPrice));
      }

      if (isVariant && form.variants) {
        // Handle variant products
        const variantStock = form.variants.reduce((sum, v) => sum + (Number((v as ProductVariant).stock) || 0), 0);
        const basePrice = (form.variants[0] as ProductVariant)?.discountedPrice ?? (form.variants[0] as ProductVariant)?.price ?? 0;
        formData.set("stock", String(variantStock));
        formData.set("price", String(basePrice));
        // Drop view-only fields (totalStock) and clean options + barcodes
        formData.append("variants", JSON.stringify((form.variants as VariantWithCodes[]).map((v) => {
          const payload = variantPayload(v as unknown as Record<string, unknown>);
          return noStock ? { ...payload, stock: 0 } : payload;
        })));
        
        // Colour pictures
        for (const [color, media] of Object.entries(colorMedia)) {
          // Always process media in edit mode, regardless of modified status
          if (mode === "edit" || media.modified) {
            // Send new thumbnail file if uploaded
            if (media.thumbFile) {
              const thumbFileName = `${color}_${media.thumbFile.name}`;
              const renamedThumbFile = new File([media.thumbFile], thumbFileName, { type: media.thumbFile.type });
              formData.append("colorThumbnail", renamedThumbFile);
            } else if (media.thumbnailUrl && !media.thumbnailUrl.startsWith('blob:')) {
              // Keep existing thumbnail if no new file uploaded
              const cleanUrl = cleanUrlForBackend(media.thumbnailUrl);
              formData.append("existingColorThumbnails", JSON.stringify({ color, url: cleanUrl }));
            }


            // Keep saved banner images
            const existingBanners = (media.bannerUrls || []).filter(url =>
              typeof url === 'string' && !url.startsWith('blob:')
            );
            if (existingBanners.length > 0) {
              const cleanUrls = existingBanners.map(cleanUrlForBackend);
              formData.append("existingColorBanners", JSON.stringify({ color, urls: cleanUrls }));
            }

            // Keep a saved video
            if (media.videoUrl && !media.videoUrl.startsWith('blob:')) {
              const cleanUrl = cleanUrlForBackend(media.videoUrl);
              formData.append("existingColorVideos", JSON.stringify({ color, url: cleanUrl }));
            }
          }
        }
      } else {
        // Single products
        if (thumbFile) formData.append("thumbnail", thumbFile);
      }
      
      // For edit mode, preserve existing images and video
      if (mode === "edit" && initialData) {
        if (!isVariant) {
          if (!thumbFile && initialData.thumbnailUrl) {
            // Clean the thumbnail URL to get relative path
            const cleanThumbUrl = cleanUrlForBackend(form.thumbnailUrl || initialData.thumbnailUrl);
            formData.append("existingThumbnail", cleanThumbUrl);
          }
          // Send the current banner URLs (which may have been modified by removal)
          // Filter out blob URLs and only keep actual server URLs
          const existingServerBanners = (form.bannerUrls || []).filter(url =>
            typeof url === 'string' && !url.startsWith('blob:')
          ).map(cleanUrlForBackend);
          if (existingServerBanners.length > 0) {
            formData.append("existingBanners", JSON.stringify(existingServerBanners));
          }
          // Keep a video saved on older products
          if (form.videoUrl && !form.videoUrl.startsWith('blob:')) {
            const cleanVideoUrl = cleanUrlForBackend(form.videoUrl);
            formData.append("existingVideo", cleanVideoUrl);
          }
        }
      }
      
      // Leaving a price tier: unlink FIRST. While a product is on a tier the
      // server keeps its sale price at the tier price, so a newly typed price
      // would otherwise be overwritten by the old tier.
      if (mode !== "create" && !priceTier && savedTierId.current) {
        await syncProductTier(productId, null, savedTierId.current);
        savedTierId.current = null;
      }

      // Receiving goods: the pieces go in with the delivery entry, never here.
      if (noStock) formData.set("stock", "0");

      let saved: ProductUI;
      if (mode === "create") {
        saved = await productService.createProduct(formData);
      } else {
        saved = await productService.updateProduct((initialData as Product).id, formData);
      }
      
      if (onSubmit) {
        onSubmit({ ...form, slug });
      }
      
      toast.success(mode === "create" ? "Product successfully added and saved." : "Product successfully updated and saved.");

      // Price tier link (needs price_tiers edit; never fails the product save).
      await syncProductTier(saved?.id || productId, priceTier?._id ?? null, savedTierId.current);
      savedTierId.current = mode === "create" ? null : priceTier?._id ?? null;
      if (mode === "create") setPriceTier(null);

      if (mode === "create") {
        // Reset form
        setForm(initialFormData);
        setSelectedColors([]);
        setSelectedSizes([]);
        setColorMedia({});
        setThumbFile(null);
        if (thumbInputRef.current) thumbInputRef.current.value = "";
        setPackaging(initPackaging(null));
      }
      setCodeErrors({});
      
      const received = noStock ? Math.max(0, Math.floor(Number(receivedPieces) || 0)) : 0;
      if (noStock) setReceivedPieces("");
      if (onSuccess) onSuccess(saved, noStock ? { receivedPieces: received } : undefined);
      
    } catch (error) {
      console.error(`Error ${mode === "create" ? "creating" : "updating"} product:`, error);
      const be = readBackendError(error);
      const dupCode = normalizeCode(be?.duplicateCode);
      if (
        be && be.status === 409 && mode === "create" && !isVariant && dupCode &&
        (dupCode === normalizeCode(packaging.shortCode) || dupCode === normalizeCode(autoSku))
      ) {
        setPackaging((prev) => ({ ...prev, shortCode: "" })); // effect above picks a new one
        toast.error("That code was just used by another product. A new code was picked - please click Create Product again.");
      } else if (be && (be.status === 409 || be.code === "INVALID_SHORT_CODE") && (be.duplicateCode || be.code === "INVALID_SHORT_CODE")) {
        // Show the message next to the field that holds the code
        const dup = normalizeCode(be.duplicateCode);
        const next: Record<string, string> = {};
        let tab: TabKey = "content";
        if (be.code === "INVALID_SHORT_CODE") {
          next.shortCode = be.message || "Short code must be 3 to 8 digits";
        } else if (!isVariant) {
          if (dup && normalizeCode(packaging.shortCode) === dup) next.shortCode = be.message;
          else if (packaging.barcodes.some((b) => normalizeCode(b.code) === dup)) next.barcodes = be.message;
          else if (dup && normalizeCode(form.sku) === dup) next.sku = be.message;
          else if (packaging.trackBatches) next.batches = be.message;
          else next.barcodes = be.message;
        } else {
          tab = "variant";
          const idx = ((form.variants as VariantWithCodes[]) || []).findIndex(
            (v) =>
              normalizeCode(v.shortCode) === dup ||
              normalizeCode(v.sku) === dup ||
              (v.barcodes || []).some((b) => normalizeCode(b.code) === dup)
          );
          if (idx >= 0) {
            next[`variant-${idx}`] = be.message;
            const v = (form.variants as VariantWithCodes[])[idx];
            setOpenVariantRows((prev) => ({ ...prev, [`${v.color}|${v.size}`]: true }));
          }
        }
        setCodeErrors(next);
        handleTabChange(tab);
        toast.error(be.message || "This code is already used by another product");
      } else if (be && be.message && be.status && be.status < 500) {
        toast.error(be.message);
      } else {
        toast.error(`Failed to ${mode} product`);
      }
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };
  
  
  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200">
      <form onSubmit={handleSubmit} aria-busy={isLoading}>
       {/* While saving, every field / tab / button in the form is disabled */}
       <fieldset disabled={isLoading} className="min-w-0">
        {/* Tabs Navigation (hidden when there is only one step) */}
        {effectiveValidTabs.length > 1 && (
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 px-2 sm:px-3 md:px-4 pt-2 sm:pt-3 md:pt-4 overflow-x-auto" aria-label="Tabs">
            {[
              {
                key: "content",
                label: "Product Details",
                icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
              },
              {
                key: "variant",
                label: "Product Variant",
                icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
              },
            ].filter((t) => effectiveValidTabs.includes(t.key as TabKey)).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabChange(t.key as TabKey)}
                className={`group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-all duration-200 whitespace-nowrap ${
                  activeTab === t.key
                    ? "text-gray-900 bg-gray-100 border-b-2 border-gray-900"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <svg className={`w-4 h-4 ${activeTab === t.key ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-500'}`}
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
                </svg>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
        )}

        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">

        {/* CONTENT TAB */}
        {activeTab === "content" && (
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Basic Info Section */}
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-2 sm:mb-3 md:mb-4">Basic Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Steel Water Bottle 500 ml"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={slug}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-generated from product name</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative" ref={categoryDropdownRef}>
                    <div
                      className={`flex items-center justify-between w-full rounded-lg border px-3 py-2.5 cursor-pointer transition-all duration-200 ${
                        categoryDropdownOpen
                          ? 'border-gray-900 ring-1 ring-gray-900'
                          : errors.category
                            ? 'border-red-300'
                            : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {form.category ? (
                          <span className="text-sm text-gray-900 truncate">{form.category}</span>
                        ) : (
                          <span className="text-sm text-gray-400">Select a category</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {form.category && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setField("category", "");
                              setField("subCategory", "");
                            }}
                            className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${categoryDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {categoryDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              type="text"
                              placeholder="Search categories..."
                              value={categorySearchQuery}
                              onChange={(e) => setCategorySearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredParentCategories.length > 0 ? (
                            filteredParentCategories.map((cat) => (
                              <div
                                key={cat.id}
                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                  form.category === cat.name
                                    ? 'bg-honey-50 text-gray-900'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                                onClick={() => {
                                  if (form.category !== cat.name) {
                                    setField("category", cat.name);
                                    setField("subCategory", "");
                                  }
                                  setCategoryDropdownOpen(false);
                                  setCategorySearchQuery("");
                                }}
                              >
                                <span className="text-sm flex-1">{cat.name}</span>
                                {form.category === cat.name && (
                                  <svg className="w-4 h-4 text-honey-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center">
                              No categories found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
                </div>

                {form.category && childCategories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subcategory
                    </label>
                    <div className="relative" ref={subCategoryDropdownRef}>
                      <div
                        className={`flex items-center justify-between w-full rounded-lg border px-3 py-2.5 cursor-pointer transition-all duration-200 ${
                          subCategoryDropdownOpen
                            ? 'border-gray-900 ring-1 ring-gray-900'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onClick={() => setSubCategoryDropdownOpen(!subCategoryDropdownOpen)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {form.subCategory ? (
                            <span className="text-sm text-gray-900 truncate">{form.subCategory}</span>
                          ) : (
                            <span className="text-sm text-gray-400">Select a subcategory</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {form.subCategory && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setField("subCategory", "");
                              }}
                              className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
                            >
                              <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${subCategoryDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {subCategoryDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                type="text"
                                placeholder="Search subcategories..."
                                value={subCategorySearchQuery}
                                onChange={(e) => setSubCategorySearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {filteredChildCategories.length > 0 ? (
                              filteredChildCategories.map((cat) => (
                                <div
                                  key={cat.id}
                                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                    form.subCategory === cat.name
                                      ? 'bg-honey-50 text-gray-900'
                                      : 'hover:bg-gray-50 text-gray-700'
                                  }`}
                                  onClick={() => {
                                    setField("subCategory", cat.name);
                                    setSubCategoryDropdownOpen(false);
                                    setSubCategorySearchQuery("");
                                  }}
                                >
                                  <span className="text-sm flex-1">{cat.name}</span>
                                  {form.subCategory === cat.name && (
                                    <svg className="w-4 h-4 text-honey-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                No subcategories found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Pricing Section */}
            <div className="border-t border-gray-200 pt-3 sm:pt-4 md:pt-6">
              <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-2 sm:mb-3 md:mb-4">Pricing & Stock</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {!isVariant && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {pps > 1 ? `Cost price (one sale = ${pps} pieces)` : "Cost Price"} ({currency.symbol}) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{currency.symbol}</span>
                      <NumberMoneyInput
                        placeholder="0.00"
                        disabled={packaging.soldAs === "box"}
                        className={`block w-full rounded-lg border pl-7 pr-3 py-2 text-sm placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors ${errors.costPrice ? 'border-red-300' : 'border-gray-300'} ${packaging.soldAs === "box" ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-900'}`}
                        value={form.costPrice}
                        onNumber={(n) => setField("costPrice", n)}
                      />
                    </div>
                    {errors.costPrice && <p className="mt-1 text-sm text-red-600">{errors.costPrice}</p>}
                    {packaging.soldAs === "box" && <p className="mt-1 text-xs text-gray-500">Set in the Box/pack section below</p>}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {pps > 1 ? `One sale price (${pps} pieces)` : "Sale Price"} ({currency.symbol}) {!isVariant && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{currency.symbol}</span>
                    <NumberMoneyInput
                      disabled={isVariant || packaging.soldAs === "box" || !!priceTier}
                      placeholder="0.00"
                      className={`block w-full rounded-lg border pl-7 pr-3 py-2 text-sm ${
                        isVariant || packaging.soldAs === "box" || !!priceTier
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-300'
                          : errors.discountedPrice ? 'border-red-300 text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900' : 'border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
                      }`}
                      value={isVariant ? undefined : form.discountedPrice}
                      onNumber={(n) => setForm((prev) => ({ ...prev, discountedPrice: n, price: n ?? 0 }))}
                    />
                  </div>
                  {errors.discountedPrice && <p className="mt-1 text-sm text-red-600">{errors.discountedPrice}</p>}
                  {isVariant && <p className="mt-1 text-xs text-gray-500">Set prices per variant</p>}
                  {!isVariant && packaging.soldAs === "box" && <p className="mt-1 text-xs text-gray-500">Set in the Box/pack section below</p>}
                </div>

                {/* Price tiers are not used: the field is hidden. It only loads the tier a
                    product may still be on, so saving unlinks it and the typed price wins. */}
                <div className="hidden" aria-hidden>
                  <PriceTierSelect
                    productId={productId}
                    value={null}
                    isVariant={isVariant}
                    onChange={(tier, initial) => {
                      if (initial) savedTierId.current = tier?._id ?? null;
                    }}
                  />
                </div>

                {noStock ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Quantity <span className="font-normal text-gray-500">(pieces received now)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="e.g. 12"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                    value={receivedPieces}
                    onChange={(e) => setReceivedPieces(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">Goes into the warehouse with this delivery when you save. Empty = enter after saving.</p>
                </div>
                ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Quantity
                  </label>
                  {(() => {
                    // Box / batch mode: stock is calculated in "Packaging & Stock" below
                    const stockLocked = isVariant || computedStock(packaging) !== null;
                    return (
                      <>
                        <input
                          type="number"
                          min="0"
                          disabled={stockLocked}
                          placeholder="0"
                          className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${
                            stockLocked
                              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                              : 'text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
                          }`}
                          value={isVariant ? 0 : form.stock}
                          onChange={(e) => setField("stock", Number(e.target.value))}
                        />
                        {errors.stock && <p className="mt-1 text-sm text-red-600">{errors.stock}</p>}
                        {isVariant && <p className="mt-1 text-xs text-gray-500">Auto-calculated from variants</p>}
                        {!isVariant && stockLocked && (
                          <p className="mt-1 text-xs text-gray-500">
                            {packaging.trackBatches ? "Total of this item's saved batches" : "Calculated from boxes/packs below"}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <SearchSelect
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    value={form.status}
                    onChange={(e) => setField("status", e.target.value as ProductFormData["status"])}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </SearchSelect>
                </div>

                {/* Pieces per sale: here for loose items; box/pack items have it in the Box/pack section */}
                {!isVariant && packaging.soldAs === "loose" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pieces per sale</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className={`block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 ${errors.piecesPerSale ? 'border-red-300' : 'border-gray-300'}`}
                      value={packaging.piecesPerSale}
                      onChange={(e) => updatePackaging({ ...packaging, piecesPerSale: e.target.value })}
                    />
                    {errors.piecesPerSale ? (
                      <p className="mt-1 text-sm text-red-600">{errors.piecesPerSale}</p>
                    ) : (
                      <p className="mt-1 text-xs text-gray-500">{pps > 1 ? `Sold ${pps} together: one scan sells ${pps} pieces` : "1 = one by one. 2 = two sold together"}</p>
                    )}
                  </div>
                )}

              </div>

              {/* SKU (made automatically; the short code behind it is printed on the sticker) */}
              {!isVariant && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                    <input
                      type="text"
                      readOnly
                      className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-600 cursor-not-allowed"
                      value={autoSku || (pickingCode ? "Creating…" : "Created when saved")}
                    />
                  </div>

              </div>
              )}

              {/* Packaging & Stock: boxes, batches, barcodes, short code (single products) */}
              {!isVariant && (
                <div className="mt-3 sm:mt-4 md:mt-6">
                  <PackagingStockCard
                    value={packaging}
                    onChange={updatePackaging}
                    mode={mode}
                    productId={productId}
                    hideStock={noStock}
                    errors={{
                      piecesPerBox: errors.piecesPerBox || "",
                      piecesPerSale: errors.piecesPerSale || "",
                      boxes: errors.boxes || "",
                      batches: errors.batches || codeErrors.batches || "",
                      shortCode: errors.shortCode || codeErrors.shortCode || "",
                      barcodes: codeErrors.barcodes || "",
                    }}
                    currencySymbol={currency.symbol}
                    defaultCostPrice={form.costPrice}
                    savedStock={savedStock}
                    salePrice={form.discountedPrice}
                    costPrice={form.costPrice}
                    onPricesChange={({ salePrice, costPrice }) =>
                      setForm((prev) => ({ ...prev, discountedPrice: salePrice, price: salePrice ?? 0, costPrice }))
                    }
                    priceErrors={{ salePrice: errors.discountedPrice, costPrice: errors.costPrice }}
                  />
                </div>
              )}

              {/* Single Product Images */}
              {!isVariant && (
                <div className="border-t border-gray-200 pt-3 sm:pt-4 md:pt-6 space-y-3 sm:space-y-4 md:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-[110px_1fr] gap-4">
                    {/* Thumbnail */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-medium text-gray-700">
                          Thumbnail <span className="text-gray-400 font-normal">(Optional)</span>
                        </label>
                      </div>
                      <input
                        ref={thumbInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => thumbInputRef.current?.click()}
                        className={`relative w-full aspect-[4/5] rounded-lg border border-dashed transition-colors overflow-hidden group ${
                          errors.thumbnail
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-300 hover:border-gray-900 bg-gray-50 hover:bg-white'
                        }`}
                      >
                        {isValidUrl(form.thumbnailUrl?.toString()) ? (
                          <>
                            <Image
                              src={form.thumbnailUrl!.toString()}
                              alt="Thumbnail"
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Change
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-900 transition-colors">
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs">Upload</span>
                          </div>
                        )}
                      </button>
                      <p className="mt-1 text-[11px] text-gray-400">380 × 480px</p>
                      {errors.thumbnail && <p className="mt-1 text-xs text-red-600">{errors.thumbnail}</p>}
                    </div>

                  </div>

                </div>
              )}

              {/* Date Added (shown only in edit mode) */}
              {mode === "edit" && (initialData as ExtendedProduct)?.createdAt && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Added
                  </label>
                  <input
                    type="text"
                    disabled
                    className="block w-full sm:w-1/3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                    value={new Date((initialData as ExtendedProduct).createdAt!).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-generated when product was created</p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* PRODUCT VARIANT TAB */}
        {activeTab === "variant" && (
          <div className="space-y-3 sm:space-y-4 md:space-y-6">

            {/* Product Type Section */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Product Type</h4>
              {mode === 'edit' && (
                <p className="mb-3 text-xs text-amber-600">
                  {isVariant
                    ? 'Switching to single product will remove all variants'
                    : 'Switching to variant product will require adding color/size variants'}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`relative flex rounded-lg border p-3 transition-all cursor-pointer ${
                  !isVariant
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="productType"
                    value="single"
                    checked={!isVariant}
                    onChange={() => {
                      if (mode === 'edit' && isVariant) {
                        setShowTypeChangeModal({ show: true, targetType: 'single' });
                      } else {
                        setField("productType", "single");
                        setSelectedColors([]);
                        setSelectedSizes([]);
                        setField("variants", []);
                      }
                    }}
                    className="sr-only"
                  />
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3 ${
                      !isVariant ? 'border-gray-900' : 'border-gray-300'
                    }`}>
                      {!isVariant && <div className="w-2 h-2 bg-gray-900 rounded-full" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Single Product</div>
                      <div className="text-xs text-gray-500">One price, one stock level</div>
                    </div>
                  </div>
                </label>
                <label className={`relative flex rounded-lg border p-3 transition-all cursor-pointer ${
                  isVariant
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="productType"
                    value="variant"
                    checked={isVariant}
                    onChange={() => {
                      if (mode === 'edit' && !isVariant) {
                        setShowTypeChangeModal({ show: true, targetType: 'variant' });
                      } else {
                        setField("productType", "variant");
                      }
                    }}
                    className="sr-only"
                  />
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3 ${
                      isVariant ? 'border-gray-900' : 'border-gray-300'
                    }`}>
                      {isVariant && <div className="w-2 h-2 bg-gray-900 rounded-full" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Variant Product</div>
                      <div className="text-xs text-gray-500">Multiple colors & sizes</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Variant Configuration */}
            {isVariant && (
              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Variant Options</h4>
                  <p className="mt-0.5 text-xs text-gray-500">Pick colors, sizes, or both. Phones: pick colors, then set Storage / RAM per variant with the options button.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Colors</label>
                      {onManageAttributes && (
                        <button
                          type="button"
                          onClick={onManageAttributes}
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          Manage
                        </button>
                      )}
                    </div>
                    {/* Select2-style multi-select for colors */}
                    <div className="relative" ref={variantColorDropdownRef}>
                      <div
                        className={`min-h-[42px] flex flex-wrap items-center gap-1.5 w-full rounded-lg border px-2 py-1.5 cursor-pointer transition-all duration-200 ${
                          variantColorDropdownOpen
                            ? 'border-gray-900 ring-1 ring-gray-900'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onClick={() => setVariantColorDropdownOpen(!variantColorDropdownOpen)}
                      >
                        {selectedColors.length > 0 ? (
                          <>
                            {selectedColors.map((color) => (
                              <span
                                key={color}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-honey-100 text-charcoal text-sm rounded-md"
                              >
                                <span
                                  className="w-3 h-3 rounded-full border border-gray-200 flex-shrink-0"
                                  style={{ backgroundColor: color.toLowerCase() }}
                                />
                                {color}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedColors(selectedColors.filter(c => c !== color));
                                  }}
                                  className="hover:text-red-600 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 py-1">Select colors...</span>
                        )}
                        <svg
                          className={`w-5 h-5 text-gray-400 ml-auto flex-shrink-0 transition-transform duration-200 ${variantColorDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Dropdown menu */}
                      {variantColorDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                          {/* Search input */}
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                type="text"
                                placeholder="Search colors..."
                                value={variantColorSearchQuery}
                                onChange={(e) => setVariantColorSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                                autoFocus
                              />
                            </div>
                          </div>

                          {/* Options list */}
                          <div className="max-h-60 overflow-y-auto">
                            {filteredVariantColorOptions.length > 0 ? (
                              filteredVariantColorOptions.map((color) => (
                                <div
                                  key={color}
                                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                    selectedColors.includes(color)
                                      ? 'bg-honey-50 text-gray-900'
                                      : 'hover:bg-gray-50 text-gray-700'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedColors.includes(color)) {
                                      setSelectedColors(selectedColors.filter(c => c !== color));
                                    } else {
                                      setSelectedColors([...selectedColors, color]);
                                    }
                                  }}
                                >
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                    selectedColors.includes(color) ? 'border-honey-500 bg-honey-500' : 'border-gray-300'
                                  }`}>
                                    {selectedColors.includes(color) && (
                                      <svg className="w-3 h-3 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span
                                    className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                                    style={{ backgroundColor: color.toLowerCase() }}
                                  />
                                  <span className="text-sm">{color}</span>
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                No colors found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {errors.colors && <p className="mt-1 text-sm text-red-600">{errors.colors}</p>}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Sizes</label>
                      {onManageAttributes && (
                        <button
                          type="button"
                          onClick={onManageAttributes}
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          Manage
                        </button>
                      )}
                    </div>
                    {/* Select2-style multi-select for sizes */}
                    <div className="relative" ref={variantSizeDropdownRef}>
                      <div
                        className={`min-h-[42px] flex flex-wrap items-center gap-1.5 w-full rounded-lg border px-2 py-1.5 cursor-pointer transition-all duration-200 ${
                          variantSizeDropdownOpen
                            ? 'border-gray-900 ring-1 ring-gray-900'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onClick={() => setVariantSizeDropdownOpen(!variantSizeDropdownOpen)}
                      >
                        {selectedSizes.length > 0 ? (
                          <>
                            {selectedSizes.map((size) => (
                              <span
                                key={size}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-honey-100 text-charcoal text-sm rounded-md"
                              >
                                {size}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSizes(selectedSizes.filter(s => s !== size));
                                  }}
                                  className="hover:text-red-600 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 py-1">Select sizes...</span>
                        )}
                        <svg
                          className={`w-5 h-5 text-gray-400 ml-auto flex-shrink-0 transition-transform duration-200 ${variantSizeDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Dropdown menu */}
                      {variantSizeDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                          {/* Search input */}
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                type="text"
                                placeholder="Search sizes..."
                                value={variantSizeSearchQuery}
                                onChange={(e) => setVariantSizeSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                                autoFocus
                              />
                            </div>
                          </div>

                          {/* Options list */}
                          <div className="max-h-60 overflow-y-auto">
                            {filteredVariantSizeOptions.length > 0 ? (
                              filteredVariantSizeOptions.map((size) => (
                                <div
                                  key={size}
                                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                    selectedSizes.includes(size)
                                      ? 'bg-honey-50 text-gray-900'
                                      : 'hover:bg-gray-50 text-gray-700'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedSizes.includes(size)) {
                                      setSelectedSizes(selectedSizes.filter(s => s !== size));
                                    } else {
                                      setSelectedSizes([...selectedSizes, size]);
                                    }
                                  }}
                                >
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                    selectedSizes.includes(size) ? 'border-honey-500 bg-honey-500' : 'border-gray-300'
                                  }`}>
                                    {selectedSizes.includes(size) && (
                                      <svg className="w-3 h-3 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="text-sm">{size}</span>
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                No sizes found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {errors.sizes && <p className="mt-1 text-sm text-red-600">{errors.sizes}</p>}
                  </div>
                </div>

                {/* Variants Table */}
                {variantCombos.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Variant Pricing & Stock</label>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost ({currency.symbol})</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price ({currency.symbol})</th>
                            {!noStock && <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>}
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Options &amp; Codes</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(form.variants as ProductVariant[] || []).map((variant: ProductVariant, index: number) => {
                            const vc = variant as VariantWithCodes;
                            const rowKey = `${variant.color}|${variant.size}`;
                            const rowOpen = !!openVariantRows[rowKey] || !!codeErrors[`variant-${index}`];
                            const hasBatches = (vc.batches || []).length > 0;
                            const optionText = Object.values(vc.attributes || {}).filter(Boolean).join(" / ");
                            const extraCount = (vc.barcodes || []).filter((b) => b.label !== "full-box").length;
                            return (
                            <React.Fragment key={rowKey}>
                            <tr>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                                {variant.color || <span className="text-gray-400">—</span>}
                                {vc.shortCode && (
                                  <span className="mt-1 flex w-fit items-center gap-0.5 rounded bg-honey-50 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-honey-700">
                                    <Hash className="h-3 w-3" />{vc.shortCode}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{variant.size || <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className="text-xs font-mono text-gray-500">{variant.sku || "Auto"}</span>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <NumberMoneyInput
                                  placeholder="0.00"
                                  value={(variant as any).costPrice}
                                  onNumber={(n) => {
                                    const newVariants = [...(form.variants as ProductVariant[] || [])];
                                    newVariants[index] = { ...variant, costPrice: n } as ProductVariant;
                                    setField("variants", newVariants);
                                  }}
                                  className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                />
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <NumberMoneyInput
                                  value={variant.discountedPrice || undefined}
                                  onNumber={(n) => {
                                    const newVariants = [...(form.variants as ProductVariant[] || [])];
                                    const newDiscountedPrice = n;
                                    newVariants[index] = { ...variant, discountedPrice: newDiscountedPrice, price: newDiscountedPrice ?? 0 };
                                    setField("variants", newVariants);
                                  }}
                                  className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                />
                              </td>
                              {!noStock && <td className="px-3 py-3 whitespace-nowrap">
                                <input
                                  type="number"
                                  min="0"
                                  value={variant.stock || ""}
                                  disabled={hasBatches}
                                  title={hasBatches ? "Stock comes from this variant's batches" : undefined}
                                  onChange={(e) => {
                                    const newVariants = [...(form.variants as ProductVariant[] || [])];
                                    newVariants[index] = { ...variant, stock: Number(e.target.value) };
                                    setField("variants", newVariants);
                                  }}
                                  className={`w-16 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm ${hasBatches ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                                />
                              </td>}
                              <td className="px-3 py-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setOpenVariantRows((prev) => ({ ...prev, [rowKey]: !rowOpen }))}
                                  className={`inline-flex max-w-[180px] items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                                    rowOpen ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <span className="truncate">
                                    {optionText || (extraCount ? `${extraCount} barcode${extraCount > 1 ? 's' : ''}` : 'Add')}
                                  </span>
                                  <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${rowOpen ? 'rotate-180' : ''}`} />
                                </button>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {index === 0 && (form.variants as ProductVariant[] || []).length > 1 && (
                                  <button
                                    type="button"
                                    title="Apply all values to other variants"
                                    onClick={() => {
                                      const firstVariant = (form.variants as ProductVariant[])[0] as any;
                                      const newVariants = (form.variants as ProductVariant[]).map((v) => ({
                                        ...v,
                                        price: firstVariant.price,
                                        costPrice: firstVariant.costPrice,
                                        discountedPrice: firstVariant.discountedPrice,
                                        stock: firstVariant.stock,
                                      }));
                                      setField("variants", newVariants);
                                    }}
                                    className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                                      <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                            {rowOpen && (
                              <VariantCodesRow
                                colSpan={8}
                                variant={vc}
                                productId={productId}
                                error={codeErrors[`variant-${index}`]}
                                otherCodesInForm={((form.variants as VariantWithCodes[]) || [])
                                  .filter((_, i) => i !== index)
                                  .flatMap((o) => [o.shortCode || "", o.sku || "", ...(o.barcodes || []).map((b) => b.code)])
                                  .filter(Boolean)}
                                onChange={(patch) => updateVariantAt(index, patch)}
                              />
                            )}
                            </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Color-specific images for variant products */}
                {selectedColors.length > 0 && (
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Color-Specific Images</h4>
                    {selectedColors.map((color) => (
                      <div key={color} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-700 flex items-center gap-2 text-sm">
                            <span className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: color.toLowerCase() }}></span>
                            {color}
                          </h5>
                          <button
                            type="button"
                            onClick={() => clearColorMedia(color)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Clear all
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[110px_1fr] gap-4">
                          {/* Thumbnail */}
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Thumbnail</label>
                            <input
                              ref={(el) => { colorThumbRefs.current[color] = el; }}
                              type="file"
                              accept="image/*"
                              onChange={(e) => { if (e.target.files) handleColorThumbFiles(color, e.target.files); }}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => colorThumbRefs.current[color]?.click()}
                              className="relative w-full aspect-[4/5] rounded-lg border border-dashed border-gray-300 hover:border-gray-900 bg-gray-50 hover:bg-white transition-colors overflow-hidden group"
                            >
                              {isValidUrl(colorMedia[color]?.thumbnailUrl) ? (
                                <>
                                  <Image src={colorMedia[color].thumbnailUrl!} alt={`${color} thumbnail`} fill className="object-cover" unoptimized />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                    <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Change</span>
                                  </div>
                                </>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-900 transition-colors">
                                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-xs">Upload</span>
                                </div>
                              )}
                            </button>
                            <p className="mt-1 text-[11px] text-gray-400">380 × 480px</p>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        </div>

        {/* Actions */}
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg sm:rounded-b-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
            <p className="text-xs sm:text-sm text-gray-500">
              {isLastTab
                ? (mode === "create" ? "Fill in the details and create your product" : "Update the product information")
                : `Step ${currentTabIndex + 1} of ${effectiveValidTabs.length}: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
            </p>
            <div className="flex items-center gap-2 sm:gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
              )}
              {/* Previous Button */}
              {!isFirstTab && (
                <button
                  type="button"
                  onClick={goToPreviousTab}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
              )}
              {/* Next Button - shown when not on last tab (create mode only) */}
              {!isLastTab && mode === "create" && (
                <button
                  type="button"
                  onClick={goToNextTab}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              {/* Create/Update Button - shown on last tab (create) or every tab (edit) */}
              {(isLastTab || mode === "edit") && (
                <button
                  type="submit"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {mode === "create" ? "Creating product…" : "Updating product…"}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mode === "create" ? "M12 6v6m0 0v6m0-6h6m-6 0H6" : "M5 13l4 4L19 7"} />
                      </svg>
                      {mode === "create" ? "Create Product" : "Update Product"}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
       </fieldset>
      </form>

      {/* Product Type Change Confirmation Modal */}
      {showTypeChangeModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTypeChangeModal({ show: false, targetType: 'single' })}
          />
          <div className="relative bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-md w-full mx-4 p-3 sm:p-4 md:p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {showTypeChangeModal.targetType === 'single' ? 'Switch to Single Product?' : 'Switch to Variant Product?'}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
              {showTypeChangeModal.targetType === 'single'
                ? 'This will permanently remove all color/size variants and their associated images. This action cannot be undone.'
                : 'This will convert the product to a variant product. You will need to add color and size options.'}
            </p>
            <div className="flex gap-2 sm:gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowTypeChangeModal({ show: false, targetType: 'single' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (showTypeChangeModal.targetType === 'single') {
                    setField("productType", "single");
                    setSelectedColors([]);
                    setSelectedSizes([]);
                    setField("variants", []);
                    setColorMedia({});
                  } else {
                    setField("productType", "variant");
                  }
                  setShowTypeChangeModal({ show: false, targetType: 'single' });
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  showTypeChangeModal.targetType === 'single'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {showTypeChangeModal.targetType === 'single' ? 'Yes, Remove Variants' : 'Yes, Switch to Variant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}