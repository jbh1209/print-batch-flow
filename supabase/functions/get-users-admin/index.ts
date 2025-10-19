import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create admin client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create regular client to verify caller is admin
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Verify caller identity
    const { data: { user: caller }, error: callerError } = await supabase.auth.getUser();
    if (callerError || !caller) {
      console.error('Caller auth error:', callerError);
      throw new Error('Unauthorized');
    }

    // Check if caller is admin
    const { data: roleCheck, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single();

    if (roleError || !roleCheck || roleCheck.role !== 'admin') {
      console.error('Admin check failed:', roleError);
      throw new Error('Unauthorized: Admin role required');
    }

    console.log('Fetching all users for admin:', caller.id);

    // Fetch all users from auth
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching users:', authError);
      throw new Error(`Failed to fetch users: ${authError.message}`);
    }

    const users = authData.users || [];
    console.log(`Found ${users.length} auth users`);

    if (users.length === 0) {
      return new Response(
        JSON.stringify([]),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const userIds = users.map(u => u.id);

    // Fetch profiles
    const { data: profiles, error: profileError } = await adminClient
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
    }

    // Fetch roles
    const { data: roles, error: rolesError } = await adminClient
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    // Fetch group memberships
    const { data: groupMemberships, error: groupError } = await adminClient
      .from('user_group_memberships')
      .select('user_id, group_id')
      .in('user_id', userIds);

    if (groupError) {
      console.error('Error fetching group memberships:', groupError);
    }

    // Map profiles and roles by user_id
    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
    const groupMap = new Map<string, string[]>();
    
    if (groupMemberships) {
      for (const gm of groupMemberships) {
        if (!groupMap.has(gm.user_id)) {
          groupMap.set(gm.user_id, []);
        }
        groupMap.get(gm.user_id)!.push(gm.group_id);
      }
    }

    // Combine data
    const enrichedUsers = users.map(user => ({
      id: user.id,
      email: user.email || '',
      full_name: profileMap.get(user.id) || '',
      role: roleMap.get(user.id) || 'user',
      created_at: user.created_at,
      groups: groupMap.get(user.id) || []
    }));

    console.log(`Returning ${enrichedUsers.length} enriched users`);

    return new Response(
      JSON.stringify(enrichedUsers),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in get-users-admin:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
