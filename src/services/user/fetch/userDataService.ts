
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';
import { transformUserData } from './userDataTransformer';

/**
 * Primary method for fetching users using RPC
 * Only called explicitly from the Users page
 */
export const fetchUsersWithRpc = async (
  abortSignal?: AbortSignal
): Promise<UserWithRole[]> => {
  console.log('Fetching users via RPC - EXPLICIT CALL ONLY');
  
  // The correct way to pass the abortSignal to Supabase RPC call
  const { data, error } = await supabase.rpc(
    'get_all_users_with_roles',
    {},
    { signal: abortSignal }
  );
  
  if (error) {
    console.error('RPC error:', error);
    throw error;
  }
  
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from RPC');
  }
  
  return transformUserData(data);
};

/**
 * Fallback method using edge functions
 * Only called if RPC method fails
 */
export const fetchUsersWithEdgeFunction = async (
  abortSignal?: AbortSignal
): Promise<UserWithRole[]> => {
  console.log('Fetching users via edge function - FALLBACK ONLY');
  
  // Get current session for authentication
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Authentication required to access user data');
  }
  
  const options = {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    signal: abortSignal
  };
  
  const { data, error } = await supabase.functions.invoke('get-all-users', options);
  
  if (error) {
    console.error('Edge function error:', error);
    throw error;
  }
  
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from edge function');
  }
  
  return transformUserData(data);
};

/**
 * Last resort fallback using direct DB queries
 * Only used if both RPC and edge function methods fail
 */
export const fetchUsersWithDirectQueries = async (
  abortSignal?: AbortSignal
): Promise<UserWithRole[]> => {
  console.log('Fetching users via direct queries - LAST RESORT ONLY');
  
  // First get profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .abortSignal(abortSignal);
  
  if (profilesError) {
    throw profilesError;
  }
  
  // Then get roles
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('*')
    .abortSignal(abortSignal);
  
  if (rolesError) {
    throw rolesError;
  }
  
  // Combine data from both sources
  const userMap = new Map();
  
  // Add profiles
  profiles.forEach(profile => {
    userMap.set(profile.id, {
      id: profile.id,
      email: `user-${profile.id.substring(0, 6)}@example.com`,
      full_name: profile.full_name || null,
      avatar_url: profile.avatar_url || null,
      role: 'user',
      created_at: profile.created_at || null,
      last_sign_in_at: null,
    });
  });
  
  // Add roles
  roles.forEach(role => {
    const userId = role.user_id;
    if (userMap.has(userId)) {
      const user = userMap.get(userId);
      user.role = role.role;
    }
  });
  
  return transformUserData(Array.from(userMap.values()));
};
