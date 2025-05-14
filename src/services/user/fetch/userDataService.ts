
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';
import { transformUserData, combineProfileAndRoleData } from './userDataTransformer';

/**
 * Fetch users using the RPC function
 * @param signal Abort signal for cancellation
 */
export const fetchUsersWithRpc = async (signal: AbortSignal): Promise<UserWithRole[]> => {
  // Check if the request was cancelled
  if (signal.aborted) {
    console.log('User fetch aborted');
    throw new Error('Request aborted');
  }
  
  const { data, error } = await supabase.rpc('get_all_users_with_roles');
  
  if (error) {
    console.error('Error with get_all_users_with_roles RPC:', error);
    throw error;
  }
  
  if (data && Array.isArray(data)) {
    // Transform raw data into properly typed UserWithRole objects
    return transformUserData(data);
  }
  
  throw new Error('Invalid response data');
};

/**
 * Fetch users using the edge function
 * @param signal Abort signal for cancellation
 */
export const fetchUsersWithEdgeFunction = async (signal: AbortSignal): Promise<UserWithRole[]> => {
  // Check if the request was cancelled
  if (signal.aborted) {
    console.log('User fetch aborted');
    throw new Error('Request aborted');
  }
  
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  
  if (!session) {
    throw new Error('Authentication required');
  }
  
  const { data, error } = await supabase.functions.invoke('get-all-users', {
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });
  
  if (error) throw error;
  
  if (data && Array.isArray(data)) {
    return transformUserData(data);
  }
  
  throw new Error('Invalid response data from edge function');
};

/**
 * Fetch users using direct database queries as a last resort
 * @param signal Abort signal for cancellation
 */
export const fetchUsersWithDirectQueries = async (signal: AbortSignal): Promise<UserWithRole[]> => {
  // Check if the request was cancelled
  if (signal.aborted) {
    console.log('User fetch aborted');
    throw new Error('Request aborted');
  }
  
  // Get profiles which are in the public schema
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*');
    
  if (profilesError) throw profilesError;
  
  // Fetch roles
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('*');
    
  if (rolesError) throw rolesError;
  
  if (!profiles) {
    return [];
  }
  
  // Combine data using profiles as the base
  return combineProfileAndRoleData(profiles, roles || []);
};
