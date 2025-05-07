
// This function fetches all users with their roles
// Using improved auth and error handling

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
  
  console.log("get-all-users function invoked");
  
  try {
    // Create supabase admin client using service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required', 
          details: 'No authorization header found',
          status: 'auth_missing' 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Verify the user with token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Invalid user token:", userError?.message || "User not found");
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: userError?.message || 'Invalid user token',
          status: 'auth_invalid' 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`User authenticated: ${user.id}`);
    
    // Check if the user is an admin using database function
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc(
      'is_admin_secure_fixed',
      { _user_id: user.id }
    );
    
    if (adminCheckError) {
      console.error("Admin check error:", adminCheckError.message);
      return new Response(
        JSON.stringify({ 
          error: 'Error checking permissions', 
          details: adminCheckError.message,
          status: 'admin_check_error' 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Admin check result: ${isAdmin}`);
    
    if (!isAdmin) {
      console.error(`User ${user.id} is not an admin`);
      return new Response(
        JSON.stringify({ 
          error: 'Access denied', 
          details: 'Admin privileges required to access user data',
          status: 'not_admin' 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get all users and their data as admin
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authUsersError) {
      console.error("Error fetching users:", authUsersError.message);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch users', 
          details: authUsersError.message,
          status: 'fetch_error' 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get all profiles and user roles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*');
    
    const { data: userRoles, error: userRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('*');
    
    if (profilesError || userRolesError) {
      console.error("Error fetching profiles or roles:", profilesError?.message || userRolesError?.message);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch user data', 
          details: profilesError?.message || userRolesError?.message,
          status: 'data_error' 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Combine all data
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
    
    console.log(`Successfully returning ${combinedUsers?.length || 0} users`);
    
    return new Response(
      JSON.stringify(combinedUsers),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error in get-all-users function:', error.message, error.stack);
    return new Response(
      JSON.stringify({ 
        error: 'Server error', 
        details: error.message,
        status: 'server_error' 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
