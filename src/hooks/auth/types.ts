
import { User, Session } from '@supabase/supabase-js';
import { UserProfile } from '@/types/user-types';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  checkIsAdmin: (userId: string) => Promise<boolean>;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}
