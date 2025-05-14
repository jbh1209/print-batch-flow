
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
}

// Complete user type with basic information (for authenticated contexts)
export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
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
