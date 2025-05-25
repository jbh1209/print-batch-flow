
import { supabase } from '@/integrations/supabase/client';
import { User, UserFormData, UserProfile, UserRole, UserWithRole } from '@/types/user-types';

// Enhanced user fetching with complete data from auth.users
export async function fetchUsers(): Promise<UserWithRole[]> {
  try {
    console.log('Fetching users with complete data...');
    
    // Use the new enhanced function that gets real email addresses
    const { data: completeUsers, error: completeError } = await supabase.rpc('get_all_users_with_complete_data');
    
    if (completeError) {
      console.error('Error fetching complete user data:', completeError);
      return [];
    }
    
    if (completeUsers && completeUsers.length > 0) {
      console.log(`Found ${completeUsers.length} users with complete data`);
      const userList: UserWithRole[] = completeUsers.map(user => ({
        id: user.id,
        email: user.email || 'No email',
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        role: (user.role || 'user') as UserRole,
        created_at: user.created_at
      }));
      
      return userList;
    }
    
    console.log('No users found with complete data function, falling back to profiles method');
    
    // Fallback to profiles method
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at');
      
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return [];
    }
    
    // Get user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');
      
    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
    }

    // Create role lookup
    const roleMap = new Map(userRoles?.map(ur => [ur.user_id, ur.role]) || []);

    // Return basic user list
    const userList: UserWithRole[] = (profiles || []).map(profile => ({
      id: profile.id,
      email: 'Email not available',
      full_name: profile.full_name || 'No Name',
      avatar_url: profile.avatar_url,
      role: (roleMap.get(profile.id) || 'user') as UserRole,
      created_at: profile.created_at
    }));
    
    return userList;
  } catch (error) {
    console.error('Error in fetchUsers:', error);
    return [];
  }
}

// Sync profiles with auth users
export async function syncProfilesWithAuth(): Promise<{ synced_count: number; fixed_count: number }> {
  try {
    const { data, error } = await supabase.rpc('sync_profiles_with_auth');
    
    if (error) {
      console.error('Error syncing profiles:', error);
      throw error;
    }
    
    return data[0] || { synced_count: 0, fixed_count: 0 };
  } catch (error) {
    console.error('Error syncing profiles with auth:', error);
    throw error;
  }
}

// Get admin user statistics
export async function getAdminUserStats(): Promise<{
  total_users: number;
  admin_users: number;
  regular_users: number;
  users_without_profiles: number;
  recent_signups: number;
}> {
  try {
    const { data, error } = await supabase.rpc('get_admin_user_stats');
    
    if (error) {
      console.error('Error getting admin stats:', error);
      throw error;
    }
    
    return data[0] || {
      total_users: 0,
      admin_users: 0,
      regular_users: 0,
      users_without_profiles: 0,
      recent_signups: 0
    };
  } catch (error) {
    console.error('Error getting admin user stats:', error);
    throw error;
  }
}

// Check if any admin exists using the new RPC function
export async function checkAdminExists(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_admin_exists');
    
    if (error) {
      console.error('Error checking admin existence:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Error checking admin existence:', error);
    return false;
  }
}

// Add admin role using the existing RPC function
export async function addAdminRole(userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('add_admin_role', { 
      admin_user_id: userId 
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error setting admin role:', error);
    throw error;
  }
}

// Create a new user with better error handling
export async function createUser(userData: UserFormData): Promise<User> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email!,
      password: userData.password!,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: userData.full_name
        }
      }
    });
    
    if (error) throw error;
    
    if (!data.user) {
      throw new Error('User creation failed');
    }
    
    // Assign role if needed
    if (userData.role && userData.role !== 'user') {
      await assignRole(data.user.id, userData.role);
    }
    
    const userObj: User = {
      id: data.user.id,
      email: data.user.email
    };
    
    return userObj;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// Update user profile using the secure RPC function
export async function updateUserProfile(userId: string, userData: UserFormData): Promise<void> {
  try {
    // Update user's full name using the secure function
    if (userData.full_name !== undefined) {
      const { error } = await supabase.rpc('update_user_profile_admin', {
        _user_id: userId,
        _full_name: userData.full_name
      });
          
      if (error) {
        console.error('Error updating profile name:', error);
        throw error;
      }
    }
    
    // Update role if provided
    if (userData.role) {
      await updateUserRole(userId, userData.role);
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Update user role using the secure RPC function
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  try {
    const { error } = await supabase.rpc('set_user_role', {
      target_user_id: userId,
      new_role: role
    });
        
    if (error) throw error;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

// Assign a role to a user
export async function assignRole(userId: string, role: UserRole): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_roles')
      .insert([
        { user_id: userId, role }
      ]);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error assigning role:', error);
    throw error;
  }
}

// Revoke user role/access using the secure RPC function
export async function revokeUserAccess(userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('revoke_user_role', {
      target_user_id: userId
    });
      
    if (error) throw error;
  } catch (error) {
    console.error('Error revoking user access:', error);
    throw error;
  }
}
