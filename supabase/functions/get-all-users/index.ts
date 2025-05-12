
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Check if we're in Lovable preview mode
const isPreviewMode = (url: string): boolean => {
  return url.includes('lovable.dev') || url.includes('gpteng.co');
};

// Cache control constants
const CACHE_CONTROL_VALUE = "public, s-maxage=10, max-age=5"; // 10s on CDN, 5s in browser

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  console.log("Starting get-all-users function");
  
  try {
    // Check if in preview mode and return mock data if needed
    if (isPreviewMode(req.url)) {
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
            "Cache-Control": CACHE_CONTROL_VALUE
          } 
        }
      );
    }
    
    // Get auth token from request and validate it
    const authHeader = req.headers.get('Authorization');
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ 
          error: 'Missing or invalid authorization header. Format should be: Bearer [token]' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
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
        throw new Error('Authentication failed: ' + (userError?.message || "Invalid or expired token"));
      }
      
      console.log("User authenticated:", user.id);
      userId = user.id;
      
      // Method 2: Check admin status via RPC - most secure
      try {
        console.log("Checking admin status via RPC");
        const { data: isAdminRpc, error: adminError } = await userClient.rpc('is_admin_secure_fixed', { 
          _user_id: user.id 
        });
        
        if (!adminError && isAdminRpc === true) {
          console.log("Admin status confirmed via RPC");
          isAdmin = true;
        } else if (adminError) {
          console.warn("RPC admin check failed:", adminError.message);
          // Continue to fallback methods
        }
      } catch (rpcError) {
        console.error("Error in admin RPC check:", rpcError);
        // Continue to fallback methods
      }
      
      // Method 3: Direct query to user_roles if RPC failed
      if (!isAdmin) {
        try {
          console.log("Checking admin status via direct query");
          const { data: roleData, error: roleError } = await userClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .maybeSingle();
          
          if (!roleError && roleData) {
            console.log("Admin status confirmed via direct query");
            isAdmin = true;
          } else if (roleError) {
            console.warn("Direct query admin check failed:", roleError.message);
          }
        } catch (queryError) {
          console.error("Error in direct query admin check:", queryError);
        }
      }
      
      // Method 4: Emergency fallback - check against known admin emails
      if (!isAdmin && user.email) {
        const knownAdminEmails = [
          "james@impressweb.co.za",
          "studio@impressweb.co.za"
        ];
        
        if (knownAdminEmails.includes(user.email.toLowerCase())) {
          console.log("Admin status granted via known admin email list");
          isAdmin = true;
        }
      }
    } catch (authError) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: authError.message || "Invalid or expired token"
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    if (!isAdmin) {
      console.log("User is not admin");
      return new Response(
        JSON.stringify({ error: 'Access denied: admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            
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
    
    // Set a timeout for each DB operation to prevent hanging
    const authUsersPromise = adminClient.auth.admin.listUsers();
    const profilesPromise = adminClient.from('profiles').select('*');
    const userRolesPromise = adminClient.from('user_roles').select('*');
    
    // Execute all queries in parallel with a timeout
    const dbOperationTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database operations timeout')), 5000);
    });
    
    try {
      // Get all users from auth.users using the admin client with service role key
      const [authUsersResult, profilesResult, userRolesResult] = await Promise.all([
        Promise.race([authUsersPromise, dbOperationTimeoutPromise]),
        Promise.race([profilesPromise, dbOperationTimeoutPromise]),
        Promise.race([userRolesPromise, dbOperationTimeoutPromise])
      ]);
      
      const { data: authUsers, error: authUsersError } = authUsersResult;
      
      if (authUsersError) {
        console.error("Error listing users:", authUsersError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch users', details: authUsersError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      
      // Combine the data
      const combinedUsers = authUsers.users.map(authUser => {
        const profile = profiles?.find(p => p.id === authUser.id) || null;
        const userRole = userRoles?.find(r => r.user_id === authUser.id)?.role || 'user';
        
        return {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
          last_sign_in_at: authUser.last_sign_in_at,
          role: userRole,
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
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          details: dbError.message || 'Error retrieving user data' 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error('Error in get-all-users function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Server error', 
        details: error.message || 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
