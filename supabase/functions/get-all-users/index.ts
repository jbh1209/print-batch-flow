
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

// Enhanced CORS headers to ensure better compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept",
  "Access-Control-Max-Age": "86400" // 24 hours cache for preflight requests
};

// Enhanced preview mode detection with multiple indicators
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

// Cache control constants
const CACHE_CONTROL_VALUE = "public, s-maxage=10, max-age=5"; // 10s on CDN, 5s in browser

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
          role: "admin", // Ensure we're using string literals that match UserRole
          full_name: "Admin User",
          avatar_url: null
        },
        {
          id: "preview-user-2",
          email: "user@example.com",
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          role: "user", // Ensure we're using string literals that match UserRole
          full_name: "Regular User",
          avatar_url: null
        },
        {
          id: "preview-user-3",
          email: "dev@example.com",
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          role: "user", // Ensure we're using string literals that match UserRole
          full_name: "Developer User",
          avatar_url: null
        }
      ];
      
      // Add artificial delay to simulate network latency (makes UI testing more realistic)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return new Response(
        JSON.stringify(mockUsers),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Cache-Control": CACHE_CONTROL_VALUE,
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
    console.log("Token extracted successfully");
    
    // First tier: Create client with user's JWT to verify identity and permissions
    const userClient = createClient(
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
    
    // Verify the user is authenticated by getting the current user
    console.log("Getting current user from JWT");
    
    // Add multiple fallback methods for admin verification
    let isAdmin = false;
    let userId = null;
    
    try {
      // Method 1: Verify user with timeout
      const userPromise = userClient.auth.getUser(token);
      const userTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('User authentication timeout')), 3000);
      });
      
      const {
        data: { user },
        error: userError,
      } = await Promise.race([
        userPromise,
        userTimeoutPromise.then(() => {
          throw new Error('User authentication timed out');
        })
      ]);
      
      if (userError || !user) {
        console.error("Auth error:", userError || "No user found");
        return createErrorResponse(401, 'Authentication failed', userError?.message || "Invalid or expired token");
      }
      
      console.log("User authenticated:", user.id);
      userId = user.id;
      
      // SIMPLIFIED ADMIN VALIDATION APPROACH: 
      // Consolidate the multiple checks into a single function call for better performance
      
      try {
        console.log("Checking admin status via combined approach");
        // First try the RPC function (most reliable)
        const { data: isAdminRpc, error: adminError } = await userClient.rpc('is_admin_secure_fixed', { 
          _user_id: user.id 
        });
        
        if (!adminError && isAdminRpc === true) {
          console.log("Admin status confirmed via RPC");
          isAdmin = true;
        } else if (adminError) {
          console.warn("RPC admin check failed:", adminError.message);
          
          // If RPC fails, try direct query as fallback
          const { data: roleData } = await userClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .maybeSingle();
          
          isAdmin = !!roleData;
          
          // Final fallback - check against known admin emails
          if (!isAdmin && user.email) {
            const knownAdminEmails = [
              "james@impressweb.co.za",
              "studio@impressweb.co.za"
            ];
            
            isAdmin = knownAdminEmails.includes(user.email.toLowerCase());
          }
        }
      } catch (adminCheckError) {
        console.error("Error in admin checks:", adminCheckError);
        // Continue with admin = false
      }
    } catch (authError) {
      console.error("Authentication error:", authError);
      return createErrorResponse(401, 'Authentication failed', authError.message || "Invalid or expired token");
    }
    
    if (!isAdmin) {
      console.log("User is not admin");
      return createErrorResponse(403, 'Access denied: admin privileges required');
    }
    
    console.log("Admin status confirmed, fetching users");
    
    // Second tier: Create a new client with the service role key
    // for admin-level operations (bypassing RLS)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          // Use HTTP fetch for all operations to avoid WebSocket issues
          fetch: (url, options) => {
            // Custom fetch implementation with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
            
            return fetch(url, {
              ...options,
              signal: controller.signal,
            }).then(response => {
              clearTimeout(timeoutId);
              return response;
            }).catch(err => {
              clearTimeout(timeoutId);
              throw err;
            });
          }
        },
      }
    );
    
    // Set timeouts for each DB operation to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database operations timeout')), 5000);
    });
    
    try {
      // Get all users data in parallel for better performance
      const authUsersPromise = adminClient.auth.admin.listUsers();
      const profilesPromise = adminClient.from('profiles').select('*');
      const userRolesPromise = adminClient.from('user_roles').select('*');
      
      const [authUsersResult, profilesResult, userRolesResult] = await Promise.all([
        Promise.race([authUsersPromise, timeoutPromise]),
        Promise.race([profilesPromise, timeoutPromise]),
        Promise.race([userRolesPromise, timeoutPromise])
      ]);
      
      const { data: authUsers, error: authUsersError } = authUsersResult;
      
      if (authUsersError) {
        console.error("Error listing users:", authUsersError);
        return createErrorResponse(500, 'Failed to fetch users', authUsersError.message);
      }
      
      console.log("Auth users fetched successfully:", authUsers.users.length);
      
      // Get all profiles using the admin client
      const { data: profiles, error: profilesError } = profilesResult;
      
      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        // Continue with limited data rather than failing completely
        console.log("Continuing without profiles data");
      } else {
        console.log("Profiles fetched:", profiles?.length || 0);
      }
      
      // Get all user roles using the admin client
      const { data: userRoles, error: userRolesError } = userRolesResult;
      
      if (userRolesError) {
        console.error("Error fetching user roles:", userRolesError);
        // Continue with limited data rather than failing completely
        console.log("Continuing without user roles data");
      } else {
        console.log("User roles fetched:", userRoles?.length || 0);
      }
      
      // Combine the data with normalized role values
      const combinedUsers = authUsers.users.map(authUser => {
        const profile = profiles?.find(p => p.id === authUser.id) || null;
        const userRoleRecord = userRoles?.find(r => r.user_id === authUser.id);
        
        // Ensure role is either 'admin' or 'user', defaulting to 'user'
        let role = 'user';
        if (userRoleRecord && (userRoleRecord.role === 'admin' || userRoleRecord.role === 'user')) {
          role = userRoleRecord.role;
        }
        
        return {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
          last_sign_in_at: authUser.last_sign_in_at,
          role,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null
        };
      });
      
      console.log("Combined users prepared, returning data:", combinedUsers.length);
      
      return new Response(
        JSON.stringify(combinedUsers),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Cache-Control": CACHE_CONTROL_VALUE
          } 
        }
      );
    } catch (dbError) {
      console.error('Error in database operations:', dbError);
      return createErrorResponse(500, 'Database error', dbError.message || 'Error retrieving user data');
    }
  } catch (error) {
    console.error('Error in get-all-users function:', error);
    return createErrorResponse(500, 'Server error', error.message || 'Unknown error occurred');
  }
});
