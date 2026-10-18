// Printable daily damage list (opens a print window with barcodes from the API).
import { formatRs } from '@/lib/storeApi';
import { reasonLabel, type DamageDay } from '../../movements/_shared/stockOpsApi';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const time = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });

export function printDamageList(day: DamageDay) {
  const rows = day.rows
    .map(
      (r) => `<tr class="${r.status === 'rejected' ? 'rej' : ''}">
        <td class="bc">${r.barcodeSvg || ''}</td>
        <td><b>${esc(r.productName)}</b>${r.variantLabel ? `<br><small>${esc(r.variantLabel)}</small>` : ''}<br><small>${esc(r.damageNo)} · ${time(r.date)}</small></td>
        <td class="n">${r.qty}</td>
        <td>${esc(r.location === 'shelf' ? r.shelfCode || 'Shelf' : 'Warehouse')}</td>
        <td>${esc(reasonLabel(r.reason))}${r.description ? `<br><small>${esc(r.description)}</small>` : ''}</td>
        <td class="n">${esc(formatRs(r.unitCost, { decimals: 2 }))}</td>
        <td class="n"><b>${esc(formatRs(r.totalLoss, { decimals: 2 }))}</b></td>
        <td>${esc(r.vendorName)}${r.claimable ? '<br><small>claim</small>' : ''}</td>
        <td>${esc(r.status)}<br><small>${esc(r.reportedByName)}</small></td>
      </tr>`
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Damage list ${esc(day.date)}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;font-size:11px;margin:16px;color:#111}
    h1{font-size:16px;margin:0 0 2px} p{margin:0 0 10px;color:#555}
    table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:4px 5px;vertical-align:top;text-align:left}
    th{background:#f3f3f3;font-size:10px;text-transform:uppercase} td.n{text-align:right;white-space:nowrap}
    td.bc{width:150px} td.bc svg{width:150px;height:44px;display:block}
    tr.rej{color:#999;text-decoration:line-through} small{color:#666}
    tfoot td{font-weight:bold;background:#fafafa}
    @media print{body{margin:6mm}}
  </style></head><body>
  <h1>Daily damage list — ${esc(day.date)}</h1>
  <p>${day.totals.reports} report(s) · ${day.totals.pieces} piece(s) · loss at cost ${esc(formatRs(day.totals.loss, { decimals: 2 }))}${day.totals.rejected ? ` · ${day.totals.rejected} rejected (not counted)` : ''}</p>
  <table><thead><tr><th>Barcode</th><th>Item</th><th>Qty</th><th>Where</th><th>Reason</th><th>Unit cost</th><th>Loss</th><th>Vendor</th><th>Status</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="9">No damage reported on this day.</td></tr>'}</tbody>
  <tfoot><tr><td colspan="2">Total (not rejected)</td><td class="n">${day.totals.pieces}</td><td colspan="3"></td><td class="n">${esc(formatRs(day.totals.loss, { decimals: 2 }))}</td><td colspan="2"></td></tr></tfoot>
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
  </body></html>`;
  const w = window.open('', '_blank', 'width=1000,height=800');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
