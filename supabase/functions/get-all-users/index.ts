
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

// Enhanced CORS headers with proper security
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept",
  "Access-Control-Max-Age": "86400" // 24 hours cache for preflight requests
};

// Helper function to generate detailed error responses
const createErrorResponse = (status: number, message: string, details?: any) => {
  return new Response(
    JSON.stringify({ 
      error: message, 
      details: details,
      timestamp: new Date().toISOString(),
    }),
    { 
      status, 
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-store" 
      } 
    }
  );
};

// Enhanced preview mode detection for edge functions
const isPreviewMode = (url: string, headers: Headers): boolean => {
  // Check URL patterns associated with preview environments
  const urlCheck = url.includes('lovable.dev') || 
                  url.includes('gpteng.co') || 
                  url.includes('localhost');
  
  // Check headers that might indicate preview environments
  const headerCheck = headers.get('x-lovable-preview') === 'true' || 
                     headers.get('origin')?.includes('lovable.dev') || 
                     headers.get('origin')?.includes('gpteng.co');
  
  return urlCheck || headerCheck;
};

// Secure role validation
const validateRole = (role: any): string => {
  if (role === 'admin' || role === 'user') {
    return role;
  }
  // Default to 'user' for any invalid role values
  console.log(`Invalid role value detected: "${role}", defaulting to "user"`);
  return 'user';
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  console.log("Starting get-all-users function");
  
  try {
    // Check if in preview mode and return mock data if needed
    if (isPreviewMode(req.url, req.headers)) {
      console.log("Preview mode detected, returning mock data");
      const mockUsers = [
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
      
      return new Response(JSON.stringify(mockUsers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Get auth token from request and validate it
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse(401, 'Authentication required: Missing or invalid authorization header');
    }
    
    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with the user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );
    
    // Verify the token by getting the user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return createErrorResponse(401, 'Authentication failed: Invalid or expired token', userError?.message);
    }
    
    console.log(`User ${user.id} authenticated successfully`);
    
    // Use the RPC function to get all users with roles
    const { data, error } = await supabaseClient.rpc('get_all_users_with_roles');
    
    if (error) {
      console.error("Error calling get_all_users_with_roles:", error);
      
      // Fallback to separate queries if RPC fails
      console.log("Falling back to separate queries");
      
      // Get user profiles
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('id, full_name, avatar_url');
      
      if (profilesError) {
        return createErrorResponse(500, 'Error fetching user profiles', profilesError.message);
      }
      
      // Get user roles
      const { data: roles, error: rolesError } = await supabaseClient
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) {
        return createErrorResponse(500, 'Error fetching user roles', rolesError.message);
      }
      
      // Create a map of user IDs to roles
      const roleMap = new Map();
      roles.forEach((r: any) => {
        roleMap.set(r.user_id, r.role);
      });
      
      // Get auth users (requires admin client)
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          }
        }
      );
      
      // Call a secure function to get user emails
      const { data: authUsers, error: authError } = await adminClient.rpc('get_all_users_secure');
      
      if (authError) {
        return createErrorResponse(500, 'Error fetching user emails', authError.message);
      }
      
      // Create a map of user IDs to emails
      const emailMap = new Map();
      authUsers.forEach((au: any) => {
        emailMap.set(au.id, au.email);
      });
      
      // Combine all the data
      const combinedUsers = profiles.map((profile: any) => {
        const role = validateRole(roleMap.get(profile.id));
        const email = emailMap.get(profile.id) || '';
        
        return {
          id: profile.id,
          email,
          role,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          created_at: new Date().toISOString(), // Fallback since we don't have this data
          last_sign_in_at: null
        };
      });
      
      return new Response(JSON.stringify(combinedUsers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // If we got the data from the RPC function
    console.log(`Successfully retrieved ${data.length} users`);
    
    // Validate role values before sending
    const validatedUsers = data.map((user: any) => ({
      ...user,
      role: validateRole(user.role)
    }));
    
    return new Response(JSON.stringify(validatedUsers), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error('Unhandled error in get-all-users function:', error);
    return createErrorResponse(500, 'Server error', error.message);
  }
});
