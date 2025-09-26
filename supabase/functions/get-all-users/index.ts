
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Edge function: get-all-users called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with admin privileges
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created');

    // Get the user's JWT from the request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log('Unauthorized user', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Check if user is admin using is_admin function that we just created
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', { _user_id: user.id });
    
    if (adminError || !isAdmin) {
      console.log('Admin check failed:', adminError || 'Not admin');
      return new Response(JSON.stringify({ error: 'Admin access required' }), { 
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log('Admin verified, fetching all users');
    
    // Use our newly fixed get_all_users_secure function
    const { data: secureUsers, error: secureError } = await supabase.rpc('get_all_users_secure');
      
    if (!secureError && secureUsers && secureUsers.length > 0) {
      console.log(`Found ${secureUsers.length} users with secure function`);
      return new Response(JSON.stringify(secureUsers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      console.log('Secure function failed or returned no users, falling back to admin.listUsers');
      
      // Fall back to auth.admin.listUsers method
      const { data: authUsers, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        console.log('Error fetching users:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      console.log(`Found ${authUsers.users.length} users in auth`);
      
      // Transform the response to include only id and email
      const simplifiedUsers = authUsers.users.map(user => ({
        id: user.id,
        email: user.email || 'No email'
      }));

      return new Response(JSON.stringify(simplifiedUsers), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
