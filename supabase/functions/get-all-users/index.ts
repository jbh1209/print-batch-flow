
// Improved edge function for fetching users with proper error handling
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, content-length, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Set cache control headers for responses
const getCacheHeaders = (maxAge = 30) => ({
  "Cache-Control": `max-age=${maxAge}, s-maxage=${maxAge * 2}`
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
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
      return new Response(
        JSON.stringify({ error: 'Authentication required', details: 'No authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Verify the user with token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed', details: userError?.message || 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if the user is an admin
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc(
      'is_admin_secure_fixed',
      { _user_id: user.id }
    );
    
    if (adminCheckError) {
      return new Response(
        JSON.stringify({ error: 'Error checking permissions', details: adminCheckError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied', details: 'Admin privileges required to access user data' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get all users and their data as admin with reasonable batch size to prevent timeouts
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 100,
      page: 1
    });
    
    if (authUsersError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: authUsersError.message }),
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
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user data', details: profilesError?.message || userRolesError?.message }),
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
        role: userRole,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null
      };
    });
    
    console.log(`Successfully returning ${combinedUsers?.length || 0} users`);
    
    return new Response(
      JSON.stringify(combinedUsers),
      { 
        headers: { 
          ...corsHeaders, 
          ...getCacheHeaders(60), // Cache for 60 seconds
          "Content-Type": "application/json" 
        } 
      }
    );
  } catch (error) {
    console.error('Error in get-all-users function:', error.message);
    
    return new Response(
      JSON.stringify({ error: 'Server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
