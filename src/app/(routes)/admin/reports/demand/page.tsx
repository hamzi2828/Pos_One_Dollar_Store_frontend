// Demand List now lives in Demand & Trends (owner, 2026-11-09).
import { redirect } from 'next/navigation';

export default function DemandMoved() {
  redirect('/admin/reports/trends?tab=demand');
}
