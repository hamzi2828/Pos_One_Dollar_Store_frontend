// src/app/(routes)/admin/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const role = cookieStore.get('auth_role')?.value;

  if (!token) {
    redirect('/authentication');
  }
  if (role !== 'admin') {
    redirect('/authentication');
  }

  return <AdminDashboardClient />;
}
