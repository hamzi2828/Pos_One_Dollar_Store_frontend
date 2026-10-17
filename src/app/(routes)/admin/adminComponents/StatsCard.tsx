import React from 'react';
import { IconType } from 'react-icons';

interface StatsCardProps {
  name: string;
  value: string;
  icon: IconType;
  change: string;
  changeType: 'increase' | 'decrease';
  prefix?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  name,
  value,
  icon: Icon,
  change,
  changeType,
  prefix = ''
}) => {
  return (
    <div className="p-3 sm:p-4 md:p-5 bg-white rounded-lg sm:rounded-xl shadow hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm font-medium text-gray-500">{name}</p>
          <div className="flex items-baseline">
            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">
              {prefix}{value}
            </p>
            <span
              className={`ml-1.5 sm:ml-2 text-xs sm:text-sm font-medium ${
                changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {change}
            </span>
          </div>
        </div>
        <div className="p-2 sm:p-2.5 md:p-3 rounded-full bg-indigo-100 text-indigo-600">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
        </div>
      </div>
    </div>
  );
};