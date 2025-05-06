
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
        JSON.stringify({ 
          error: 'Missing Authorization header',
          message: 'Authentication required' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create client with user's auth token to verify permissions
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify the user is authenticated
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Error getting authenticated user:', userError?.message || 'No user found')
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed',
          message: userError?.message || 'Please log in again' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`User ${user.id} authenticated successfully`)

    // Check if user is admin using secure function
    const { data: isAdmin, error: roleError } = await supabaseClient.rpc(
      'is_admin_secure',
      { _user_id: user.id }
    )

    if (roleError) {
      console.error('Error checking admin status:', roleError)
      return new Response(
        JSON.stringify({ 
          error: 'Permission check failed',
          message: 'Could not verify admin privileges' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!isAdmin) {
      console.log(`User ${user.id} is not an admin`)
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden',
          message: 'Admin rights required' 
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Admin user ${user.id} authorized successfully`)

    // Step 1: Fetch all users from auth schema - using service role client
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error fetching auth users:', authError)
      return new Response(
        JSON.stringify({ 
          error: 'Error fetching users',
          message: 'Could not retrieve user list' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 2: Fetch all profiles using the service role client
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, avatar_url, created_at')
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      // Continue without profiles rather than failing completely
      console.log('Will continue without profile data')
    }

    // Step 3: Fetch all roles using the service role client
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      // Continue without roles rather than failing completely
      console.log('Will continue without role data')
    }

    // Create maps for faster lookups
    const profilesMap = new Map(
      (profiles || []).map(profile => [profile.id, profile])
    )
    
    const rolesMap = new Map(
      (roles || []).map(role => [role.user_id, role.role])
    )

    // Combine all data
    const combinedUsers = authUsers.users.map(authUser => {
      const profile = profilesMap.get(authUser.id) || {}
      const role = rolesMap.get(authUser.id) || 'user'
      
      return {
        id: authUser.id,
        email: authUser.email,
        full_name: profile.full_name || '',
        avatar_url: profile.avatar_url,
        created_at: profile.created_at || authUser.created_at,
        role: role
      }
    })

    console.log(`Successfully retrieved ${combinedUsers.length} users`)

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
      JSON.stringify({ 
        error: 'Internal server error', 
        message: 'An unexpected error occurred while processing your request',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
