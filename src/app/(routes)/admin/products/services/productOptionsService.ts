import { colorService } from './colorService';
import { sizeService } from './sizeService';
import { categoryService } from './categoryService';
import { guidelineService, Guideline } from './guidelineService';

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
  guidelines: Guideline[];
}

export async function loadCreateTabData(): Promise<CreateTabData> {
  // Wrap guidelines in try/catch to prevent breaking the whole load if it fails
  const guidelinesPromise = guidelineService.listGuidelines().catch((err) => {
    console.error('Failed to load guidelines:', err);
    return [] as Guideline[];
  });

  const [cats, colors, sizes, guidelines] = await Promise.all([
    categoryService.listCategories(),
    colorService.listColors(),
    sizeService.listSizes(),
    guidelinesPromise,
  ]);
  return {
    categories: (cats as unknown as MinimalCategory[]),
    colorOptions: colors.map((c) => c.name),
    sizeOptions: sizes.map((s) => s.name),
    guidelines: guidelines.filter(g => g.active),
  };
}
