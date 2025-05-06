
import { supabase } from '@/integrations/supabase/client';
import { User, UserFormData } from '@/types/user-types';

/**
 * User creation functions
 */

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
