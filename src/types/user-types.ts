
// Define AppRole directly as a string literal type
export type AppRole = "admin" | "user";

// Define User interface with primitive types
export interface User {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
}

// Define form data interface for user creation/editing
export interface UserFormData {
  email?: string;
  full_name?: string;
  password?: string;
  role?: AppRole;
}

// Type guard for validating AppRole
export function isValidAppRole(role: string): role is AppRole {
  return role === 'admin' || role === 'user';
}
