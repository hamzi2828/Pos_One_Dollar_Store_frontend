import React from 'react';
import Link from 'next/link';

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface RecentOrdersTableProps {
  orders: Order[];
}

export const RecentOrdersTable: React.FC<RecentOrdersTableProps> = ({ orders = [] }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'shipped':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-white rounded-lg sm:rounded-xl shadow">
      <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
        <h2 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Recent Orders</h2>
        <Link
          href="/admin/orders"
          className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          View All
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                Order ID
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                Customer
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                Status
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                  <Link href={`/admin/orders/${order.id || ''}`} className="hover:text-indigo-600">
                    {order.id || 'N/A'}
                  </Link>
                </td>
                <td className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                  <Link href={`/admin/users/${order.customerId || ''}`} className="hover:text-indigo-600">
                    {order.customerName || 'Unknown'}
                  </Link>
                </td>
                <td className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 text-xs sm:text-sm text-right text-gray-500 whitespace-nowrap">
                  ${(order.amount || 0).toFixed(2)}
                </td>
                <td className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 text-xs sm:text-sm text-center whitespace-nowrap">
                  <span
                    className={`inline-flex px-1.5 sm:px-2 text-[10px] sm:text-xs font-semibold leading-5 rounded-full ${getStatusColor(
                      order.status || 'pending'
                    )}`}
                  >
                    {order.status || 'Pending'}
                  </span>
                </td>
                <td className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 text-xs sm:text-sm text-right text-gray-500 whitespace-nowrap">
                  {order.createdAt ? formatDate(order.createdAt) : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};