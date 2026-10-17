import React from 'react';
import { FiShoppingCart, FiUser, FiPackage, FiDollarSign, FiAlertCircle } from 'react-icons/fi';

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'order':
        return FiShoppingCart;
      case 'user':
        return FiUser;
      case 'product':
        return FiPackage;
      case 'payment':
        return FiDollarSign;
      default:
        return FiAlertCircle;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'order':
        return 'bg-blue-100 text-blue-600';
      case 'user':
        return 'bg-green-100 text-green-600';
      case 'product':
        return 'bg-purple-100 text-purple-600';
      case 'payment':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-white rounded-lg sm:rounded-xl shadow">
      <h2 className="mb-2 sm:mb-3 md:mb-4 text-sm sm:text-base md:text-lg font-medium text-gray-900">Recent Activity</h2>
      <div className="space-y-2 sm:space-y-3 md:space-y-4 max-h-96 overflow-y-auto">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          return (
            <div key={activity.id} className="flex items-start hover:bg-gray-50 p-1.5 sm:p-2 rounded">
              <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              </div>
              <div className="ml-2 sm:ml-3 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-900">
                  {activity.description}
                </p>
                {activity.userName && (
                  <p className="text-[10px] sm:text-xs text-gray-500">by {activity.userName}</p>
                )}
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                  {formatTime(activity.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};