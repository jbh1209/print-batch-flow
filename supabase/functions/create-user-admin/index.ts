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

    // Parse request body
    const { email, password, full_name, role = 'user', groups = [] } = await req.json();

    console.log('Creating user:', { email, full_name, role });

    // Validate inputs
    if (!email || !password || !full_name) {
      throw new Error('Missing required fields: email, password, full_name');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email format');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Create user in auth.users
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('User creation succeeded but no user returned');
    }

    console.log('Auth user created:', authData.user.id);

    // Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name: full_name,
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't throw - user is created, profile can be fixed later
    } else {
      console.log('Profile created');
    }

    // Assign role
    const { error: roleAssignError } = await adminClient
      .from('user_roles')
      .upsert({
        user_id: authData.user.id,
        role: role
      });

    if (roleAssignError) {
      console.error('Role assignment error:', roleAssignError);
      // Don't throw - user is created, role can be fixed later
    } else {
      console.log('Role assigned:', role);
    }

    // Assign groups if provided
    if (groups && groups.length > 0) {
      const groupInserts = groups.map(groupId => ({
        user_id: authData.user.id,
        group_id: groupId,
        assigned_by: caller.id,
        assigned_at: new Date().toISOString()
      }));

      const { error: groupError } = await adminClient
        .from('user_group_memberships')
        .upsert(groupInserts);

      if (groupError) {
        console.error('Group assignment error:', groupError);
        // Don't throw - user is created, groups can be fixed later
      } else {
        console.log('Groups assigned:', groups.length);
      }
    }

    return new Response(
      JSON.stringify({
        user: {
          id: authData.user.id,
          email: authData.user.email
        },
        role: role,
        groups: groups
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in create-user-admin:', error);
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
