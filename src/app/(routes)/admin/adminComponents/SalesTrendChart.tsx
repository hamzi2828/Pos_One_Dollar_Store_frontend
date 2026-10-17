import React from 'react';

interface DataPoint {
  date: string;
  sales?: number;
  orders?: number;
  [key: string]: any;
}

interface SalesTrendChartProps {
  data: DataPoint[];
  title: string;
  dataKey: string;
  color: string;
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  data,
  title,
  dataKey,
  color
}) => {
  const values = data.map(d => d[dataKey] || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);

  const width = 400;
  const height = 120;
  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

  const points = values.map((value, i) => {
    const x = padding + i * stepX;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const pathD = 'M ' + points.join(' L ');
  const areaD = `M ${padding},${height - padding} L ${points.join(' L ')} L ${width - padding},${height - padding} Z`;

  const calculateChange = () => {
    if (values.length < 2) return '0%';
    const lastWeek = values[values.length - 1];
    const previousWeek = values[values.length - 2];
    const change = ((lastWeek - previousWeek) / previousWeek) * 100;
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-white rounded-lg sm:rounded-xl shadow">
      <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
        <h2 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">{title}</h2>
        <span className={`text-xs sm:text-sm font-medium ${
          calculateChange().startsWith('+') ? 'text-green-600' : 'text-red-600'
        }`}>
          {calculateChange()} WoW
        </span>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <path d={areaD} fill={`url(#gradient-${dataKey})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth={2} />

          {values.map((value, i) => {
            const x = padding + i * stepX;
            const y = padding + chartHeight - ((value - min) / range) * chartHeight;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill={color}
                className="hover:r-4 transition-all"
              />
            );
          })}
        </svg>
      </div>

      <div className="mt-1.5 sm:mt-2 flex items-center justify-between text-[10px] sm:text-xs text-gray-500">
        <span>{data.length > 0 ? formatDate(data[0].date) : ''}</span>
        <span className="text-xs sm:text-sm font-semibold text-gray-900">
          {values[values.length - 1]?.toLocaleString() || 0}
        </span>
        <span>{data.length > 0 ? formatDate(data[data.length - 1].date) : ''}</span>
      </div>
    </div>
  );
};