import React from 'react';

interface CustomerDistributionProps {
  data: {
    new: number;
    returning: number;
    vip: number;
  };
}

export const CustomerDistribution: React.FC<CustomerDistributionProps> = ({ data }) => {
  const total = data.new + data.returning + data.vip;

  const segments = [
    { label: 'New Customers', value: data.new, color: 'bg-blue-500', percentage: (data.new / total) * 100 },
    { label: 'Returning Customers', value: data.returning, color: 'bg-green-500', percentage: (data.returning / total) * 100 },
    { label: 'VIP Customers', value: data.vip, color: 'bg-purple-500', percentage: (data.vip / total) * 100 },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-white rounded-lg sm:rounded-xl shadow">
      <h2 className="mb-2 sm:mb-3 md:mb-4 text-sm sm:text-base md:text-lg font-medium text-gray-900">Customer Distribution</h2>

      <div className="space-y-2 sm:space-y-3 md:space-y-4">
        <div className="flex h-6 sm:h-7 md:h-8 overflow-hidden rounded-full bg-gray-200">
          {segments.map((segment, index) => (
            <div
              key={segment.label}
              className={`${segment.color} transition-all duration-300 hover:opacity-80`}
              style={{ width: `${segment.percentage}%` }}
              title={`${segment.label}: ${segment.value} (${segment.percentage.toFixed(1)}%)`}
            />
          ))}
        </div>

        <div className="space-y-2 sm:space-y-3">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${segment.color}`} />
                <span className="ml-1.5 sm:ml-2 text-xs sm:text-sm text-gray-600">{segment.label}</span>
              </div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-xs sm:text-sm font-semibold text-gray-900">
                  {segment.value.toLocaleString()}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500">
                  ({segment.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 sm:pt-3 md:pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-gray-500">Total Customers</span>
            <span className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">{total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};