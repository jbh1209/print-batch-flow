
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Get the Supabase URL and key from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a Supabase client with the Auth context of the logged in user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with service role key (for admin operations)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check permissions of requesting user (only allow admins)
    const userToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication error' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Check if user is an admin
    const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_admin', { 
      _user_id: user.id 
    });
    
    if (adminCheckError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Only admins can list users' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get complete user list
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also fetch profiles data to get full names
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url');

    if (profilesError) {
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Merge auth users with profile data
    const profilesMap = new Map();
    profiles.forEach(profile => {
      profilesMap.set(profile.id, profile);
    });

    // Combine auth user data with profile data
    const users = authUsers.users.map(authUser => {
      const profile = profilesMap.get(authUser.id) || {};
      return {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        user_metadata: authUser.user_metadata,
        full_name: profile.full_name || authUser.user_metadata?.full_name || null,
        avatar_url: profile.avatar_url || null,
      };
    });

    return new Response(JSON.stringify(users), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
