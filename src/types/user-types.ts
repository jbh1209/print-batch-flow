
/**
 * User Types with Enhanced Security
 * 
 * This module contains the core types for user management with strict validation
 * to ensure consistent security across development and production environments.
 */

// Form data for creating/updating users
export interface UserFormData {
  email: string;
  password: string; // Required for creation
  full_name?: string;
  role?: 'admin' | 'user';
}

// Strictly typed user roles
export type UserRole = 'admin' | 'user';

// Complete user type with role information (for authenticated contexts)
export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_sign_in_at?: string | null;
  avatar_url?: string | null;
}

// Basic user type (for unauthenticated contexts)
export type User = {
  id: string;
  email: string;
  full_name?: string | null;
};

// Define validation functions
export const isValidUserRole = (role: unknown): role is UserRole => {
  return typeof role === 'string' && (role === 'admin' || role === 'user');
};

export const validateUserRole = (role: unknown): UserRole => {
  if (!isValidUserRole(role)) {
    return 'user';
  }
  return role;
};
