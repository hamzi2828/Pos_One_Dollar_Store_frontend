// The Spending report is now Cash in Hand (owner 2026-11-14): old links land there.
import { redirect } from 'next/navigation';

export default function SpendingMoved() {
  redirect('/admin/reports/cash-in-hand');
}
