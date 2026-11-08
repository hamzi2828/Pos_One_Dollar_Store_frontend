// Raw ESC/POS receipt for the 80 mm thermal printer (font A, 48 chars a line).
// Same content and order as buildReceiptHtml (receipt.ts). Used by the print
// station when another counter sends its receipt here. The local print agent
// sends the string as Windows-1252 bytes, so text is kept to plain ASCII.
import { POSOrder } from '../types';
import { GOOGLE_REVIEW_URL, SHOP, paymentLabel } from './receipt';

const WIDTH = 48;

// Byte 0x80-0x9F -> the char that Windows-1252 turns back into that byte.
const CP1252_HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

/** Raw bytes as a string the agent will send unchanged. */
const bytes = (...list: number[]) => list.map((b) => CP1252_HIGH[b] || String.fromCharCode(b & 0xff)).join('');

const ESC = 0x1b;
const GS = 0x1d;
const INIT = bytes(ESC, 0x40);
const LEFT = bytes(ESC, 0x61, 0);
const CENTER = bytes(ESC, 0x61, 1);
const BOLD_ON = bytes(ESC, 0x45, 1);
const BOLD_OFF = bytes(ESC, 0x45, 0);
const DOUBLE = bytes(GS, 0x21, 0x11);
const TALL = bytes(GS, 0x21, 0x01);
const NORMAL = bytes(GS, 0x21, 0x00);
const CUT = bytes(GS, 0x56, 66, 0);

const REPLACE: [RegExp, string][] = [
  [/[—–−]/g, '-'],
  [/×/g, 'x'],
  [/[‘’‚′]/g, "'"],
  [/[“”„″]/g, '"'],
  [/…/g, '...'],
  [/[·•]/g, '-'],
  [/₨/g, 'Rs'],
  [/€/g, 'EUR'],
  [/£/g, 'GBP'],
  [/[    ]/g, ' '],
];

/** Plain ASCII text only (no control chars). */
export function asciiText(v: unknown): string {
  let s = String(v ?? '');
  for (const [re, to] of REPLACE) s = s.replace(re, to);
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return s.replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7e]/g, '?');
}

const line = (text = '') => `${asciiText(text)}\n`;
const dashes = () => `${'-'.repeat(WIDTH)}\n`;

/** Left text and right text on one line (left cut short if needed). */
function row(left: string, right: string): string {
  const l = asciiText(left);
  const r = asciiText(right);
  const room = WIDTH - r.length - 1;
  const leftFit = l.length > room ? l.slice(0, Math.max(0, room)) : l;
  return `${leftFit}${' '.repeat(Math.max(1, WIDTH - leftFit.length - r.length))}${r}\n`;
}

/** QR code (GS ( k), model 2, error level M. */
function qr(data: string, moduleSize: number): string {
  const text = asciiText(data);
  const len = text.length + 3;
  return (
    bytes(GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0) + // model 2
    bytes(GS, 0x28, 0x6b, 3, 0, 49, 67, moduleSize) + // module size
    bytes(GS, 0x28, 0x6b, 3, 0, 49, 69, 49) + // error level M
    bytes(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 49, 80, 48) +
    text +
    bytes(GS, 0x28, 0x6b, 3, 0, 49, 81, 48) // print
  );
}

export function buildEscPosReceipt(order: POSOrder, storeName: string, symbol: string, fromCounterName?: string): string {
  const sym = asciiText(symbol);
  // Same as the HTML slip: symbol + 2 decimals.
  const money = (n: number | undefined) => `${sym}${(Number(n) || 0).toFixed(2)}`;
  const when = new Date(order.createdAt);
  const date = when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const discounts = (order.appliedDiscounts || []).filter((d) => d.amount > 0);

  const byPrice = new Map<number, number>();
  let giftQty = 0;
  for (const item of order.items || []) {
    const qty = Number(item.quantity) || 0;
    if (item.isGift) giftQty += qty;
    else byPrice.set(Number(item.price) || 0, (byPrice.get(Number(item.price) || 0) || 0) + qty);
  }
  const paidQty = [...byPrice.values()].reduce((s, q) => s + q, 0);

  let out = INIT;

  // Header
  out += CENTER + BOLD_ON + DOUBLE + line(storeName) + NORMAL + BOLD_OFF;
  out += line(SHOP.address) + line(SHOP.city);
  out += line(order.orderNumber);
  if (fromCounterName) out += BOLD_ON + line(`From ${fromCounterName}`) + BOLD_OFF;
  if (GOOGLE_REVIEW_URL) out += qr(GOOGLE_REVIEW_URL, 5) + '\n' + line('Scan to review us on Google');
  out += LEFT + dashes();

  // Date / customer / cashier
  out += row('Date:', `${date} ${time}`);
  if (order.customer) out += row('Customer:', `${order.customer.firstName} ${order.customer.lastName || ''}`.trim());
  else if (order.customerInfo?.name) out += row('Customer:', order.customerInfo.name);
  if (order.cashier) out += row('Cashier:', order.cashier.firstName);
  out += dashes();

  // Items: "qty x price = sum", one line per price
  for (const [price, qty] of [...byPrice.entries()].sort((a, b) => b[0] - a[0])) out += row(`${qty} x ${money(price)}`, money(qty * price));
  if (giftQty > 0) out += row(`${giftQty} x gift`, 'FREE');
  out += row('Total items:', String(paidQty + giftQty));
  out += dashes();

  // Totals
  out += row('Subtotal:', money(order.subtotal));
  if (discounts.length) for (const d of discounts) out += row(d.name, `-${money(d.amount)}`);
  else if (order.discount > 0) out += row('Discount', `-${money(order.discount)}`);
  if ((order.appliedTaxes || []).length) for (const t of order.appliedTaxes || []) out += row(`${t.name} (${t.rate}%)`, money(t.amount));
  else if (order.tax > 0) out += row('Tax', money(order.tax));
  out += BOLD_ON + TALL + row('TOTAL:', money(order.total)) + NORMAL + BOLD_OFF;
  out += dashes();

  // Payment
  out += row('Payment:', paymentLabel(order.paymentMethod || ''));
  if (order.cashAmount) out += row('Cash:', money(order.cashAmount));
  if (order.changeGiven) out += row('Change:', money(order.changeGiven));
  if ((order.pendingAmount || 0) > 0) {
    out += row('Paid', money(order.paidAmount));
    out += BOLD_ON + row('Pending', money(order.pendingAmount)) + BOLD_OFF;
  }
  out += dashes();

  if (order.offline?.pending) out += CENTER + BOLD_ON + line('Offline sale - will upload automatically') + BOLD_OFF + LEFT + dashes();
  else if (order.offline?.number && order.offline.number !== order.orderNumber)
    out += CENTER + line(`Offline sale - slip ${order.offline.number}`) + LEFT + dashes();

  // Footer
  out += CENTER + line('Thank you!') + line('Please come again');
  if (GOOGLE_REVIEW_URL) out += '\n' + qr(GOOGLE_REVIEW_URL, 7) + '\n' + BOLD_ON + line('Happy with us? Scan & give a Google review') + BOLD_OFF;
  out += dashes();
  out += BOLD_ON + line('Customer support') + BOLD_OFF;
  out += line(`WhatsApp: ${SHOP.phone}`) + line(SHOP.email);
  out += LEFT + '\n\n\n' + CUT;
  return out;
}
