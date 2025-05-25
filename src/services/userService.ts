import { supabase } from '@/integrations/supabase/client';
import { User, UserFormData, UserProfile, UserRole, UserWithRole } from '@/types/user-types';

// Simplified user fetching - removed complex RPC calls
export async function fetchUsers(): Promise<UserWithRole[]> {
  try {
    console.log('Fetching users...');
    
    // Get profiles first
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at');
      
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }
    
    console.log('Profiles fetched:', profiles?.length || 0);

    // Get user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');
      
    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      throw rolesError;
    }

    // Create role lookup
    const roleMap = new Map(userRoles?.map(ur => [ur.user_id, ur.role]) || []);

    // Try to get emails from edge function
    try {
      const response = await supabase.functions.invoke('get-all-users', {
        method: 'GET',
      });
      
      if (response.data && Array.isArray(response.data)) {
        const usersMap = Object.fromEntries(
          response.data.map((user) => [user.id, user.email])
        );
        
        const userList: UserWithRole[] = (profiles || []).map(profile => ({
          id: profile.id,
          email: usersMap[profile.id] || 'Email not available',
          full_name: profile.full_name || 'No Name',
          avatar_url: profile.avatar_url,
          role: (roleMap.get(profile.id) || 'user') as UserRole,
          created_at: profile.created_at
        }));
        
        return userList;
      }
    } catch (error) {
      console.log('Edge function failed, returning basic user list');
    }
    
    // Fallback: return profiles with default emails
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
    const { error } = await supabase.rpc('add_admin_role', {
      admin_user_id: userId
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error setting admin role:', error);
    throw error;
  }
}

// Create a new user
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

// Update user profile
export async function updateUserProfile(userId: string, userData: UserFormData): Promise<void> {
  try {
    // Update user's full name in profiles table
    if (userData.full_name !== undefined) {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: userData.full_name })
        .eq('id', userId);
          
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

// Update user role using RPC functions
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  try {
    if (role === 'admin') {
      const { error } = await supabase.rpc('add_admin_role', {
        admin_user_id: userId
      });
      
      if (error) throw error;
    } else {
      // For non-admin roles, remove admin role first then add user role
      await revokeUserAccess(userId);
      
      const { error } = await supabase
        .from('user_roles')
        .insert([
          { user_id: userId, role }
        ]);
        
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

// Assign a role to a user
export async function assignRole(userId: string, role: UserRole): Promise<void> {
  try {
    if (role === 'admin') {
      return addAdminRole(userId);
    }
    
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

// Revoke user role/access
export async function revokeUserAccess(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error revoking user access:', error);
    throw error;
  }
}
