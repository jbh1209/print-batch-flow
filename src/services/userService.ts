
import { supabase } from '@/integrations/supabase/client';
import { User, UserFormData, UserProfile, UserRole, UserWithRole } from '@/types/user-types';

// Fetch all users with their roles
export async function fetchUsers(): Promise<UserWithRole[]> {
  try {
    // Get all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at');
      
    if (profilesError) throw profilesError;

    // Get users with emails from auth.users via admin functions
    // We'll use RPC function to safely check if each user is an admin
    const userList: UserWithRole[] = [];
    
    if (profiles) {
      // Process each profile one by one to avoid the RLS recursion
      for (const profile of profiles) {
        // Check if the user is an admin using our security definer function
        const { data: isAdmin, error: adminError } = await supabase
          .rpc('is_admin', { _user_id: profile.id });
          
        if (adminError) {
          console.error('Error checking admin status:', adminError);
        }
        
        // Get the user email if possible
        // For demo purposes, we can leave this empty as it's not critical
        const email = ''; // We could fetch this from auth if needed with admin privileges
        
        userList.push({
          id: profile.id,
          email: email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: isAdmin ? 'admin' : 'user',
          created_at: profile.created_at
        });
      }
    }

    return userList;
  } catch (error) {
    console.error('Error fetching users:', error);
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
    // Sign up the user with Supabase auth but prevent auto sign-in
    const { data, error } = await supabase.auth.signUp({
      email: userData.email!,
      password: userData.password!,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: userData.full_name
        },
        shouldCreateUser: true,
        captchaToken: null
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

// Update user profile
export async function updateUserProfile(userId: string, userData: UserFormData): Promise<void> {
  try {
    if (userData.full_name) {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: userData.full_name })
        .eq('id', userId);
        
      if (error) throw error;
    }
    
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
    // Delete existing role
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
      
    // Insert new role
    const { error } = await supabase
      .from('user_roles')
      .insert([
        { user_id: userId, role }
      ]);
      
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
