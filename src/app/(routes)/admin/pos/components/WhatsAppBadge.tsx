// WhatsApp slip status of an order (+ optional "Resend" button).
'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageCircle, Loader2, RotateCw } from 'lucide-react';
import { WhatsAppStatus } from '../types';
import { resendOrderWhatsapp } from '../services/posOrderService';

const STYLES: Record<WhatsAppStatus, { label: string; className: string }> = {
  none: { label: 'Not sent', className: 'bg-gray-50 text-gray-500 border-gray-200' },
  queued: { label: 'Queued', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  sent: { label: 'Sent', className: 'bg-green-50 text-green-700 border-green-200' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200' },
  skipped: { label: 'Off', className: 'bg-gray-50 text-gray-500 border-gray-200' },
};

interface Props {
  status?: WhatsAppStatus;
  /** Show only for interesting states and smaller. */
  compact?: boolean;
  /** Order id: shows a Resend button. */
  orderId?: string;
  onStatusChange?: (status: WhatsAppStatus) => void;
}

export default function WhatsAppBadge({ status = 'none', compact = false, orderId, onStatusChange }: Props) {
  const [current, setCurrent] = useState<WhatsAppStatus>(status);
  const [sending, setSending] = useState(false);
  const lock = useRef(false);
  useEffect(() => setCurrent(status), [status]);
  const shown = STYLES[current] ? current : 'none';
  if (compact && !orderId && (shown === 'none' || shown === 'skipped')) return null;

  const resend = async () => {
    if (!orderId || lock.current) return;
    lock.current = true;
    setSending(true);
    try {
      const r = await resendOrderWhatsapp(orderId);
      setCurrent(r.whatsappStatus);
      onStatusChange?.(r.whatsappStatus);
      if (r.queued) toast.success(r.message || 'Slip sent to WhatsApp');
      else toast.error(r.message || 'Slip not sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the slip');
    } finally {
      lock.current = false;
      setSending(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded border font-medium ${compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'} ${STYLES[shown].className}`}
        title={`WhatsApp slip: ${STYLES[shown].label}`}
      >
        <MessageCircle className="h-3 w-3" />
        {compact ? STYLES[shown].label : `WhatsApp: ${STYLES[shown].label}`}
      </span>
      {orderId && (
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          aria-busy={sending}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-green-700 bg-white border border-green-200 rounded hover:bg-green-50 disabled:opacity-60 disabled:cursor-not-allowed"
          title="Send the slip to the WhatsApp group again"
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
          {sending ? 'Sending…' : 'Resend'}
        </button>
      )}
    </span>
  );
}
