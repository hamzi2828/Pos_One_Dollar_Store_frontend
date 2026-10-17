// Image URL Helper
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * Convert relative image path to full URL
 * @param path - Relative path like '/uploads/image.jpg' or full URL
 * @returns Full image URL
 */
export function getImageUrl(path: string | undefined | null): string | null {
  if (!path) return null;

  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // If it's a relative path, prepend backend URL
  if (path.startsWith('/')) {
    return `${BACKEND_URL}${path}`;
  }

  // Otherwise, prepend with /uploads/
  return `${BACKEND_URL}/uploads/${path}`;
}

interface ProductLike {
  thumbnailUrl?: string;
  bannerUrls?: string[];
  colorMedia?: Record<string, { thumbnailUrl?: string; bannerUrls?: string[] }>;
}

/**
 * Get thumbnail URL from product
 * Priority: thumbnailUrl > first bannerUrl > first colorMedia thumbnail
 */
export function getProductThumbnail(product: ProductLike): string | null {
  // Try thumbnailUrl first
  if (product.thumbnailUrl) {
    return getImageUrl(product.thumbnailUrl);
  }

  // Try first banner
  if (product.bannerUrls && product.bannerUrls.length > 0) {
    return getImageUrl(product.bannerUrls[0]);
  }

  // Try first color media thumbnail
  if (product.colorMedia) {
    const colors = Object.keys(product.colorMedia);
    if (colors.length > 0) {
      const firstColor = colors[0];
      const media = product.colorMedia[firstColor];
      if (media?.thumbnailUrl) {
        return getImageUrl(media.thumbnailUrl);
      }
      if (media?.bannerUrls && media.bannerUrls.length > 0) {
        return getImageUrl(media.bannerUrls[0]);
      }
    }
  }

  return null;
}

/**
 * Get color-specific thumbnail
 */
export function getColorThumbnail(product: ProductLike, color: string): string | null {
  if (!product.colorMedia || !product.colorMedia[color]) {
    return getProductThumbnail(product);
  }

  const colorMedia = product.colorMedia[color];

  if (colorMedia.thumbnailUrl) {
    return getImageUrl(colorMedia.thumbnailUrl);
  }

  if (colorMedia.bannerUrls && colorMedia.bannerUrls.length > 0) {
    return getImageUrl(colorMedia.bannerUrls[0]);
  }

  return getProductThumbnail(product);
}
