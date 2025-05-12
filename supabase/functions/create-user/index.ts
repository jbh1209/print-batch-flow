
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create supabase client with auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );
    
    // Verify the user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error("Authentication error:", userError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if the user is an admin
    const { data: isAdmin, error: adminCheckError } = await supabaseClient.rpc(
      'is_admin_secure_fixed',
      { _user_id: user.id }
    );
    
    if (adminCheckError) {
      console.error("Admin check error:", adminCheckError);
      return new Response(
        JSON.stringify({ error: 'Error checking admin status', details: adminCheckError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied: admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log("Received body:", JSON.stringify(body));
    } catch (error) {
      console.error("Body parsing error:", error);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { email, password, full_name, role } = body;
    
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Creating user with email: ${email}, name: ${full_name}, role: ${role}`);
    
    // Create the user with admin privileges
    const { data: adminAuthResponse, error: createUserError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    
    if (createUserError) {
      console.error("User creation error:", createUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user', details: createUserError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const newUserId = adminAuthResponse.user.id;
    console.log(`User created successfully with ID: ${newUserId}`);
    
    // Create profile entry manually to ensure it exists
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .upsert({ 
        id: newUserId, 
        full_name: full_name,
        updated_at: new Date().toISOString()
      });
      
    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Log but don't fail the request - user is still created
    } else {
      console.log("User profile created successfully");
    }
    
    // Set custom role if provided
    if (role && (role === 'admin' || role === 'user')) {
      console.log(`Setting user role to ${role}`);
      const { error: roleError } = await supabaseClient.rpc('set_user_role_admin', {
        _target_user_id: newUserId,
        _new_role: role
      });
      
      if (roleError) {
        console.error("Role setting error:", roleError);
        // Log but don't fail the request - user is still created with default role
      } else {
        console.log("User role set successfully");
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        user: adminAuthResponse.user,
        message: "User created successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error in create-user function:', error);
    return new Response(
      JSON.stringify({ error: 'Server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
