
import { supabase } from '@/integrations/supabase/client';
import { User, UserFormData, UserProfile, UserRole, UserWithRole } from '@/types/user-types';

// Fetch all users with their roles - Simplified to avoid RLS issues
export async function fetchUsers(): Promise<UserWithRole[]> {
  try {
    console.log('Starting fetchUsers in userService');
    
    // Try using the secure RPC call first
    try {
      console.log('Trying to get users with get_all_users_secure RPC');
      const { data: secureUsers, error: secureError } = await supabase
        .rpc('get_all_users_secure');
      
      if (!secureError && secureUsers && secureUsers.length > 0) {
        console.log('Successfully retrieved users with secure RPC function');
        // Map to our expected format
        const userList = await Promise.all(secureUsers.map(async (user) => {
          // Check if user is admin using our safe function
          const { data: isAdminCheck } = await supabase
            .rpc('is_admin', { _user_id: user.id });
          
          const isAdmin = !!isAdminCheck;
          
          // Get profile information
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, created_at')
            .eq('id', user.id)
            .maybeSingle();
          
          return {
            id: user.id,
            email: user.email || 'No email',
            full_name: profile?.full_name || null,
            avatar_url: profile?.avatar_url || null,
            role: (isAdmin ? 'admin' : 'user') as UserRole,
            created_at: profile?.created_at || null
          };
        }));
        
        return userList;
      }
    } catch (error) {
      console.log('Secure RPC failed, falling back to edge function:', error);
    }
    
    // Get all profiles from the profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at');
      
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }
    
    console.log('Profiles fetched:', profiles?.length || 0);

    // Fall back to edge function for auth data
    console.log('Invoking get-all-users edge function');
    try {
      const response = await supabase.functions.invoke('get-all-users', {
        method: 'GET',
      });
      
      if (response.error) {
        console.error('Error fetching user emails:', response.error);
        throw new Error(response.error.message || 'Failed to fetch user data');
      }
      
      const authUsers = response.data;
      console.log('Users from edge function:', authUsers);
      
      if (!Array.isArray(authUsers)) {
        console.error('Invalid users data returned from edge function:', authUsers);
        throw new Error('Failed to fetch user data from authentication system');
      }
      
      // Create a map of user IDs to email addresses
      const usersMap = Object.fromEntries(
        (authUsers || []).map((user) => [user.id, user.email])
      );
      console.log('Users map created with keys:', Object.keys(usersMap).length);
      
      const userList: UserWithRole[] = [];
      
      // If we have no profiles but we have auth users, create minimal user records
      if ((!profiles || profiles.length === 0) && authUsers.length > 0) {
        console.log('No profiles found but auth users exist, creating minimal records');
        for (const authUser of authUsers) {
          // Check admin status using the safe RPC function
          const { data: isAdminCheck } = await supabase
            .rpc('is_admin', { _user_id: authUser.id });
            
          const isAdmin = !!isAdminCheck;
          
          userList.push({
            id: authUser.id,
            email: authUser.email || 'No email',
            full_name: null,
            avatar_url: null,
            role: (isAdmin ? 'admin' : 'user') as UserRole,
            created_at: null
          });
        }
        
        console.log('Created minimal user records:', userList.length);
        return userList;
      }
      
      // Process each profile to build the complete user data
      for (const profile of profiles || []) {
        console.log(`Processing profile ${profile.id}`);
        
        // Check admin status using the safe RPC function
        const { data: isAdminCheck } = await supabase
          .rpc('is_admin', { _user_id: profile.id });
          
        const isAdmin = !!isAdminCheck;
        const email = usersMap[profile.id] || 'Email not available';
        
        userList.push({
          id: profile.id,
          email: email,
          full_name: profile.full_name || 'No Name',
          avatar_url: profile.avatar_url,
          role: (isAdmin ? 'admin' : 'user') as UserRole,
          created_at: profile.created_at
        });
      }
      
      console.log('Final user list built, count:', userList.length);
      return userList;
    } catch (error) {
      console.error('Error fetching users with edge function:', error);
      
      // If everything fails, return current user only
      const currentUser = supabase.auth.getUser();
      if ((await currentUser).data.user) {
        const user = (await currentUser).data.user;
        return [{
          id: user.id,
          email: user.email || 'Current user',
          full_name: 'Current User',
          avatar_url: null,
          role: 'admin' as UserRole,
          created_at: null
        }];
      }
      
      return [];
    }
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
