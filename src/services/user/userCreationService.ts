
import { supabase } from '@/integrations/supabase/client';
import { User, UserFormData } from '@/types/user-types';

/**
 * User creation functions
 */

// Create a new user with improved profile creation and error handling
export async function createUser(userData: UserFormData): Promise<User> {
  try {
    if (!userData.email || !userData.password) {
      throw new Error('Email and password are required');
    }
    
    console.log('Creating user with data:', { 
      email: userData.email, 
      full_name: userData.full_name 
    });
    
    // Sign up the user with Supabase auth but prevent auto sign-in
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
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
    
    // Explicitly create profile record immediately (don't wait for trigger)
    try {
      console.log('Creating profile for new user');
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: data.user.id, 
          full_name: userData.full_name,
          updated_at: new Date().toISOString()
        });
      
      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
    } catch (e) {
      console.error('Exception creating profile:', e);
    }
    
    // Double-check with a delay to ensure the profile exists
    setTimeout(async () => {
      try {
        // Verify profile record exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();
          
        if (!existingProfile) {
          console.log('Profile still not found after delay, creating manually');
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ 
              id: data.user.id, 
              full_name: userData.full_name,
              updated_at: new Date().toISOString()
            });
          
          if (profileError) {
            console.error('Error creating profile in retry:', profileError);
          }
        } else {
          console.log('Profile verified to exist');
        }
      } catch (e) {
        console.error('Error in profile verification:', e);
      }
    }, 1500); // Increased timeout to 1.5 seconds for better reliability
    
    // Assign role if needed
    if (userData.role && userData.role !== 'user') {
      console.log(`Setting user ${data.user.id} role to ${userData.role}`);
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
