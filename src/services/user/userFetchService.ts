
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';
import { isPreviewMode, getMockUsers } from '@/services/previewService';

// Cache for users data
let userCache: UserWithRole[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Invalidate the user cache to force a fresh fetch
 */
export const invalidateUserCache = () => {
  userCache = null;
  lastFetchTime = 0;
};

/**
 * Securely get all users with their roles
 * Uses optimistic updates and caching for better performance
 */
export const fetchUsers = async (): Promise<UserWithRole[]> => {
  // Return cached data if available and recent
  const now = Date.now();
  if (userCache && (now - lastFetchTime < CACHE_TTL)) {
    return userCache;
  }
  
  // Use preview mode data if enabled
  if (isPreviewMode()) {
    console.log('Preview mode - using mock user data');
    const mockUsers = getMockUsers();
    userCache = mockUsers;
    lastFetchTime = now;
    return mockUsers;
  }

  try {
    console.log('Fetching users from database...');
    
    // First try to use the RPC function
    try {
      const { data, error } = await supabase.rpc('get_all_users_with_roles');
      
      if (error) {
        console.error('Error with get_all_users_with_roles RPC:', error);
        throw error;
      }
      
      if (data && Array.isArray(data)) {
        userCache = data as UserWithRole[];
        lastFetchTime = now;
        return data as UserWithRole[];
      }
      
      throw new Error('Invalid response data');
    } catch (rpcError) {
      console.error('RPC error, trying direct query:', rpcError);
      
      // Fall back to direct query with manual join
      const { data: users, error: usersError } = await supabase
        .from('auth.users')
        .select(`
          id,
          email,
          created_at,
          last_sign_in_at
        `);
        
      if (usersError) throw usersError;
      
      if (!users) return [];
      
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url');
        
      // Fetch roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');
        
      // Combine data
      const combinedUsers = users.map(user => {
        const profile = profiles?.find(p => p.id === user.id);
        const userRole = roles?.find(r => r.user_id === user.id);
        
        return {
          id: user.id,
          email: user.email,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          role: userRole?.role || 'user',
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
        };
      });
      
      userCache = combinedUsers;
      lastFetchTime = now;
      return combinedUsers;
    }
  } catch (error: any) {
    console.error('Error in secureGetAllUsers:', error);
    throw error;
  }
};
