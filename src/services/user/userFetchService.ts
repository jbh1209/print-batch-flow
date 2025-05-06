
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, UserRole } from '@/types/user-types';

/**
 * User fetching functions
 */

// Fetch all users with their roles - Completely refactored for reliability
export async function fetchUsers(): Promise<UserWithRole[]> {
  try {
    console.log('Starting fetchUsers in userService');
    
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
      profilesMap.set(profile.id, profile);
    });
    
    // Get auth users from edge function
    const { data: authUsers, error: authError } = await supabase.functions.invoke('get-all-users', {
      method: 'GET',
    });
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw new Error(authError.message || 'Failed to fetch user data');
    }
    
    console.log('Auth users fetched:', authUsers?.length || 0);
    
    // Create a map of auth users by ID
    const authUsersMap = new Map();
    authUsers?.forEach(user => {
      authUsersMap.set(user.id, user);
    });
    
    // Now build the complete user list
    const userList: UserWithRole[] = [];
    
    // Determine the set of all user IDs from both profiles and auth users
    const allUserIds = new Set([
      ...(profiles?.map(p => p.id) || []),
      ...(authUsers?.map(u => u.id) || [])
    ]);
    
    // Process each user ID
    for (const userId of allUserIds) {
      console.log(`Processing user ${userId}`);
      
      const profile = profilesMap.get(userId);
      const authUser = authUsersMap.get(userId);
      
      // Check if user is admin
      const { data: isAdmin, error: adminError } = await supabase
        .rpc('is_admin_secure', { _user_id: userId });
      
      if (adminError) {
        console.error('Error checking admin status:', adminError);
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
    throw error;
  }
}
