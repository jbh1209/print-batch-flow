
// Types for the user system

// Basic user type
export interface User {
  id: string;
  email?: string;
}

// User profile information
export interface UserProfile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Available user roles
export type UserRole = 'admin' | 'user';

// Combined user with role information
export interface UserWithRole {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  created_at: string;
}

// Form data for user creation/editing
export interface UserFormData {
  email?: string;
  password?: string;
  full_name?: string;
  role?: UserRole;
}
