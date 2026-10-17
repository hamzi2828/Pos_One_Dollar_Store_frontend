import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
import { getAuthHeader } from "@/helper/helper";

export interface CategoryDTO {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  thumbnailUrls?: string[];
  bannerUrl?: string;
  active: boolean;
  featured?: boolean;
  parentId?: { _id: string; name: string; slug: string } | string | null;
  children?: CategoryDTO[];
  shippingCost?: number;
  estimatedDays?: string;
  sizeChartRegularCm?: string;
  sizeChartRegularInch?: string;
  sizeChartRelaxedCm?: string;
  sizeChartRelaxedInch?: string;
  measuringTipImage?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  thumbnailUrls?: string[];
  bannerUrl?: string;
  active: boolean;
  featured?: boolean;
  parentId?: string | null;
  shippingCost?: number;
  estimatedDays?: string;
  sizeChartRegularCm?: string;
  sizeChartRegularInch?: string;
  sizeChartRelaxedCm?: string;
  sizeChartRelaxedInch?: string;
  measuringTipImage?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
}

export interface CategoryUI {
  id: string;
  name: string;
  slug: string;
  description: string;
  thumbnailUrl?: string;
  thumbnailUrls: string[];
  bannerUrl?: string;
  active: boolean;
  featured: boolean;
  parentId: string | null;
  parentName: string | null;
  children: CategoryUI[];
  shippingCost: number;
  estimatedDays: string;
  sizeChartRegularCm?: string;
  sizeChartRegularInch?: string;
  sizeChartRelaxedCm?: string;
  sizeChartRelaxedInch?: string;
  measuringTipImage?: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  createdAt?: string;
  updatedAt?: string;
}

