'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiMenu, FiX, FiLogOut } from 'react-icons/fi';
import { useCurrency } from '@/context/CurrencyContext';
import { clearAllAuth, getCurrentUser } from '@/helper/helper';
import { useAccess } from '@/context/AccessContext';
import { describeAccess } from '@/helper/access';
import { Building2, ChevronDown, Loader2 } from 'lucide-react';

interface AdminHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function AdminHeader({ isSidebarOpen, onToggleSidebar }: AdminHeaderProps) {
  const { currency } = useCurrency();
  const router = useRouter();
  const { access, isSuperAdmin, branch, branches, currentBranchId, currentBranch, switchBranch } = useAccess();

  const tokenUser = getCurrentUser();
  const firstName = access?.user?.firstName || tokenUser?.firstName || '';
  const lastName = access?.user?.lastName || tokenUser?.lastName || '';
  const displayName = `${firstName} ${lastName}`.trim() || 'Admin';
  const subtitle = describeAccess(access, currentBranch?.name);

  // Sign out / branch switch navigate away (router.replace / full reload), which
  // can take a moment: lock the control and show a spinner until the page goes.
  const [signingOut, setSigningOut] = useState(false);
  const [switchingBranch, setSwitchingBranch] = useState(false);
  const navLockRef = useRef(false);

  const handleLogout = () => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    setSigningOut(true);
    clearAllAuth();
    router.replace('/authentication');
  };

  const handleSwitchBranch = (value: string) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    setSwitchingBranch(true);
    switchBranch(value === 'all' ? null : value);
  };

  return (
    <header className="flex items-center justify-between h-12 sm:h-14 md:h-16 px-3 sm:px-4 bg-white border-b border-gray-200 lg:px-6">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 sm:p-2 text-gray-500 rounded-md lg:hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-honey-500"
        aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isSidebarOpen ? (
          <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <FiMenu className="w-5 h-5 sm:w-6 sm:h-6" />
        )}
      </button>

      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 ml-auto">
        {/* Branch: super admin picks one (or all); staff see their own branch */}
        {access && isSuperAdmin && (
          <label
            className="relative flex items-center gap-1.5 pl-2 pr-1 sm:pl-2.5 py-1 sm:py-1.5 bg-white border border-gray-200 rounded-md sm:rounded-lg hover:border-honey-500/50 transition-colors"
            title="Choose which branch you are working on"
          >
            {switchingBranch ? (
              <Loader2 className="w-4 h-4 text-honey-500 flex-shrink-0 animate-spin" />
            ) : (
              <Building2 className="w-4 h-4 text-honey-500 flex-shrink-0" />
            )}
            <select
              value={currentBranchId || 'all'}
              onChange={(e) => handleSwitchBranch(e.target.value)}
              disabled={switchingBranch || signingOut}
              aria-busy={switchingBranch}
              className="appearance-none bg-transparent pr-5 text-xs sm:text-sm font-medium text-gray-700 focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[200px] truncate disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Branch"
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.isMain ? ' (main)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 w-3.5 h-3.5 text-gray-400" />
          </label>
        )}
        {access && !isSuperAdmin && branch && (
          <span
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-honey-50 border border-honey-500/30 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium text-gray-700"
            title="You work in this branch"
          >
            <Building2 className="w-4 h-4 text-honey-500" />
            <span className="max-w-[110px] sm:max-w-none truncate">{branch.name}</span>
          </span>
        )}

        <Link
          href="/admin/settings"
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-honey-50 border border-honey-500/30 rounded-md sm:rounded-lg hover:bg-honey-100 hover:border-honey-500/50 transition-all duration-200"
          title="Click to change currency"
        >
          <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-honey-500 rounded-full text-white text-xs sm:text-sm font-bold">
            {currency.symbol}
          </span>
          <span className="text-xs sm:text-sm font-medium text-gray-700">{currency.code}</span>
        </Link>

        <div className="flex items-center gap-2" title={`${displayName} — ${subtitle}`}>
          <div
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-honey-500 rounded-full flex-shrink-0 text-white text-xs sm:text-sm font-bold"
            aria-label={displayName}
          >
            {(firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'A'}
          </div>
          <div className="hidden md:block leading-tight min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">{displayName}</p>
            <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{subtitle}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={signingOut || switchingBranch}
          aria-busy={signingOut}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-gray-500 rounded-md sm:rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          title="Sign out"
          aria-label="Sign out"
        >
          {signingOut ? (
            <Loader2 className="w-4 h-4 sm:w-[18px] sm:h-[18px] animate-spin" />
          ) : (
            <FiLogOut className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          )}
          <span className="hidden sm:inline text-xs sm:text-sm font-medium">{signingOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </header>
  );
}
