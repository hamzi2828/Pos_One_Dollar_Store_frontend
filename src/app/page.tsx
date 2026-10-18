import { redirect } from 'next/navigation';

// Admin panel only: the home page goes straight to the POS.
// Middleware sends signed-out visitors on to /authentication.
export default function Home() {
  redirect('/admin/pos');
}
