
/**
 * Simple user type definitions without circular references
 */

// Use string literals directly to avoid excessive type nesting
export type UserRole = "admin" | "user";

/**
 * User interface with primitive types from Supabase Auth
 */
export interface User {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
}

/**
 * Form data interface for user creation/editing
 */
export interface UserFormData {
  email?: string;
  full_name?: string;
  password?: string;
  role?: string;
  confirmPassword?: string;
}

/**
 * Simple runtime validation function
 */
export function isValidRole(role: string): boolean {
  return role === "admin" || role === "user";
}
