export type UserRole = 'user' | 'admin' | 'moderator';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Raw user shape coming from backend before mapping to UI-safe User
export interface RawUser {
  _id: string | number;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  lastLogin?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
