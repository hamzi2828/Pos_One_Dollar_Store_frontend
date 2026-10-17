// /admin/reports → land on Cash in Hand (the primary report).
import { redirect } from 'next/navigation';

export default function ReportsIndex() {
  redirect('/admin/reports/cash-in-hand');
}
