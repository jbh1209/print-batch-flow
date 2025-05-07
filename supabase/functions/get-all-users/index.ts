
// This function fetches all users with their roles
// It must be called by an authenticated admin user

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, content-length, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  console.log("get-all-users function called");
  
  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'No authorization header', status: 'auth_missing' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Log the auth header format (without exposing the actual token)
    console.log(`Auth header format: ${authHeader.substring(0, 15)}...`);
    
    // Create supabase client with admin token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    
    // Verify the user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    
    if (userError) {
      console.error("Auth error:", userError.message);
      return new Response(
        JSON.stringify({ error: 'Authentication error', details: userError.message, status: 'auth_error' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!user) {
      console.error("No user found in session");
      return new Response(
        JSON.stringify({ error: 'No user in session', status: 'no_user' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`User authenticated: ${user.id}`);
    
    // Check if the user is an admin using our fixed function
    const { data: isAdmin, error: adminCheckError } = await supabaseClient.rpc(
      'is_admin_secure_fixed',
      { _user_id: user.id }
    );
    
    if (adminCheckError) {
      console.error("Admin check error:", adminCheckError.message);
      return new Response(
        JSON.stringify({ error: 'Error checking admin status', details: adminCheckError.message, status: 'admin_check_error' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Is admin check result: ${isAdmin}`);
    
    if (!isAdmin) {
      console.error(`User ${user.id} is not an admin`);
      return new Response(
        JSON.stringify({ error: 'Access denied: admin privileges required', status: 'not_admin' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get all users from auth.users
    const { data: authUsers, error: authUsersError } = await supabaseClient.auth.admin.listUsers();
    
    if (authUsersError) {
      console.error("Error fetching users:", authUsersError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: authUsersError.message, status: 'fetch_error' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Retrieved ${authUsers?.users?.length || 0} users`);
    
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      console.error("Error fetching profiles:", profilesError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles', details: profilesError.message, status: 'profiles_error' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get all user roles
    const { data: userRoles, error: userRolesError } = await supabaseClient
      .from('user_roles')
      .select('*');
    
    if (userRolesError) {
      console.error("Error fetching user roles:", userRolesError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user roles', details: userRolesError.message, status: 'roles_error' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Combine the data
    const combinedUsers = authUsers?.users.map(authUser => {
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
    
    console.log(`Returning ${combinedUsers?.length || 0} combined users`);
    
    return new Response(
      JSON.stringify(combinedUsers),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error in get-all-users function:', error.message, error.stack);
    return new Response(
      JSON.stringify({ error: 'Server error', details: error.message, stack: error.stack, status: 'server_error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
