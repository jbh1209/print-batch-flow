
import { useState } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { UserProfile } from '@/types/auth-types';

/**
 * Hook containing state management for authentication
 */
export const useAuthState = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  return {
    user,
    setUser,
    profile,
    setProfile,
    session,
    setSession,
    isAdmin,
    setIsAdmin,
    isLoading,
    setIsLoading
  };
};
