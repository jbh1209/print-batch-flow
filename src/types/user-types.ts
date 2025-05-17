
export interface UserFormData {
  email: string;
  password?: string;
  full_name?: string;
  role?: 'admin' | 'user';
}

export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  created_at: string;
  last_sign_in_at?: string;
  avatar_url?: string | null;
}

// Add missing types
export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
}
