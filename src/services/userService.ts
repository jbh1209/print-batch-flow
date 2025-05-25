
import { supabase } from '@/integrations/supabase/client';
import { User, UserFormData, UserProfile, UserRole, UserWithRole } from '@/types/user-types';

// Fetch users using the new reliable edge function
export async function fetchUsers(): Promise<UserWithRole[]> {
  try {
    console.log('🔄 Fetching users via edge function...');
    
    const { data, error } = await supabase.functions.invoke('get-users-admin');
    
    if (error) {
      console.error('❌ Edge function error:', error);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
    
    if (!data || !Array.isArray(data)) {
      console.warn('⚠️ Invalid response from edge function:', data);
      return [];
    }
    
    console.log(`✅ Successfully fetched ${data.length} users via edge function`);
    return data;
  } catch (error: any) {
    console.error('❌ Error in fetchUsers:', error);
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
}

// Check if any admin exists
export async function checkAdminExists(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1);
    
    if (error) {
      console.error('Error checking admin existence:', error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking admin existence:', error);
    return false;
  }
}

// Add admin role
export async function addAdminRole(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ 
        user_id: userId, 
        role: 'admin' 
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
    
    return {
      id: data.user.id,
      email: data.user.email
    };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// Update user profile
export async function updateUserProfile(userId: string, userData: UserFormData): Promise<void> {
  try {
    // Update profile if full_name provided
    if (userData.full_name !== undefined) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          full_name: userData.full_name,
          updated_at: new Date().toISOString()
        });
      
      if (profileError) {
        console.error('Error updating profile:', profileError);
        throw profileError;
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

// Update user role
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: role,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

// Assign role to user
export async function assignRole(userId: string, role: UserRole): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role
      });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error assigning role:', error);
    throw error;
  }
}

// Revoke user access (remove from user_roles)
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
