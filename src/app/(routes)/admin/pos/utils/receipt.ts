// 72 mm thermal receipt for a POS order (printed through a hidden iframe).
// Shows applied discounts (rules + manual) and gift lines as "FREE — gift".
import { POSOrder } from '../types';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const orderItemName = (item: POSOrder['items'][number]) =>
  (typeof item.product === 'object' && item.product?.name) || 'Product';

const paymentLabel = (m: string) => (m === 'bank_transfer' ? 'Bank Transfer' : m.charAt(0).toUpperCase() + m.slice(1));

export function buildReceiptHtml(order: POSOrder, storeName: string, symbol: string): string {
  const money = (n: number | undefined) => `${symbol}${(Number(n) || 0).toFixed(2)}`;
  const when = new Date(order.createdAt);
  const date = when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const discounts = (order.appliedDiscounts || []).filter((d) => d.amount > 0);

  const items = order.items
    .map((item) => {
      const variant = item.size || item.color ? `<div class="muted">${esc([item.color, item.size].filter(Boolean).join(' / '))}</div>` : '';
      const right = item.isGift
        ? `<span>FREE — gift</span>`
        : `<span>${money(item.quantity * item.price)}</span>`;
      const left = item.isGift ? `${item.quantity} x gift` : `${item.quantity} x ${money(item.price)}`;
      const reason = item.isGift && item.giftReason ? `<div class="muted">Gift: ${esc(item.giftReason)}</div>` : '';
      return `<div class="item"><div class="item-name">${esc(orderItemName(item))}</div>${variant}<div class="item-details"><span>${left}</span>${right}</div>${reason}</div>`;
    })
    .join('');

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

  return `<!DOCTYPE html><html><head><title>${esc(order.orderNumber)}</title><style>
@page{size:72mm auto;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{width:72mm}body{font-family:'Courier New',monospace;font-size:11px;padding:3mm;background:#fff}
.header{text-align:center;margin-bottom:8px;border-bottom:1px dashed #000;padding-bottom:8px}.store-name{font-size:14px;font-weight:bold}
.block{margin:8px 0;border-bottom:1px dashed #000;padding-bottom:8px}.row{display:flex;justify-content:space-between;margin:2px 0;gap:6px}
.item{margin:4px 0}.item-name{font-weight:bold}.item-details{display:flex;justify-content:space-between;padding-left:8px}
.muted{font-size:10px;color:#555;padding-left:8px}.grand{font-size:13px;font-weight:bold;border-top:1px solid #000;padding-top:4px;margin-top:4px}
.footer{text-align:center;margin-top:10px;padding-top:8px}
</style></head><body>
<div class="header"><div class="store-name">${esc(storeName)}</div><div style="font-size:10px;margin-top:4px">${esc(order.orderNumber)}</div></div>
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
<div class="footer"><div>Thank you!</div><div>Please come again</div></div>
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
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.parentNode && document.body.removeChild(iframe), 1500);
  }, 150);
}
