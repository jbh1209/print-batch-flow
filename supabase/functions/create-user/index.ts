
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Check if we're in Lovable preview mode
const isPreviewMode = (url: string): boolean => {
  return url.includes('lovable.dev') || url.includes('gpteng.co');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log("Starting create-user function");
    
    // Check if in preview mode and return mock data if needed
    if (isPreviewMode(req.url)) {
      console.log("Preview mode detected, returning mock data for user creation");
      
      try {
        // Try to parse the body to get user data for response even in preview
        const body = await req.json();
        const { email, full_name } = body;
        
        const mockUser = {
          id: `preview-${Date.now()}`,
          email: email || "new-user@example.com",
          full_name: full_name || null,
          created_at: new Date().toISOString(),
        };
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            user: mockUser,
            message: "User created successfully (preview mode)" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (parseError) {
        console.log("Could not parse body in preview mode:", parseError);
        return new Response(
          JSON.stringify({ 
            success: true, 
            user: { id: `preview-${Date.now()}`, email: "new-user@example.com" },
            message: "User created successfully (preview mode)" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
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
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
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
    
    // Verify the user is authenticated with multiple methods
    console.log("Verifying user authentication");
    let isAdmin = false;
    let userId = null;
    
    try {
      // Method 1: Standard auth check
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
      userId = user.id;
      
      // Method 2: Check admin status with multiple fallbacks
      // First try the secure RPC function
      try {
        console.log("Checking admin via RPC function");
        const { data: isAdminRpc, error: adminCheckError } = await supabaseClient.rpc('is_admin_secure_fixed', { 
          _user_id: user.id 
        });
        
        if (!adminCheckError && isAdminRpc === true) {
          console.log("Admin status confirmed via RPC function");
          isAdmin = true;
        } else if (adminCheckError) {
          console.warn("Admin check error with RPC:", adminCheckError);
          // Continue to fallback methods
        }
      } catch (rpcError) {
        console.warn("RPC admin check failed:", rpcError);
        // Continue to fallback methods
      }
      
      // Method 3: Direct DB query fallback
      if (!isAdmin) {
        try {
          console.log("Checking admin via direct query");
          const { data: roleData, error: roleQueryError } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .maybeSingle();
          
          if (!roleQueryError && roleData) {
            console.log("Admin status confirmed via direct query");
            isAdmin = true;
          } else if (roleQueryError) {
            console.warn("Direct query admin check failed:", roleQueryError);
          }
        } catch (queryError) {
          console.warn("Direct query admin check exception:", queryError);
        }
      }
      
      // Method 4: Known admin emails fallback
      if (!isAdmin && user.email) {
        const knownAdminEmails = [
          "james@impressweb.co.za",
          "studio@impressweb.co.za"
        ];
        
        if (knownAdminEmails.includes(user.email.toLowerCase())) {
          console.log("Admin status confirmed via known admin email list");
          isAdmin = true;
        }
      }
      
      if (!isAdmin) {
        console.error("User is not an admin:", user.id);
        return new Response(
          JSON.stringify({ error: 'Access denied: admin privileges required' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (authError) {
      console.error("Authentication verification error:", authError);
      return new Response(
        JSON.stringify({ error: 'Authentication error', details: authError.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    
    // Create the user with admin client using service role - with timeout
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    );
    
    const createUserPromise = adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    
    const createUserTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Create user timeout')), 5000);
    });
    
    try {
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
      
      // Create profile entry manually with retries
      let profileCreated = false;
      let profileAttempts = 0;
      
      while (!profileCreated && profileAttempts < 3) {
        try {
          profileAttempts++;
          console.log(`Creating profile for new user (attempt ${profileAttempts})`);
          
          // Check if profile already exists first
          const { data: existingProfile } = await adminClient
            .from('profiles')
            .select('id')
            .eq('id', newUserId)
            .maybeSingle();
            
          if (existingProfile) {
            console.log('Profile already exists, skipping creation');
            profileCreated = true;
            break;
          }
          
          // Profile doesn't exist, create it
          const { error: profileError } = await adminClient
            .from('profiles')
            .upsert({ 
              id: newUserId, 
              full_name: full_name,
              updated_at: new Date().toISOString()
            });
          
          if (profileError) {
            console.error(`Profile creation error (attempt ${profileAttempts}):`, profileError);
            await new Promise(resolve => setTimeout(resolve, 500 * profileAttempts));
          } else {
            console.log("Profile created successfully");
            profileCreated = true;
          }
        } catch (profileErr) {
          console.error(`Profile creation exception (attempt ${profileAttempts}):`, profileErr);
          await new Promise(resolve => setTimeout(resolve, 500 * profileAttempts));
        }
      }
      
      if (!profileCreated) {
        console.warn("Failed to create profile after multiple attempts");
        // Continue with user creation anyway
      }
      
      // Set role with retry mechanism
      if (role && (role === 'admin' || role === 'user')) {
        console.log(`Setting user role to ${role}`);
        let roleSet = false;
        let roleAttempts = 0;
        
        while (!roleSet && roleAttempts < 3) {
          try {
            roleAttempts++;
            
            // Try the secure admin function first
            const { error: roleError } = await adminClient.rpc('set_user_role_admin', {
              _target_user_id: newUserId,
              _new_role: role
            });
            
            if (roleError) {
              console.error(`Role setting error with admin function (attempt ${roleAttempts}):`, roleError);
              
              // Try fallback to direct table insert if admin function fails
              try {
                const { error: insertError } = await adminClient
                  .from('user_roles')
                  .upsert({
                    user_id: newUserId,
                    role: role,
                    updated_at: new Date().toISOString()
                  });
                
                if (insertError) {
                  console.error(`Direct role insert error (attempt ${roleAttempts}):`, insertError);
                  await new Promise(resolve => setTimeout(resolve, 500 * roleAttempts));
                } else {
                  console.log("User role set via direct insert");
                  roleSet = true;
                }
              } catch (insertErr) {
                console.error(`Direct role insert exception (attempt ${roleAttempts}):`, insertErr);
                await new Promise(resolve => setTimeout(resolve, 500 * roleAttempts));
              }
            } else {
              console.log("User role set via admin function");
              roleSet = true;
            }
          } catch (roleErr) {
            console.error(`Role setting exception (attempt ${roleAttempts}):`, roleErr);
            await new Promise(resolve => setTimeout(resolve, 500 * roleAttempts));
          }
        }
        
        if (!roleSet) {
          console.warn("Failed to set user role after multiple attempts");
          // Continue with user creation anyway
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
      console.error('Create user operation error:', error);
      return new Response(
        JSON.stringify({ error: 'User creation failed', details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error('Error in create-user function:', error);
    return new Response(
      JSON.stringify({ error: 'Server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
