import React from 'react';
import { IconType } from 'react-icons';

interface QuickStat {
  name: string;
  value: string;
  icon: IconType;
  color: string;
}

interface QuickStatsProps {
  stats: QuickStat[];
}

export const QuickStats: React.FC<QuickStatsProps> = ({ stats }) => {
  return (
    <div className="p-2 sm:p-3 bg-white rounded-md sm:rounded-lg shadow">
      <h2 className="mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-semibold tracking-wide uppercase text-gray-500">
        Quick Stats
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 border border-gray-200 rounded-md overflow-hidden divide-x divide-gray-200">
        {stats.map((stat) => (
          <div key={stat.name} className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className={`inline-flex p-1 sm:p-1.5 rounded-full ${stat.color}`}>
                <stat.icon className="w-3 h-3 sm:w-4 sm:h-4" />
              </span>
              <p className="text-[10px] sm:text-xs font-medium text-gray-600 leading-4 truncate">
                {stat.name}
              </p>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-5 ml-1.5 sm:ml-2">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};