'use client';

// Desktop app: download the counter PC installer + setup steps.
// Its own page (last menu item) with its own permission `desktop_download`.
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard } from '@/components/admin/FormBits';
import DesktopAppSettings from '../settings/components/DesktopAppSettings';

export default function DesktopAppPage() {
  const { access, can } = useAccess();
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Desktop app</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Download the counter PC app and set up a new PC.</p>
        </div>
        {!access ? (
          <LoadingCard text="Loading…" />
        ) : !can('desktop_download', 'view') ? (
          <NoAccessCard />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <DesktopAppSettings />
          </div>
        )}
      </div>
    </div>
  );
}
