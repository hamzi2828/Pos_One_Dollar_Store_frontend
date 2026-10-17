'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiMenu, FiX, FiLogOut } from 'react-icons/fi';
import { useCurrency } from '@/context/CurrencyContext';
import { clearAllAuth } from '@/helper/helper';

interface AdminHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function AdminHeader({ isSidebarOpen, onToggleSidebar }: AdminHeaderProps) {
  const { currency } = useCurrency();
  const router = useRouter();

  const handleLogout = () => {
    clearAllAuth();
    router.replace('/authentication');
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

        <div className="w-7 h-7 sm:w-8 sm:h-8 overflow-hidden bg-honey-500 rounded-full">
          <Image
            className="object-cover w-full h-full"
            src="https://ui-avatars.com/api/?name=Admin&background=dc2626&color=fff"
            alt="Admin"
            width={32}
            height={32}
          />
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-gray-500 rounded-md sm:rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
          title="Sign out"
          aria-label="Sign out"
        >
          <FiLogOut className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          <span className="hidden sm:inline text-xs sm:text-sm font-medium">Sign out</span>
        </button>
      </div>
    </header>
  );
}
