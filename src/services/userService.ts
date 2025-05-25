
import { supabase } from '@/integrations/supabase/client';
import { User, UserFormData, UserProfile, UserRole, UserWithRole } from '@/types/user-types';

// Simplified user fetching with better error handling
export async function fetchUsers(): Promise<UserWithRole[]> {
  try {
    console.log('Fetching users...');
    
    // Get profiles first with error handling
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at');
      
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return [];
    }
    
    console.log('Profiles fetched:', profiles?.length || 0);

    // Get user roles with error handling
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');
      
    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      // Continue without roles instead of failing completely
    }

    // Create role lookup
    const roleMap = new Map(userRoles?.map(ur => [ur.user_id, ur.role]) || []);

    // Return basic user list without edge function dependency
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

// Check if any admin exists using the new secure function
export async function checkAdminExists(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();
    
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

// Add admin role using the new RPC function
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
