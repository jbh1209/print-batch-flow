
import { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}
