
import { useCallback } from 'react';
import { toast } from 'sonner';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateUserCache } from '@/services/user/userFetchService';
import { isPreviewMode, simulateApiCall } from '@/services/previewService';
import { createUser as createUserService } from '@/services/user';

/**
 * Hook for user creation operations with enhanced security
 */
export function useUserCreation(
  fetchUsers: () => Promise<void>,
  setUsers: React.Dispatch<React.SetStateAction<UserWithRole[]>>
) {
  const { session } = useAuth();

  // Create a new user with enhanced security
  const createUser = useCallback(async (userData: UserFormData) => {
    try {
      if (!userData.email || !userData.password) {
        throw new Error('Email and password are required');
      }
      
      if (isPreviewMode()) {
        await simulateApiCall(800, 1200);
        
        // Create mock user for preview
        const newUser: UserWithRole = {
          id: `preview-${Date.now()}`,
          email: userData.email,
          full_name: userData.full_name || null,
          role: userData.role || 'user',
          created_at: new Date().toISOString(),
        };
        
        setUsers(prev => [...prev, newUser]);
        toast.success(`User ${userData.email} created successfully (Preview Mode)`);
        return;
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      // Use the user creation service which calls the edge function
      await createUserService({
        email: userData.email,
        password: userData.password,
        full_name: userData.full_name,
        role: userData.role
      });
      
      toast.success('User created successfully');
      invalidateUserCache();
      await fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers, setUsers, session]);

  return { createUser };
}
