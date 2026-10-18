// src/app/(routes)/admin/layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getRole, isAuthenticated } from '@/helper/helper';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { AccessProvider } from '@/context/AccessContext';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('adminSidebarCollapsed', String(next)); } catch {}
      return next;
    });
  };

  // Restore collapsed preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem('adminSidebarCollapsed');
      if (stored === 'true') setSidebarCollapsed(true);
    } catch {}
  }, []);

  // Close sidebar when clicking outside on mobile, and handle resize
  useEffect(() => {
    const handleResize = () => {
      // On desktop (lg breakpoint = 1024px), sidebar is always visible via CSS
      // On mobile, keep the current state
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false); // Reset state on desktop (CSS handles visibility)
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Client-side guard: only allow authenticated admin
  useEffect(() => {
    const authed = isAuthenticated();
    const role = getRole();
    if (!authed) {
      router.replace('/authentication');
      return;
    }
    if (role !== 'admin') {
      router.replace('/authentication');
      return;
    }
    setReady(true);
  }, [router]);

  // Avoid rendering admin UI until checks pass (prevents flicker on redirect)
  if (!ready) return null;

  return (
    <AccessProvider>
    <CurrencyProvider>
      <div className="admin-layout flex h-screen bg-gray-100 overflow-hidden print:block print:h-auto print:overflow-visible print:bg-white">
        <AdminSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapse}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden print:block print:overflow-visible">
          <AdminHeader
            isSidebarOpen={sidebarOpen}
            onToggleSidebar={toggleSidebar}
          />

          <main className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 admin-page-scroll print:overflow-visible print:p-0">
            {children}
          </main>
        </div>
      </div>
    </CurrencyProvider>
    </AccessProvider>
  );
}
