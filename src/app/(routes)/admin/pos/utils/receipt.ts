// 72 mm thermal receipt for a POS order (printed through a hidden iframe).
// Shows applied discounts (rules + manual) and gift lines as "FREE — gift".
import { POSOrder } from '../types';
import toast from 'react-hot-toast';
import { openCashDrawer } from './cashDrawer';
import qrcode from 'qrcode-generator';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const orderItemName = (item: POSOrder['items'][number]) =>
  (typeof item.product === 'object' && item.product?.name) || item.name || 'Product';

// Printed on every slip (same as the website's "Visit us" section).
const SHOP = {
  address: 'Nishat Center, Allama Iqbal Road',
  city: 'Mirpur, Azad Kashmir',
  phone: '0314 7000513',
  email: 'dollarandco1@gmail.com',
};

// Google review link printed as a QR code at the top and bottom of every slip.
// Empty = no QR. Get it from Google Business Profile > "Ask for reviews".
export const GOOGLE_REVIEW_URL = '';

/** QR code as an inline SVG (crisp on the thermal printer). */
function reviewQr(sizeMm: number): string {
  if (!GOOGLE_REVIEW_URL) return '';
  const qr = qrcode(0, 'M');
  qr.addData(GOOGLE_REVIEW_URL);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  return `<div class="qr" style="width:${sizeMm}mm;height:${sizeMm}mm">${svg}</div>`;
}

const paymentLabel =(m: string) => (m === 'bank_transfer' ? 'Bank Transfer' : m.charAt(0).toUpperCase() + m.slice(1));

