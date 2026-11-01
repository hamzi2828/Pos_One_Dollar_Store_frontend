// One PDF from a bill's photos / PDFs: each photo is one A4 page (fit, centred),
// each PDF adds all its pages. Built in the browser, then downloaded.
import { fileUrl } from './purchasingApi';
import { isPdf } from './ui';

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 24;

/** Any image (jpg, png, webp, heic the browser can show) -> JPEG bytes + size, via a canvas. */
async function toJpeg(blob: Blob): Promise<{ bytes: ArrayBuffer; w: number; h: number }> {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
  if (!out) throw new Error('jpeg');
  return { bytes: await out.arrayBuffer(), w: canvas.width, h: canvas.height };
}

/** Builds the PDF and saves it as `<fileName>.pdf`. Returns how many files were skipped (could not be read). */
export async function downloadBillsPdf(files: string[], fileName: string): Promise<{ skipped: number }> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  let skipped = 0;

  for (const f of files) {
    try {
      const res = await fetch(fileUrl(f));
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (isPdf(f, blob.type)) {
        const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
        const pages = await doc.copyPages(src, src.getPageIndices());
        pages.forEach((p) => doc.addPage(p));
      } else {
        const { bytes, w, h } = await toJpeg(blob);
        const img = await doc.embedJpg(bytes);
        // Wide photo -> landscape page.
        const [pw, ph] = w > h ? [A4[1], A4[0]] : A4;
        const scale = Math.min((pw - MARGIN * 2) / w, (ph - MARGIN * 2) / h);
        const dw = w * scale;
        const dh = h * scale;
        doc.addPage([pw, ph]).drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
      }
    } catch {
      skipped++;
    }
  }

  if (doc.getPageCount() === 0) throw new Error('Could not read any of the bill files.');
  const bytes = await doc.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'bills'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { skipped };
}
