// /admin/purchasing -> the purchase orders list.
import { redirect } from 'next/navigation';

export default function PurchasingIndexPage() {
  redirect('/admin/purchasing/orders');
}
