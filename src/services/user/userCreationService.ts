
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
    
    // Explicitly create profile record with retry mechanism
    let profileCreated = false;
    let retries = 0;
    const maxRetries = 3;
    
    while (!profileCreated && retries < maxRetries) {
      try {
        console.log(`Creating profile for new user (attempt ${retries + 1})`);
        
        // First check if profile already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();
          
        if (existingProfile) {
          console.log('Profile already exists, skipping creation');
          profileCreated = true;
          break;
        }
        
        // Create the profile
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ 
            id: data.user.id, 
            full_name: userData.full_name,
            updated_at: new Date().toISOString()
          });
        
        if (profileError) {
          console.error('Error creating profile:', profileError);
          retries++;
          await new Promise(resolve => setTimeout(resolve, 500 * retries)); // Exponential backoff
        } else {
          profileCreated = true;
        }
      } catch (e) {
        console.error('Exception creating profile:', e);
        retries++;
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
    }
    
    if (!profileCreated) {
      console.warn('Failed to create profile after multiple attempts');
    }
    
    // Assign role if needed
    if (userData.role && userData.role !== 'user') {
      console.log(`Setting user ${data.user.id} role to ${userData.role}`);
      try {
        // Try secured function first with proper typing
        const response = await supabase.rpc('set_user_role_admin', {
          _target_user_id: data.user.id,
          _new_role: userData.role
        }) as unknown as { error: any };
        
        if (response.error) {
          console.error('Error setting role with secure function:', response.error);
          
          // Fall back to regular function with proper typing
          const fallbackResponse = await supabase.rpc('set_user_role', {
            target_user_id: data.user.id,
            new_role: userData.role
          }) as unknown as { error: any };
          
          if (fallbackResponse.error) {
            throw fallbackResponse.error;
          }
        }
      } catch (roleError) {
        console.error('Error setting user role:', roleError);
      }
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
