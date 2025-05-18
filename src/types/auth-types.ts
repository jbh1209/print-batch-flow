
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface AuthContextType {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}
