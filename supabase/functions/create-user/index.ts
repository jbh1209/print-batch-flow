
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
    console.log("Starting create-user function");
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Authorization header missing");
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create supabase client with auth token - with timeout for all operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
          fetch: (url, options) => {
            // Custom fetch implementation with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            
            return fetch(url, {
              ...options,
              signal: controller.signal,
            }).then(response => {
              clearTimeout(timeoutId);
              return response;
            }).catch(err => {
              clearTimeout(timeoutId);
              throw err;
            });
          }
        },
      }
    );
    
    // Verify the user is authenticated
    console.log("Verifying user authentication");
    const authPromise = supabaseClient.auth.getUser();
    const authTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Authentication verification timeout')), 3000);
    });
    
    const {
      data: { user },
      error: userError,
    } = await Promise.race([
      authPromise,
      authTimeoutPromise.then(() => {
        throw new Error('Authentication verification timed out');
      })
    ]);
    
    if (userError || !user) {
      console.error("Authentication error:", userError || "No user found");
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: userError?.message || "No user found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("User authenticated, checking admin status");
    
    // Check if the user is an admin with timeout
    const adminCheckPromise = supabaseClient.rpc('is_admin_secure_fixed', { _user_id: user.id });
    const adminCheckTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Admin check timeout')), 3000);
    });
    
    const { data: isAdmin, error: adminCheckError } = await Promise.race([
      adminCheckPromise,
      adminCheckTimeoutPromise.then(() => {
        throw new Error('Admin check timed out');
      })
    ]);
    
    if (adminCheckError) {
      console.error("Admin check error:", adminCheckError);
      return new Response(
        JSON.stringify({ error: 'Error checking admin status', details: adminCheckError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!isAdmin) {
      console.error("User is not an admin:", user.id);
      return new Response(
        JSON.stringify({ error: 'Access denied: admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Admin status confirmed, proceeding to create user");
    
    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log("Request body parsed successfully");
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
    
    // Create the user with admin privileges - with timeout
    const createUserPromise = supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    
    const createUserTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Create user timeout')), 5000);
    });
    
    const { data: adminAuthResponse, error: createUserError } = await Promise.race([
      createUserPromise,
      createUserTimeoutPromise.then(() => {
        throw new Error('User creation timed out');
      })
    ]);
    
    if (createUserError) {
      console.error("User creation error:", createUserError);
      
      // Check for duplicate email error
      if (createUserError.message?.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'This email is already registered', details: createUserError.message }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create user', details: createUserError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const newUserId = adminAuthResponse.user.id;
    console.log(`User created successfully with ID: ${newUserId}`);
    
    // Create profile entry manually to ensure it exists - with timeout
    const profilePromise = supabaseClient
      .from('profiles')
      .upsert({ 
        id: newUserId, 
        full_name: full_name,
        updated_at: new Date().toISOString()
      });
      
    const profileTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile creation timeout')), 3000);
    });
    
    try {
      const { error: profileError } = await Promise.race([
        profilePromise,
        profileTimeoutPromise.then(() => {
          throw new Error('Profile creation timed out');
        })
      ]);
      
      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Log but don't fail the request - user is still created
      } else {
        console.log("User profile created successfully");
      }
    } catch (profileErr) {
      console.error("Profile creation failed:", profileErr);
      // Log but continue - this is non-critical
    }
    
    // Set custom role if provided - with timeout
    if (role && (role === 'admin' || role === 'user')) {
      console.log(`Setting user role to ${role}`);
      const rolePromise = supabaseClient.rpc('set_user_role_admin', {
        _target_user_id: newUserId,
        _new_role: role
      });
      
      const roleTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Role setting timeout')), 3000);
      });
      
      try {
        const { error: roleError } = await Promise.race([
          rolePromise,
          roleTimeoutPromise.then(() => {
            throw new Error('Role setting timed out');
          })
        ]);
        
        if (roleError) {
          console.error("Role setting error:", roleError);
          // Log but don't fail the request - user is still created with default role
        } else {
          console.log("User role set successfully");
        }
      } catch (roleErr) {
        console.error("Role setting failed:", roleErr);
        // Log but continue - this is non-critical
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
