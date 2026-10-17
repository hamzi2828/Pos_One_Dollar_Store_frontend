import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
import { getAuthHeader } from "@/helper/helper";
export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export const userService = {
  // Get all users
  async getUsers() {
    try {
      const response = await axios.get(`${API_BASE_URL}/get/allUsers`, {
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
      });
      // Backend returns: { message: string, data: User[] }
      // Normalize to return just the array to consumers
      return response.data?.data ?? [];
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  // Update user status
  async updateUserStatus(userId: string, isActive: boolean) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/update/status/${userId}`,
        { isActive },
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  },

  // Update user role
  async updateUserRole(userId: string, role: string) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/update/role/${userId}`,
        { role },
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  // Delete user
  async deleteUser(userId: string) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/delete/${userId}`, {
        headers: {
          ...getAuthHeader(),
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
};