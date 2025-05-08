
// Basic user role type using string literals instead of complex enums
export type UserRole = 'admin' | 'user';

// User profile type
export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

// Simple user interface - making email optional to match Supabase's User type
export interface User {
  id: string;
  email?: string; // Changed from required to optional
}

// User with role information
export interface UserWithRole {
  id: string;
  email: string | null; // Allow null to be more flexible
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at?: string;
}

// Form data for creating or updating users
export interface UserFormData {
  email?: string;
  full_name?: string;
  password?: string;
  confirmPassword?: string;
  role?: UserRole;
}
