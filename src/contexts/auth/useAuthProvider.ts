
import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from './types';
import { isPreviewMode } from '@/services/core/previewService';

export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile data from the database
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error("Unexpected error fetching profile:", error);
      return null;
    }
  }, []);

  // Refresh the user profile data
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    
    if (isPreviewMode()) {
      // Use mock data in preview mode
      setProfile({
        id: user.id,
        full_name: 'Preview User',
        avatar_url: null
      });
      return;
    }

    try {
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  }, [user, fetchProfile]);

  // Sign out the user
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, []);

  // Refresh the session
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      setSession(data.session);
      setUser(data.session?.user ?? null);
      return data.session;
    } catch (error) {
      console.error("Error refreshing session:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST (to prevent missing events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Load the profile when the user changes
  useEffect(() => {
    if (user) {
      refreshProfile();
    }
  }, [user, refreshProfile]);

  return {
    user,
    profile,
    session,
    isLoading,
    signOut,
    refreshProfile,
    refreshSession,
  };
}
