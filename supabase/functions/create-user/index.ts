
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

// Enhanced CORS headers for security
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept",
  "Access-Control-Max-Age": "86400" // 24 hours cache for preflight requests
};

// Helper function to generate detailed error responses
const createErrorResponse = (status: number, message: string, details?: any) => {
  return new Response(
    JSON.stringify({ 
      error: message, 
      details: details,
      timestamp: new Date().toISOString(),
    }),
    { 
      status, 
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-store" 
      } 
    }
  );
};

// Validate role to ensure it's one of the allowed values
const validateRole = (role: any): string => {
  if (role === 'admin' || role === 'user') {
    return role;
  }
  console.log(`Invalid role value detected: "${role}", defaulting to "user"`);
  return 'user';
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get auth token from request and validate it
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse(401, 'Missing or invalid authorization header');
    }
    
    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '');
    
    // Create user client to verify identity and permissions
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );
    
    // Verify admin status
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);
    
    if (userError || !user) {
      return createErrorResponse(401, 'Authentication failed', userError?.message);
    }
    
    // Verify admin status
    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin_secure_fixed', { 
      _user_id: user.id 
    });
    
    if (adminError) {
      return createErrorResponse(500, 'Error verifying admin status', adminError.message);
    }
    
    if (!isAdmin) {
      return createErrorResponse(403, 'Access denied: admin privileges required');
    }
    
    // Parse request body
    const requestData = await req.json();
    const { email, password, full_name, role: requestedRole } = requestData;
    
    if (!email || !password) {
      return createErrorResponse(400, 'Email and password are required');
    }
    
    // Validate and normalize role
    const role = validateRole(requestedRole);
    
    // Create admin client using service role
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
      }
    );
    
    // Create the user
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });
    
    if (createError) {
      return createErrorResponse(500, 'Error creating user', createError.message);
    }
    
    if (!userData.user) {
      return createErrorResponse(500, 'No user returned after creation');
    }
    
    // Set user role
    const { error: roleError } = await adminClient.rpc('set_user_role_admin', {
      _target_user_id: userData.user.id,
      _new_role: role
    });
    
    if (roleError) {
      console.error("Error setting role:", roleError);
      // Continue anyway since the user is created
    }
    
    return new Response(
      JSON.stringify({ 
        message: 'User created successfully',
        userId: userData.user.id
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json"
        } 
      }
    );
  } catch (error) {
    console.error('Error in create-user function:', error);
    return createErrorResponse(500, 'Server error', error.message);
  }
});