export function buildReceiptHtml(order: POSOrder, storeName: string, symbol: string): string {
  const money = (n: number | undefined) => `${symbol}${(Number(n) || 0).toFixed(2)}`;
  const when = new Date(order.createdAt);
  const date = when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const discounts = (order.appliedDiscounts || []).filter((d) => d.amount > 0);

  // Owner, 2026-11-04: no product names on the slip, only "items x price = sum"
  // (one line per price). Names and barcodes are still saved on the order.
  const byPrice = new Map<number, number>();
  let giftQty = 0;
  for (const item of order.items) {
    const qty = Number(item.quantity) || 0;
    if (item.isGift) giftQty += qty;
    else byPrice.set(Number(item.price) || 0, (byPrice.get(Number(item.price) || 0) || 0) + qty);
  }
  const paidQty = [...byPrice.values()].reduce((s, q) => s + q, 0);
  const items =
    [...byPrice.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([price, qty]) => `<div class="row"><span>${qty} x ${money(price)}</span><span>${money(qty * price)}</span></div>`)
      .join('') +
    (giftQty > 0 ? `<div class="row"><span>${giftQty} x gift</span><span>FREE</span></div>` : '') +
    `<div class="row muted-row"><span>Total items:</span><span>${paidQty + giftQty}</span></div>`;

  const discountRows = discounts.length
    ? discounts.map((d) => `<div class="row"><span>${esc(d.name)}</span><span>-${money(d.amount)}</span></div>`).join('')
    : order.discount > 0
    ? `<div class="row"><span>Discount</span><span>-${money(order.discount)}</span></div>`
    : '';
  const taxRows = (order.appliedTaxes || []).length
    ? (order.appliedTaxes || []).map((t) => `<div class="row"><span>${esc(t.name)} (${t.rate}%)</span><span>${money(t.amount)}</span></div>`).join('')
    : order.tax > 0
    ? `<div class="row"><span>Tax</span><span>${money(order.tax)}</span></div>`
    : '';
  const pending = (order.pendingAmount || 0) > 0
    ? `<div class="row"><span>Paid</span><span>${money(order.paidAmount)}</span></div><div class="row"><b>Pending</b><b>${money(order.pendingAmount)}</b></div>`
    : '';

  // Sale saved on this PC while offline (OFF- number), or an uploaded offline sale.
  const offlineNote = order.offline?.pending
    ? `<div class="block" style="text-align:center;font-weight:bold">Offline sale – will upload automatically</div>`
    : order.offline?.number && order.offline.number !== order.orderNumber
    ? `<div class="block" style="text-align:center">Offline sale · slip ${esc(order.offline.number)}</div>`
    : '';

  return `<!DOCTYPE html><html><head><title>${esc(order.orderNumber)}</title><style>
@page{size:72mm auto;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{width:72mm}body{font-family:'Courier New',monospace;font-size:11px;padding:3mm;background:#fff}
.header{text-align:center;margin-bottom:8px;border-bottom:1px dashed #000;padding-bottom:8px}.store-name{font-size:14px;font-weight:bold}
.block{margin:8px 0;border-bottom:1px dashed #000;padding-bottom:8px}.row{display:flex;justify-content:space-between;margin:2px 0;gap:6px}
.item{margin:4px 0}.item-name{font-weight:bold}.item-details{display:flex;justify-content:space-between;padding-left:8px}
.muted{font-size:10px;color:#555;padding-left:8px}.grand{font-size:13px;font-weight:bold;border-top:1px solid #000;padding-top:4px;margin-top:4px}
.footer{text-align:center;margin-top:10px;padding-top:8px}
.contact{font-size:10px;margin-top:4px;line-height:1.35}.muted-row{font-size:10px;color:#333;margin-top:4px}
.review{text-align:center;font-size:10px;margin-top:6px}.qr{margin:0 auto 3px}.qr svg{width:100%;height:100%;display:block}
.support{font-size:10px;margin-top:8px;padding-top:6px;border-top:1px dashed #000;line-height:1.4}
</style></head><body>
<div class="header"><div class="store-name">${esc(storeName)}</div>
<div class="contact">${esc(SHOP.address)}<br>${esc(SHOP.city)}</div>
<div style="font-size:10px;margin-top:6px">${esc(order.orderNumber)}</div>
${GOOGLE_REVIEW_URL ? `<div class="review">${reviewQr(22)}<div>Scan to review us on Google</div></div>` : ''}</div>
<div class="block">
<div class="row"><span>Date:</span><span>${date} ${time}</span></div>
${order.customer ? `<div class="row"><span>Customer:</span><span>${esc(`${order.customer.firstName} ${order.customer.lastName || ''}`)}</span></div>` : order.customerInfo?.name ? `<div class="row"><span>Customer:</span><span>${esc(order.customerInfo.name)}</span></div>` : ''}
${order.cashier ? `<div class="row"><span>Cashier:</span><span>${esc(order.cashier.firstName)}</span></div>` : ''}
</div>
<div class="block">${items}</div>
<div class="block">
<div class="row"><span>Subtotal:</span><span>${money(order.subtotal)}</span></div>
${discountRows}${taxRows}
<div class="row grand"><span>TOTAL:</span><span>${money(order.total)}</span></div>
</div>
<div class="block">
<div class="row"><span>Payment:</span><span>${esc(paymentLabel(order.paymentMethod))}</span></div>
${order.cashAmount ? `<div class="row"><span>Cash:</span><span>${money(order.cashAmount)}</span></div>` : ''}
${order.changeGiven ? `<div class="row"><span>Change:</span><span>${money(order.changeGiven)}</span></div>` : ''}
${pending}
</div>
${offlineNote}
<div class="footer"><div>Thank you!</div><div>Please come again</div>
${GOOGLE_REVIEW_URL ? `<div class="review" style="margin-top:8px">${reviewQr(32)}<div style="font-weight:bold">Happy with us? Scan &amp; give a Google review</div></div>` : ''}
<div class="support"><div style="font-weight:bold">Customer support</div><div>WhatsApp: ${esc(SHOP.phone)}</div><div>${esc(SHOP.email)}</div></div></div>
</body></html>`;
}

/** Print silently through a hidden iframe (no new tab). */
export function printReceipt(order: POSOrder, storeName: string, symbol: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '80mm';
  iframe.style.height = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(buildReceiptHtml(order, storeName, symbol));
  doc.close();
  // Owner, 2026-11-04: the cash drawer opens with every receipt print.
  void openCashDrawer().then((problem) => {
    if (problem) toast.error(problem, { duration: 8000, id: 'cash-drawer' });
  });
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.parentNode && document.body.removeChild(iframe), 1500);
  }, 150);
}
