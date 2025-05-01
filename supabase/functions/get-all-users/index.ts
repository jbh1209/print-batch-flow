
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
    // Create Supabase client with admin privileges
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user's JWT from the request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Check if the user is an admin
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { 
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // If user is an admin, fetch all users using service role
    // Important fix: auth.users is a view, not a table
    // We need to use the correct API to access user data
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Transform the response to include only id and email
    const simplifiedUsers = data.users.map(user => ({
      id: user.id,
      email: user.email
    }));

    return new Response(JSON.stringify(simplifiedUsers), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
    
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
