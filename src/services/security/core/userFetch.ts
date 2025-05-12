
/**
 * User Fetching Core Utilities
 * 
 * Provides secure methods for fetching multiple user records
 * with proper authentication and preview mode support.
 */
import { adminClient } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode } from '@/services/previewService';
import { supabase } from '@/integrations/supabase/client';

/**
 * Secure fetch users implementation with enhanced security and preview mode support
 * Uses multiple fallback strategies for resilience
 */
export async function secureGetAllUsers(): Promise<UserWithRole[]> {
  // In preview mode, return mock data
  if (isPreviewMode()) {
    console.log("Preview mode detected, returning mock users data");
    return [
      {
        id: "preview-admin-1",
        email: "admin@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "admin", 
        full_name: "Preview Admin",
        avatar_url: null
      },
      {
        id: "preview-user-1",
        email: "user@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "user",
        full_name: "Regular User",
        avatar_url: null
      },
      {
        id: "preview-user-2",
        email: "dev@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "user",
        full_name: "Developer User",
        avatar_url: null
      }
    ];
  }
  
  try {
    // Get current session to ensure we have a fresh token
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session?.access_token) {
      throw new Error('Authentication error: Your session has expired. Please log out and log back in.');
    }
    
    // APPROACH 1: Use the functions client with proper headers
    try {
      const { data, error } = await adminClient.functions.invoke('get-all-users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (error) throw error;
      
      if (!data || !Array.isArray(data)) {
        throw new Error("Invalid data format received from functions API");
      }
      
      // Ensure role values are valid
      const typedUsers = data.map((user: any) => ({
        ...user,
        role: validateUserRole(user.role)
      }));
      
      return typedUsers;
    } 
    catch (invocationError) {
      console.error("Function invocation failed:", invocationError);
      
      // APPROACH 2: Direct fetch as fallback with enhanced security headers
      console.log('Falling back to direct fetch');
      const response = await fetch(`https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/get-all-users`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        // Add timeout for the fetch request
        signal: AbortSignal.timeout(8000)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error("Invalid response format from edge function");
      }
      
      // Ensure role values are valid by mapping them to the allowed types
      const typedUsers = data.map((user: any) => ({
        ...user,
        role: validateUserRole(user.role)
      }));
      
      return typedUsers;
    }
  } catch (error: any) {
    console.error('Error in secureGetAllUsers:', error);
    throw error;
  }
}
