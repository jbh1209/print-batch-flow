
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const userPromise = userClient.auth.getUser(token);
    
    // Add a timeout to the user authentication check
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
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: userError?.message || "Invalid or expired token"
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    console.log("User authenticated:", user.id);
    
    // Check if the user is an admin - add a timeout to prevent potential deadlocks
    console.log("Checking admin status");
    const adminCheckPromise = userClient.rpc('is_admin_secure_fixed', { _user_id: user.id });
    
    // Add a timeout to the admin check
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Admin check timeout')), 3000);
    });
    
    const { data: isAdmin, error: adminCheckError } = await Promise.race([
      adminCheckPromise, 
      timeoutPromise.then(() => {
        throw new Error('Admin check timed out');
      })
    ]);
    
    if (adminCheckError) {
      console.error("Admin check error:", adminCheckError);
      return new Response(
        JSON.stringify({ error: 'Error checking admin status', details: adminCheckError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!isAdmin) {
      console.log("User is not admin:", user.id);
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
        }
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
