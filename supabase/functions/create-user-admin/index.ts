
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

    // Get request body
    const body = await req.json();
    const { email, password, full_name, role = 'user', groups = [] } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Create user via admin API
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name
      }
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!createData.user) {
      throw new Error('User creation failed');
    }

    const newUserId = createData.user.id;

    // Update profile if full_name provided
    if (full_name) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          full_name: full_name,
          updated_at: new Date().toISOString()
        });
      
      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    }

    // Assign role if needed
    if (role && role !== 'user') {
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: newUserId,
          role: role
        });
      
      if (roleError) {
        console.error('Error assigning role:', roleError);
      }
    }

    // Assign to groups if provided
    if (groups && groups.length > 0) {
      const memberships = groups.map((groupId: string) => ({
        user_id: newUserId,
        group_id: groupId
      }));
      
      const { error: groupError } = await supabase
        .from('user_group_memberships')
        .insert(memberships);
      
      if (groupError) {
        console.error('Error assigning groups:', groupError);
      }
    }

    return new Response(JSON.stringify({ 
      user: {
        id: createData.user.id,
        email: createData.user.email
      }
    }), {
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
