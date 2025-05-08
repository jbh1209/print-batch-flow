
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    
    // Create supabase client with auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    
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
    
    // Check if the user is an admin
    console.log("Checking admin status");
    const { data: isAdmin, error: adminCheckError } = await supabaseClient.rpc(
      'is_admin_secure_fixed',
      { _user_id: user.id }
    );
    
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
    
    // Get all users from auth.users
    const { data: authUsers, error: authUsersError } = await supabaseClient.auth.admin.listUsers();
    
    if (authUsersError) {
      console.error("Error listing users:", authUsersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: authUsersError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Auth users fetched successfully:", authUsers.users.length);
    
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles', details: profilesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Profiles fetched:", profiles?.length || 0);
    
    // Get all user roles
    const { data: userRoles, error: userRolesError } = await supabaseClient
      .from('user_roles')
      .select('*');
    
    if (userRolesError) {
      console.error("Error fetching user roles:", userRolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user roles', details: userRolesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("User roles fetched:", userRoles?.length || 0);
    
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
    
    console.log("Combined users prepared:", combinedUsers.length);
    
    return new Response(
      JSON.stringify(combinedUsers),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
