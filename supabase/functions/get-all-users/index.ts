
// This function fetches all users with their roles
// It must be called by an authenticated admin user

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
  
  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create supabase client with admin token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );
    
    // Verify the user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if the user is an admin using our fixed function
    const { data: isAdmin, error: adminCheckError } = await supabaseClient.rpc(
      'is_admin_secure_fixed',
      { _user_id: user.id }
    );
    
    if (adminCheckError) {
      return new Response(
        JSON.stringify({ error: 'Error checking admin status', details: adminCheckError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied: admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get all users from auth.users
    const { data: authUsers, error: authUsersError } = await supabaseClient.auth.admin.listUsers();
    
    if (authUsersError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: authUsersError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles', details: profilesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get all user roles
    const { data: userRoles, error: userRolesError } = await supabaseClient
      .from('user_roles')
      .select('*');
    
    if (userRolesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user roles', details: userRolesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    
    return new Response(
      JSON.stringify(combinedUsers),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error in get-all-users function:', error);
    return new Response(
      JSON.stringify({ error: 'Server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
