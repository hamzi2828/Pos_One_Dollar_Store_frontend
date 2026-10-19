// Price tags while unpacking: POST /products/labels/print (same endpoint and
// print-window handling as the product sticker page).
import toast from 'react-hot-toast';
import {
  STICKER_SIZES,
  errorMessage,
  labelService,
  openPrintWindow,
  printHtmlInHiddenFrame,
  showHtmlInWindow,
  type StickerSize,
} from '@/app/(routes)/admin/products/services/labelService';

export { STICKER_SIZES };
export type { StickerSize };

const SIZE_KEY = 'dollarco.receiving.tagSize';
const DEFAULT_SIZE: StickerSize = '38x25';

/** Remembered tag size (localStorage can throw in private windows). */
export function loadTagSize(): StickerSize {
  try {
    const v = window.localStorage.getItem(SIZE_KEY);
    if (v && STICKER_SIZES.some((s) => s.key === v)) return v as StickerSize;
  } catch {
    /* no storage */
  }
  return DEFAULT_SIZE;
}

export function saveTagSize(size: StickerSize) {
  try {
    window.localStorage.setItem(SIZE_KEY, size);
  } catch {
    /* no storage */
  }
}

/**
 * Print `copies` piece tags of one product. Call straight from the click
 * handler: the print window is opened before any await (popup blockers).
 * Returns true when the tags were sent to a window / the printer.
 */
export async function printTags(t: { productId: string; variantId: string | null; copies: number }, size: StickerSize): Promise<boolean> {
  const copies = Math.max(1, Math.floor(t.copies || 1));
  const w = openPrintWindow();
  try {
    const { html } = await labelService.getStickersHtml(
      [{ productId: t.productId, ...(t.variantId ? { variantId: t.variantId } : {}), type: 'unit', copies }],
      { size, showPrice: true, autoPrint: true },
    );
    if (w && !w.closed) {
      showHtmlInWindow(w, html);
    } else {
      toast('Pop-up blocked. Printing from this page instead.');
      await printHtmlInHiddenFrame(html);
    }
    return true;
  } catch (e) {
    if (w && !w.closed) w.close();
    toast.error(errorMessage(e, 'Could not make the tags.'));
    return false;
  }
}
