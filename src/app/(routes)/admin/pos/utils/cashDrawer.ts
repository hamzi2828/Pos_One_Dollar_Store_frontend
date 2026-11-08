// Cash drawer: it is plugged into the receipt printer, which opens it when it
// gets the ESC/POS "pulse" command (ESC p 0 25 250). The browser cannot send
// raw bytes, so this goes through the DollarCoPos desktop app's local print
// service (127.0.0.1:47321, the same one sticker printing uses).
// Never throws: returns null when the drawer opened, else why it did not.

const AGENT = 'http://127.0.0.1:47321';
const KICK = '\x1bp\x00\x19\xfa';
const RECEIPT_PRINTER = /speedx|sp-?210|xp-?80|xp-?58|pos-?80|pos-?58|80\s?mm|58\s?mm|receipt|thermal|bill/i;
// Windows "printers" that are not real printers.
const NOT_A_PRINTER = /pdf|xps|onenote|fax|anydesk|send to|document writer|snagit|microsoft print|label|sticker/i;

let cachedPrinter: string | null = null;

const withTimeout = (ms: number) => {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (ctl) setTimeout(() => ctl.abort(), ms);
  return ctl ? { signal: ctl.signal } : {};
};

/** The receipt printer by name; else the only real printer that is not the sticker printer. */
export function pickReceiptPrinter(printers: string[], labelPrinter: string): string | null {
  const others = printers.filter((p) => p !== labelPrinter);
  const named = others.find((p) => RECEIPT_PRINTER.test(p));
  if (named) return named;
  // A PC with no sticker printer: the desktop app then calls the receipt
  // printer (e.g. "Xprinter XP-80") its label printer. Its name still says receipt.
  if (labelPrinter && RECEIPT_PRINTER.test(labelPrinter) && printers.includes(labelPrinter)) return labelPrinter;
  const real = others.filter((p) => !NOT_A_PRINTER.test(p));
  return real.length === 1 ? real[0] : null;
}

type AgentStatus = { printer?: string; printers?: string[] };

/**
 * Find the receipt printer through the local print agent (cached).
 * Returns { printer } or { error: 'agent' } (app not running) / { error: 'printer' } (not found).
 */
export async function findReceiptPrinter(): Promise<{ printer: string | null; printers: string[]; error?: 'agent' | 'printer' }> {
  if (cachedPrinter) return { printer: cachedPrinter, printers: [] };
  let status: AgentStatus | null = null;
  try {
    const r = await fetch(`${AGENT}/status`, withTimeout(2500));
    status = await r.json();
  } catch {
    return { printer: null, printers: [], error: 'agent' };
  }
  const printers = Array.isArray(status?.printers) ? status!.printers! : [];
  cachedPrinter = pickReceiptPrinter(printers, String(status?.printer || ''));
  return cachedPrinter ? { printer: cachedPrinter, printers } : { printer: null, printers, error: 'printer' };
}

/** Send raw ESC/POS (a string of Windows-1252 chars) to the receipt printer. Null = sent, else the reason. */
export async function sendRawToReceiptPrinter(data: string): Promise<string | null> {
  const found = await findReceiptPrinter();
  if (found.error === 'agent') return 'DollarCoPos desktop app is not running (or the browser blocked it).';
  if (!found.printer) return `receipt printer not found on this PC (printers: ${found.printers.join(', ') || 'none'}).`;
  try {
    const r = await fetch(`${AGENT}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, printer: found.printer }),
      ...withTimeout(8000),
    });
    if (r.ok) return null;
    const body = await r.json().catch(() => null);
    cachedPrinter = null;
    return `"${found.printer}" did not take the print${body?.error ? ` (${body.error})` : ''}.`;
  } catch {
    cachedPrinter = null;
    return 'no answer from the DollarCoPos desktop app.';
  }
}

export async function openCashDrawer(): Promise<string | null> {
  const found = await findReceiptPrinter();
  if (found.error === 'agent') {
    return 'Cash drawer: DollarCoPos desktop app is not running (or the browser blocked it). Open the POS from the app’s Sales button.';
  }
  if (!found.printer) return `Cash drawer: receipt printer not found on this PC (printers: ${found.printers.join(', ') || 'none'}).`;
  try {
    const r = await fetch(`${AGENT}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: KICK, printer: found.printer }),
      ...withTimeout(5000),
    });
    if (r.ok) return null;
    const body = await r.json().catch(() => null);
    cachedPrinter = null;
    return `Cash drawer: "${found.printer}" did not take the open command${body?.error ? ` (${body.error})` : ''}.`;
  } catch {
    cachedPrinter = null;
    return 'Cash drawer: no answer from the DollarCoPos desktop app.';
  }
}
