// One place that prints a receipt for a sale.
// - This counter prints on another counter (Counters page "Receipts print on"):
//   send a print job to the server; that counter's POS prints it.
// - Else: print here as before (iframe + cash drawer).
// The print station side (claim jobs, print them silently) is also here.
import toast from 'react-hot-toast';
import { POSOrder } from '../types';
import { printReceipt } from './receipt';
import { buildEscPosReceipt } from './escposReceipt';
import { sendRawToReceiptPrinter } from './cashDrawer';
import { storeApi, apiErrorMessage } from '@/lib/storeApi';
import { tillApi, type PrintOnCounter } from '@/components/store/TillStatusBar';

export interface PrintJob {
  id: string;
  payload: { order: POSOrder; storeName: string; symbol: string };
  orderNumber: string;
  fromCounterName: string;
  createdAt: string;
}

/** Backend replies are usually { success, data }; accept a bare body too. */
function unwrap<T>(res: unknown): T {
  const r = res as { data?: T } | null;
  return (r && typeof r === 'object' && 'data' in r && r.data !== undefined ? r.data : res) as T;
}

export const printJobsApi = {
  send: async (body: { order: POSOrder; storeName: string; symbol: string }) =>
    unwrap<{ id: string; toCounterName: string }>(await storeApi.post('/print-jobs', body)),
  claim: async () => unwrap<{ job: PrintJob | null }>(await storeApi.post('/print-jobs/claim')),
  done: async (id: string, body: { ok: boolean; error?: string }) => unwrap<{ ok: boolean }>(await storeApi.post(`/print-jobs/${id}/done`, body)),
};

// printOn from the till status, for pages that do not have it (invoice page).
let cachedPrintOn: { value: PrintOnCounter | null; at: number } | null = null;
const PRINT_ON_TTL = 60 * 1000;

export function rememberPrintOn(value: PrintOnCounter | null) {
  cachedPrintOn = { value, at: Date.now() };
}

export async function getPrintOn(): Promise<PrintOnCounter | null> {
  if (cachedPrintOn && Date.now() - cachedPrintOn.at < PRINT_ON_TTL) return cachedPrintOn.value;
  try {
    const res = await tillApi.my();
    const p = res.data?.printOn;
    rememberPrintOn(p?.counterId ? p : null);
  } catch {
    // Unknown (offline): keep the last known value, else print here.
    return cachedPrintOn?.value ?? null;
  }
  return cachedPrintOn?.value ?? null;
}

/**
 * Print a receipt here, or send it to the counter that prints for this one.
 * printOn undefined = look it up from the till status.
 */
export async function printOrDispatchReceipt(order: POSOrder, storeName: string, symbol: string, printOn?: PrintOnCounter | null) {
  const target = printOn === undefined ? await getPrintOn() : printOn;
  if (!target) {
    printReceipt(order, storeName, symbol);
    return;
  }
  // No printer here: never open the print dialog or the drawer.
  try {
    const res = await printJobsApi.send({ order, storeName, symbol });
    toast.success(`Receipt sent to ${res?.toCounterName || target.counterName}'s printer`, { id: `print-${order._id}` });
  } catch (e) {
    toast.error(
      `Receipt not sent to ${target.counterName}: ${apiErrorMessage(e, 'no internet')}. Reprint it from Sales history when the internet is back.`,
      { duration: 9000, id: `print-${order._id}` },
    );
  }
}

/** Print station: print one job from another counter (no cash drawer). */
export async function printRemoteJob(job: PrintJob): Promise<{ ok: boolean; error?: string }> {
  const { order, storeName, symbol } = job.payload || ({} as PrintJob['payload']);
  if (!order) return { ok: false, error: 'Job has no order' };
  const problem = await sendRawToReceiptPrinter(buildEscPosReceipt(order, storeName || 'DOLLAR & Co', symbol || '', job.fromCounterName));
  if (!problem) return { ok: true };
  // Desktop app not reachable: use the browser print dialog instead.
  try {
    printReceipt(order, storeName || 'DOLLAR & Co', symbol || '', { openDrawer: false });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(problem) };
  }
}
