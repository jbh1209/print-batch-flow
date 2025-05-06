
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, UserRole } from '@/types/user-types';

/**
 * User fetching functions
 */

// Fetch all users with their roles - Enhanced with better error handling and fallbacks
export async function fetchUsers(): Promise<UserWithRole[]> {
  try {
    console.log('Starting fetchUsers in userFetchService');
    
    // Get all profiles first for user metadata
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at');
      
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }
    
    console.log('Profiles fetched:', profiles?.length || 0);
    
    // Create a map of profiles by user ID for easy lookup
    const profilesMap = new Map();
    profiles?.forEach(profile => {
      if (profile && profile.id) {
        profilesMap.set(profile.id, profile);
      }
    });
    
    // Get auth users from edge function with better error handling
    let authUsers = [];
    let edgeFunctionError = null;
    
    try {
      console.log('Fetching auth users from edge function');
      const response = await supabase.functions.invoke('get-all-users', {
        method: 'GET',
      });
      
      if (response.error) {
        console.error('Edge function error:', response.error);
        edgeFunctionError = response.error;
      } else {
        authUsers = response.data || [];
        console.log('Auth users fetched successfully:', authUsers?.length || 0);
      }
    } catch (error) {
      console.error('Failed to invoke edge function:', error);
      edgeFunctionError = error;
    }
    
    // If we couldn't get auth users but have profiles, use profiles as fallback
    if ((!authUsers || authUsers.length === 0) && edgeFunctionError && profiles && profiles.length > 0) {
      console.log('Using profiles as fallback since auth users could not be fetched');
      // Just use the profiles we have with limited data
      const userList = profiles.map(profile => {
        return {
          id: profile.id,
          email: 'Email not available', // We don't have access to emails without the auth data
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: 'user' as UserRole, // Default role, will check admin status separately
          created_at: profile.created_at
        };
      });
      
      // Try to determine admin status for each user
      for (const user of userList) {
        try {
          const { data, error } = await supabase.rpc('is_admin_secure', { _user_id: user.id });
          if (!error && data) {
            user.role = 'admin';
          }
        } catch (error) {
          console.error(`Error checking admin status for ${user.id}:`, error);
        }
      }
      
      return userList;
    }
    
    // Create a map of auth users by ID
    const authUsersMap = new Map();
    authUsers?.forEach(user => {
      if (user && user.id) {
        authUsersMap.set(user.id, user);
      }
    });
    
    // Now build the complete user list
    const userList: UserWithRole[] = [];
    
    // Determine the set of all user IDs from both profiles and auth users
    const allUserIds = new Set([
      ...(profiles?.map(p => p?.id).filter(Boolean) || []),
      ...(authUsers?.map(u => u?.id).filter(Boolean) || [])
    ]);
    
    // Process each user ID with improved error handling for role checks
    for (const userId of allUserIds) {
      if (!userId) continue;
      
      console.log(`Processing user ${userId}`);
      
      const profile = profilesMap.get(userId);
      const authUser = authUsersMap.get(userId);
      
      let isAdmin = false;
      try {
        // Check if user is admin
        const { data, error } = await supabase
          .rpc('is_admin_secure', { _user_id: userId });
        
        if (error) {
          console.error('Error checking admin status:', error);
        } else {
          isAdmin = !!data;
        }
      } catch (error) {
        console.error('Exception checking admin status:', error);
      }
      
      // Build user data combining all available information
      userList.push({
        id: userId,
        email: authUser?.email || 'No email',
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        role: (isAdmin ? 'admin' : 'user') as UserRole,
        created_at: profile?.created_at || null
      });
    }
    
    console.log('Final user list built, count:', userList.length);
    return userList;
  } catch (error) {
    console.error('Error in fetchUsers:', error);
    // Return empty array instead of throwing - let the UI handle display
    return [];
  }
}
