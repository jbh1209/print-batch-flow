
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify requesting user is authenticated and admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get requesting user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Check if user is admin
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || userRoles?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { 
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Fetch all users using admin API
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      throw new Error(`Failed to fetch users: ${authError.message}`);
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at, updated_at');

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    // Fetch all user group memberships with group details
    const { data: groupMemberships, error: groupError } = await supabase
      .from('user_group_memberships')
      .select(`
        user_id,
        group_id,
        user_groups (
          id,
          name,
          description
        )
      `);

    if (groupError) {
      console.error('Error fetching group memberships:', groupError);
    }

    // Create lookup maps
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
    
    // Create groups lookup map
    const userGroupsMap = new Map();
    if (groupMemberships) {
      groupMemberships.forEach(membership => {
        if (!userGroupsMap.has(membership.user_id)) {
          userGroupsMap.set(membership.user_id, []);
        }
        userGroupsMap.get(membership.user_id).push(membership.group_id);
      });
    }

    // Combine data
    const users = authUsers.users.map(authUser => {
      const profile = profileMap.get(authUser.id);
      const role = roleMap.get(authUser.id) || 'user';
      const groups = userGroupsMap.get(authUser.id) || [];
      
      return {
        id: authUser.id,
        email: authUser.email || 'No email',
        full_name: profile?.full_name || authUser.email || 'No name',
        avatar_url: profile?.avatar_url || null,
        role: role,
        groups: groups, // Now includes user's group IDs
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at
      };
    });

    console.log(`✅ Successfully fetched ${users.length} users with group data`);

    return new Response(JSON.stringify(users), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
