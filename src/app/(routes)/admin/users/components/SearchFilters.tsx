import { FiSearch, FiFilter } from 'react-icons/fi';
import type { UserRole } from '../types';

type Props = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  roleFilter: 'all' | UserRole;
  onRoleFilterChange: (value: 'all' | UserRole) => void;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (value: 'all' | 'active' | 'inactive') => void;
};

export default function SearchFilters({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
}: Props) {
  return (
    <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
      <div className="relative flex-1 max-w-md">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <FiSearch className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full py-2 pl-8 sm:pl-10 pr-3 text-xs sm:text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Search users..."
        />
      </div>
      <div className="flex items-center space-x-2">
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value as 'all' | UserRole)}
          className="px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="user">User</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button
          type="button"
          className="flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          title="Filters"
        >
          <FiFilter className="w-4 h-4 mr-1" />
          Filter
        </button>
      </div>
    </div>
  );
}
