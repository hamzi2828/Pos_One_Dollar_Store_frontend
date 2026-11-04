// Cash drawer: it is plugged into the receipt printer, which opens it when it
// gets the ESC/POS "pulse" command (ESC p 0 25 250). The browser cannot send
// raw bytes, so this goes through the DollarCoPos desktop app's local print
// service (127.0.0.1:47321, the same one sticker printing uses).
// Never throws: no desktop app / no receipt printer just means no drawer.

const AGENT = 'http://127.0.0.1:47321';
const KICK = '\x1bp\x00\x19\xfa';
const RECEIPT_PRINTER = /speedx|sp-?210|xp-?80|pos-?80|80\s?mm|receipt/i;

let cachedPrinter: string | null = null;

const withTimeout = (ms: number) => {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (ctl) setTimeout(() => ctl.abort(), ms);
  return ctl ? { signal: ctl.signal } : {};
};

async function receiptPrinter(): Promise<string | null> {
  if (cachedPrinter) return cachedPrinter;
  const r = await fetch(`${AGENT}/status`, withTimeout(2000));
  const s = await r.json();
  const label = String(s?.printer || '');
  const list: string[] = Array.isArray(s?.printers) ? s.printers : [];
  cachedPrinter = list.find((p) => p !== label && RECEIPT_PRINTER.test(p)) || null;
  return cachedPrinter;
}

export async function openCashDrawer(): Promise<boolean> {
  try {
    const printer = await receiptPrinter();
    if (!printer) return false;
    const r = await fetch(`${AGENT}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: KICK, printer }),
      ...withTimeout(4000),
    });
    if (!r.ok) cachedPrinter = null;
    return r.ok;
  } catch {
    cachedPrinter = null;
    return false;
  }
}
