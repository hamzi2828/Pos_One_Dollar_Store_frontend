// Strip shown after a sale: print the receipt, open the invoice, WhatsApp slip status.
// Cashiers without sales-history access print their receipt from here.
'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Printer, FileText, X, Loader2 } from 'lucide-react';
import { POSOrder } from '../types';
import { printReceipt } from '../utils/receipt';
import WhatsAppBadge from './WhatsAppBadge';

interface Props {
  order: POSOrder;
  storeName: string;
  symbol: string;
  onClose: () => void;
}

export default function LastSaleBar({ order, storeName, symbol, onClose }: Props) {
  const [printing, setPrinting] = useState(false);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const print = () => {
    if (lock.current) return;
    lock.current = true;
    setPrinting(true);
    printReceipt(order, storeName, symbol);
    timer.current = setTimeout(() => {
      lock.current = false;
      setPrinting(false);
    }, 1500);
  };

  const pending = order.pendingAmount || 0;
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm">
      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
      <span className="font-medium text-green-900">
        Sale #{order.orderNumber} · {symbol}
        {order.total.toFixed(2)}
        {pending > 0 && <span className="text-orange-700"> ({symbol}{pending.toFixed(2)} pending)</span>}
      </span>
      <WhatsAppBadge status={order.whatsappStatus} orderId={order._id} compact />
      <span className="flex-1" />
      <button
        type="button"
        onClick={print}
        disabled={printing}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-800 bg-white border border-green-300 rounded hover:bg-green-100 disabled:opacity-60"
      >
        {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        Print
      </button>
      <a
        href={`/admin/pos/invoice/${order._id}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50"
      >
        <FileText className="h-3.5 w-3.5" />
        Invoice
      </a>
      <button type="button" onClick={onClose} className="p-1 text-green-700 hover:text-green-900" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
