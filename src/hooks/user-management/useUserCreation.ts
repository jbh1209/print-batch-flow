
import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UserFormData } from '@/types/user-types';
import { Session } from '@supabase/supabase-js';

/**
 * Hook for user creation operations
 */
export function useUserCreation(
  session: Session | null,
  fetchUsers: () => Promise<void>
) {
  // Create a new user
  const createUser = useCallback(async (userData: UserFormData) => {
    try {
      if (!userData.email || !userData.password) {
        throw new Error('Email and password are required');
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      // Create user via edge function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userData.email,
          password: userData.password,
          full_name: userData.full_name,
          role: userData.role || 'user'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('User created successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers, session]);

  return { createUser };
}
