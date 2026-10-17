import { redirect } from 'next/navigation';

// This app is the POS admin panel only — there is no public storefront.
// Middleware sends unauthenticated visitors on to /authentication.
export default function Home() {
  redirect('/admin/pos');
}