// Map backend category to frontend shape used in UI
function mapCategory(dto: CategoryDTO): CategoryUI {
  const absolutize = (url?: string) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const base = (API_BASE_URL || '').replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  };

  // Handle parentId - can be object (populated) or string
  let parentId: string | null = null;
  let parentName: string | null = null;
  if (dto.parentId) {
    if (typeof dto.parentId === 'object' && dto.parentId._id) {
      parentId = dto.parentId._id;
      parentName = dto.parentId.name;
    } else if (typeof dto.parentId === 'string') {
      parentId = dto.parentId;
    }
  }

  const rawThumbnailUrls = Array.isArray(dto.thumbnailUrls) && dto.thumbnailUrls.length > 0
    ? dto.thumbnailUrls
    : (dto.thumbnailUrl ? [dto.thumbnailUrl] : []);
  const thumbnailUrls = rawThumbnailUrls
    .map((u) => absolutize(u))
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  return {
    id: dto._id,
    name: dto.name,
    slug: dto.slug,
    description: dto.description ?? '',
    thumbnailUrl: absolutize(dto.thumbnailUrl),
    thumbnailUrls,
    bannerUrl: absolutize(dto.bannerUrl),
    active: dto.active,
    featured: dto.featured ?? false,
    parentId,
    parentName,
    children: dto.children?.map(child => mapCategory(child)) ?? [],
    shippingCost: dto.shippingCost ?? 0,
    estimatedDays: dto.estimatedDays ?? '',
    sizeChartRegularCm: absolutize(dto.sizeChartRegularCm),
    sizeChartRegularInch: absolutize(dto.sizeChartRegularInch),
    sizeChartRelaxedCm: absolutize(dto.sizeChartRelaxedCm),
    sizeChartRelaxedInch: absolutize(dto.sizeChartRelaxedInch),
    measuringTipImage: absolutize(dto.measuringTipImage),
    metaTitle: dto.metaTitle ?? '',
    metaDescription: dto.metaDescription ?? '',
    metaKeywords: dto.metaKeywords ?? '',
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isCategoryDTO(v: unknown): v is CategoryDTO {
  if (!isObject(v)) return false;
  return typeof v._id === 'string' && typeof v.name === 'string' && typeof v.slug === 'string' && typeof v.active === 'boolean';
}

export const categoryService = {
  // Fetch all categories
  async listCategories(): Promise<Array<ReturnType<typeof mapCategory>>> {
    try {
      const res = await axios.get(`${API_BASE_URL}/categories`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const data = res.data?.data ?? res.data ?? [];
      // If backend returns array of DTOs
      if (Array.isArray(data)) {
        return (data as unknown[])
          .filter((v) => isCategoryDTO(v))
          .map((c) => mapCategory(c as CategoryDTO));
      }
      return [];
    } catch (err) {
      console.error('Error fetching categories:', err);
      throw err;
    }
  },

  // Fetch only parent categories (for dropdown selection)
  async listParentCategories(): Promise<Array<ReturnType<typeof mapCategory>>> {
    try {
      const res = await axios.get(`${API_BASE_URL}/categories?parentOnly=true`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const data = res.data?.data ?? res.data ?? [];
      if (Array.isArray(data)) {
        return (data as unknown[])
          .filter((v) => isCategoryDTO(v))
          .map((c) => mapCategory(c as CategoryDTO));
      }
      return [];
    } catch (err) {
      console.error('Error fetching parent categories:', err);
      throw err;
    }
  },

  // Create a new category
  async createCategory(payload: CategoryInput | FormData): Promise<ReturnType<typeof mapCategory>> {
    try {
      const isFormData = payload instanceof FormData;
      const headers = isFormData 
        ? { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json', ...getAuthHeader() };

      const res = await axios.post(`${API_BASE_URL}/categories`, payload, { headers });
      const created = res.data?.data ?? res.data;
      if (isCategoryDTO(created)) return mapCategory(created);
      throw new Error('Unexpected createCategory response shape');
    } catch (err) {
      console.error('Error creating category:', err);
      throw err;
    }
  },

  // Update an existing category
  async updateCategory(id: string, payload: Partial<CategoryInput> | FormData): Promise<ReturnType<typeof mapCategory>> {
    try {
      const isFormData = payload instanceof FormData;
      const headers = isFormData 
        ? { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json', ...getAuthHeader() };

      const res = await axios.put(`${API_BASE_URL}/categories/${id}`, payload, { headers });
      const updated = res.data?.data ?? res.data;
      if (isCategoryDTO(updated)) return mapCategory(updated);
      throw new Error('Unexpected updateCategory response shape');
    } catch (err) {
      console.error('Error updating category:', err);
      throw err;
    }
  },

  // Delete a category
  async deleteCategory(id: string): Promise<boolean> {
    try {
      await axios.delete(`${API_BASE_URL}/categories/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      return true;
    } catch (err) {
      console.error('Error deleting category:', err);
      throw err;
    }
  },

  // Set active flag (helper around update)
  async setActive(id: string, active: boolean): Promise<ReturnType<typeof mapCategory>> {
    return this.updateCategory(id, { active });
  },

  // Set featured flag (helper around update)
  async setFeatured(id: string, featured: boolean): Promise<ReturnType<typeof mapCategory>> {
    return this.updateCategory(id, { featured });
  },

  // Fetch products belonging to a category + currently featured product ids
  async listCategoryProducts(id: string): Promise<{
    products: Array<{
      _id: string;
      name: string;
      category: string;
      price: number;
      stock: number;
      status: string;
      thumbnailUrl?: string;
    }>;
    featuredProductIds: string[];
  }> {
    try {
      const res = await axios.get(`${API_BASE_URL}/categories/${id}/products`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const data = res.data?.data ?? {};
      const absolutize = (u?: string) => {
        if (!u) return u;
        if (/^https?:\/\//i.test(u)) return u;
        const base = (API_BASE_URL || '').replace(/\/$/, '');
        const path = u.startsWith('/') ? u : `/${u}`;
        return `${base}${path}`;
      };
      const products = Array.isArray(data.products)
        ? data.products.map((p: { thumbnailUrl?: string } & Record<string, unknown>) => ({
            ...p,
            thumbnailUrl: absolutize(p.thumbnailUrl),
          }))
        : [];
      const featuredProductIds = Array.isArray(data.featuredProductIds)
        ? data.featuredProductIds.map((id: unknown) => String(id))
        : [];
      return { products, featuredProductIds };
    } catch (err) {
      console.error('Error fetching category products:', err);
      throw err;
    }
  },

  // Save admin-selected featured products for a category
  async setFeaturedProducts(id: string, productIds: string[]): Promise<boolean> {
    try {
      await axios.put(
        `${API_BASE_URL}/categories/${id}/featured-products`,
        { productIds },
        {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        }
      );
      return true;
    } catch (err) {
      console.error('Error saving featured products:', err);
      throw err;
    }
  },

  // Reorder categories
  async reorderCategories(items: Array<{ _id: string }>): Promise<Array<ReturnType<typeof mapCategory>>> {
    try {
      const res = await axios.put(`${API_BASE_URL}/categories/reorder`, { items }, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const data = res.data?.data ?? res.data ?? [];
      if (Array.isArray(data)) {
        return (data as unknown[])
          .filter((v) => isCategoryDTO(v))
          .map((c) => mapCategory(c as CategoryDTO));
      }
      return [];
    } catch (err) {
      console.error('Error reordering categories:', err);
      throw err;
    }
  },
};
