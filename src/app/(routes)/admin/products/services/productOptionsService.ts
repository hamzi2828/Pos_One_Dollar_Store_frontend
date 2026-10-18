import { colorService } from './colorService';
import { sizeService } from './sizeService';
import { categoryService } from './categoryService';

export interface AttributeOptions {
  colorOptions: string[];
  sizeOptions: string[];
}

export async function loadAttributes(): Promise<AttributeOptions> {
  const [colors, sizes] = await Promise.all([
    colorService.listColors(),
    sizeService.listSizes(),
  ]);
  return {
    colorOptions: colors.map((c) => c.name),
    sizeOptions: sizes.map((s) => s.name),
  };
}

// Minimal category shape needed by UI; matches the mapped output of categoryService
export interface MinimalCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
}

export interface CreateTabData extends AttributeOptions {
  categories: MinimalCategory[];
}

export async function loadCreateTabData(): Promise<CreateTabData> {
  const [cats, colors, sizes] = await Promise.all([
    categoryService.listCategories(),
    colorService.listColors(),
    sizeService.listSizes(),
  ]);
  return {
    categories: (cats as unknown as MinimalCategory[]),
    colorOptions: colors.map((c) => c.name),
    sizeOptions: sizes.map((s) => s.name),
  };
}
