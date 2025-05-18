
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

// Define user profile type
export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

// Define the auth context type
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
