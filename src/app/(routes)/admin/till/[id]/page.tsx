'use client';

// One till in full (own tab): till float, sales vs system, discounts, expenses,
// bills and history. Opened from the cash closing report.
import { useParams } from 'next/navigation';
import { SessionDetailModal } from '../components/tillUi';

export default function TillSessionPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  if (!id) return null;
  return <SessionDetailModal id={id} asPage onClose={() => window.close()} />;
}
