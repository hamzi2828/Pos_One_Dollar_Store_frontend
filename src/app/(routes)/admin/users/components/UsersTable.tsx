import { FiTrash2 } from 'react-icons/fi';
import type { User, UserRole } from '../types';

type Props = {
  users: User[];
  onRoleUpdate: (userId: string, role: UserRole) => void | Promise<void>;
  onStatusToggle: (userId: string, isActive: boolean) => void | Promise<void>;
  onDelete: (userId: string) => void | Promise<void>;
  formatDate: (iso: string) => string;
  formatLastLogin: (lastLogin?: string | null) => string;
};

export default function UsersTable({
  users,
  onRoleUpdate,
  onStatusToggle,
  onDelete,
  formatDate,
  formatLastLogin,
}: Props) {
  return (
    <div className="overflow-hidden bg-white rounded-md sm:rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                User
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                Role
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                Status
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                Last Login
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                Joined Date
              </th>
              <th className="relative px-3 sm:px-4 md:px-6 py-2 sm:py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 text-center text-xs sm:text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10">
                        <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-white bg-indigo-600 rounded-full">
                          {user.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => onRoleUpdate(user._id, e.target.value as UserRole)}
                      className="text-xs font-medium rounded border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="moderator">Moderator</option>
                    </select>
                  </td>

                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <button
                      onClick={() => onStatusToggle(user._id, !user.isActive)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>

                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                    {formatLastLogin(user.lastLogin)}
                  </td>

                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(user.createdAt)}
                  </td>

                  <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-right whitespace-nowrap">
                    <button
                      onClick={() => onDelete(user._id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete user"
                    >
                      <FiTrash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
