
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

// Enhanced CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept",
  "Access-Control-Max-Age": "86400" // 24 hours cache for preflight requests
};

// Enhanced preview mode detection
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

/**
 * Validates and normalizes role values to prevent security issues
 */
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
          id: "preview-user-1",
          email: "admin@example.com",
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          role: "admin",
          full_name: "Admin User",
          avatar_url: null
        },
        {
          id: "preview-user-2",
          email: "user@example.com",
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          role: "user",
          full_name: "Regular User",
          avatar_url: null
        }
      ];
      
      return new Response(
        JSON.stringify(mockUsers),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "X-Preview-Mode": "true"
          } 
        }
      );
    }
    
    // Get auth token from request and validate it
    const authHeader = req.headers.get('Authorization');
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse(401, 'Missing or invalid authorization header. Format should be: Bearer [token]');
    }
    
    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '');
    
    // Create user client to verify identity and permissions
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        },
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );
    
    // Verify the user is authenticated by getting the current user
    console.log("Getting current user from JWT");
    
    // Add timeout protection for user verification
    const userPromise = userClient.auth.getUser(token);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('User verification timed out')), 5000)
    );
    
    const {
      data: { user },
      error: userError,
    } = await Promise.race([userPromise, timeoutPromise]) as any;
    
    if (userError || !user) {
      console.error("Auth error:", userError || "No user found");
      return createErrorResponse(401, 'Authentication failed', userError?.message || "Invalid or expired token");
    }
    
    console.log("User authenticated:", user.id);
    
    // Verify admin status
    console.log("Checking admin status");
    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin_secure_fixed', { 
      _user_id: user.id 
    });
    
    if (adminError) {
      console.error("Admin check error:", adminError);
      return createErrorResponse(500, 'Error verifying admin status', adminError.message);
    }
    
    if (!isAdmin) {
      console.log("User is not admin");
      return createErrorResponse(403, 'Access denied: admin privileges required');
    }
    
    console.log("Admin status confirmed, fetching users");
    
    // Create admin client using service role
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
      }
    );
    
    // Get all users data in parallel for better performance
    const [authUsersResult, profilesResult, userRolesResult] = await Promise.all([
      adminClient.auth.admin.listUsers(),
      adminClient.from('profiles').select('*'),
      adminClient.from('user_roles').select('*')
    ]);
    
    const { data: authUsers, error: authUsersError } = authUsersResult;
    
    if (authUsersError) {
      console.error("Error listing users:", authUsersError);
      return createErrorResponse(500, 'Failed to fetch users', authUsersError.message);
    }
    
    // Get all profiles using the admin client
    const { data: profiles, error: profilesError } = profilesResult;
    
    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      // Continue with limited data
    }
    
    // Get all user roles using the admin client
    const { data: userRoles, error: userRolesError } = userRolesResult;
    
    if (userRolesError) {
      console.error("Error fetching user roles:", userRolesError);
      // Continue with limited data
    }
    
    // Combine the data with normalized role values
    const combinedUsers = authUsers.users.map(authUser => {
      const profile = profiles?.find(p => p.id === authUser.id) || null;
      const userRoleRecord = userRoles?.find(r => r.user_id === authUser.id);
      
      // Ensure role is either 'admin' or 'user', defaulting to 'user'
      const role = validateRole(userRoleRecord?.role);
      
      return {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at, // Fixed: use last_sign_in_at instead of last_seen_at
        role,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null
      };
    });
    
    console.log("Users fetched successfully, returning data");
    
    return new Response(
      JSON.stringify(combinedUsers),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=10, max-age=5" // 10s on CDN, 5s in browser
        } 
      }
    );
  } catch (error) {
    console.error('Error in get-all-users function:', error);
    return createErrorResponse(500, 'Server error', error.message || 'Unknown error occurred');
  }
});
