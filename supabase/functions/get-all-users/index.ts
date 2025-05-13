
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.26.0'

// CORS headers for browser support
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Handle requests to the function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    // Create a Supabase client with the provided auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user has admin access
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - could not verify user' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Check if user is admin
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc('is_admin_secure_fixed', {
      _user_id: user.id
    })

    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - admin access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Get all users with roles
    const { data: users, error: usersError } = await supabaseClient.rpc('get_all_users_with_roles')

    if (usersError) {
      console.error('Error fetching users:', usersError)
      
      // Try a fallback method with direct queries if RPC fails
      try {
        // Fetch users
        const { data: authUsers, error: authUsersError } = await supabaseClient
          .from('auth.users')
          .select('id, email, created_at, last_sign_in_at')
        
        if (authUsersError) throw authUsersError
        
        // Fetch profiles
        const { data: profiles, error: profilesError } = await supabaseClient
          .from('profiles')
          .select('*')
        
        if (profilesError) throw profilesError
        
        // Fetch roles
        const { data: roles, error: rolesError } = await supabaseClient
          .from('user_roles')
          .select('*')
        
        if (rolesError) throw rolesError
        
        // Combine data
        const combinedUsers = authUsers.map(user => {
          const profile = profiles?.find(p => p.id === user.id)
          const userRole = roles?.find(r => r.user_id === user.id)
          
          return {
            id: user.id,
            email: user.email,
            full_name: profile?.full_name || null,
            avatar_url: profile?.avatar_url || null,
            role: userRole?.role || 'user',
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at
          }
        })
        
        return new Response(
          JSON.stringify(combinedUsers),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch users data' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }
    }

    return new Response(
      JSON.stringify(users),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
