
import { supabase } from '@/integrations/supabase/client';
import { User, UserFormData, UserProfile, UserRole, UserWithRole } from '@/types/user-types';

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
        .rpc('is_admin_secure_fixed', { _user_id: userId });
      
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

// Check if any admin exists in the system
export async function checkAdminExists(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('any_admin_exists');
    
    if (error) throw error;
    
    return !!data;
  } catch (error) {
    console.error('Error checking admin existence:', error);
    throw error;
  }
}

// Add admin role to a user
export async function addAdminRole(userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('set_user_role', {
      target_user_id: userId, 
      new_role: 'admin'
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error setting admin role:', error);
    throw error;
  }
}

// Create a new user with improved profile creation
export async function createUser(userData: UserFormData): Promise<User> {
  try {
    console.log('Creating user with data:', { 
      email: userData.email, 
      full_name: userData.full_name 
    });
    
    // Sign up the user with Supabase auth but prevent auto sign-in
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
    
    if (error) {
      console.error('Auth signup error:', error);
      throw error;
    }
    
    if (!data.user) {
      throw new Error('User creation failed');
    }
    
    console.log('User created with ID:', data.user.id);
    
    // Explicitly create profile record to ensure name is saved
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: data.user.id, 
        full_name: userData.full_name 
      });
    
    if (profileError) {
      console.error('Error creating profile:', profileError);
    }
    
    // Assign role if needed
    if (userData.role && userData.role !== 'user') {
      await supabase.rpc('set_user_role', {
        target_user_id: data.user.id,
        new_role: userData.role
      });
    }
    
    // Convert Supabase user to our User type
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

// Update user profile - Enhanced for reliability
export async function updateUserProfile(userId: string, userData: UserFormData): Promise<void> {
  try {
    console.log('Updating user profile:', userId, userData);
    
    // Update user's full name in profiles table
    if (userData.full_name !== undefined) {
      console.log(`Updating user ${userId} name to "${userData.full_name}"`);
      
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId,
          full_name: userData.full_name 
        });
          
      if (error) {
        console.error('Error updating profile name:', error);
        throw error;
      }
    }
    
    // Update role if provided
    if (userData.role) {
      console.log(`Updating user ${userId} role to "${userData.role}"`);
      
      const { error } = await supabase.rpc('set_user_role', {
        target_user_id: userId,
        new_role: userData.role
      });
      
      if (error) {
        console.error('Error updating user role:', error);
        throw error;
      }
    }
    
    console.log('User profile updated successfully');
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Update user role
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
    const { error } = await supabase.rpc('set_user_role', {
      target_user_id: userId,
      new_role: role
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error assigning role:', error);
    throw error;
  }
}

// Revoke user role/access
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
