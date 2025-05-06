
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role for admin operations
    // This uses environment variables set in the Supabase dashboard
    const supabaseAdmin = createClient(
      // Supabase API URL - env var injected by Supabase CLI
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase service role key - env var injected by Supabase CLI
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify the user is authenticated and get their ID
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Error getting user:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient.rpc(
      'is_admin_secure',
      { _user_id: user.id }
    )

    if (roleError || !roleData) {
      console.error('Error checking admin status or not admin:', roleError)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin rights required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Fetch all users using admin client - with service role
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, avatar_url, created_at')
    
    if (usersError) {
      console.error('Error fetching profiles:', usersError)
      return new Response(
        JSON.stringify({ error: 'Error fetching users', details: usersError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get all auth users separately (email address isn't in profiles)
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error fetching auth users:', authError)
      return new Response(
        JSON.stringify({ error: 'Error fetching auth users', details: authError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get all roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return new Response(
        JSON.stringify({ error: 'Error fetching roles', details: rolesError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create a map of auth users by ID
    const authUsersMap = new Map()
    authUsers.users.forEach(authUser => {
      authUsersMap.set(authUser.id, authUser)
    })

    // Create a map of roles by user ID
    const rolesMap = new Map()
    roles.forEach(role => {
      rolesMap.set(role.user_id, role.role)
    })

    // Combine the data
    const combinedUsers = users.map(profile => {
      const authUser = authUsersMap.get(profile.id)
      const role = rolesMap.get(profile.id) || 'user'
      
      return {
        id: profile.id,
        email: authUser ? authUser.email : 'Email not available',
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
        role: role
      }
    })

    // Return the combined data
    return new Response(
      JSON.stringify(combinedUsers),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
