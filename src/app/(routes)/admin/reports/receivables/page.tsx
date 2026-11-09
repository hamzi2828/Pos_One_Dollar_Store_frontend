// Receivables report removed (owner, 2026-11-09): old links go to the reports list.
import { redirect } from 'next/navigation';

export default function ReceivablesRemoved() {
  redirect('/admin/reports');
}
