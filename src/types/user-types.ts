
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
}
