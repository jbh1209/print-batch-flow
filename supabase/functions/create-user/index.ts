
// Follow Deno edge function conventions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.14.0";

// Set up CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Handle options requests for CORS
function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        "Allow": "POST, OPTIONS",
      },
      status: 204,
    });
  }
  return null;
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      });
    }

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables for Supabase");
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create a client with the user's JWT to check permissions
    const userJWT = authHeader.substring(7);
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${userJWT}` } }
    });

    // Check if the user is an admin
    const { data: isAdmin, error: adminCheckError } = await supabaseClient.rpc(
      "is_admin_secure_fixed", 
      { _user_id: (await supabaseClient.auth.getUser(userJWT)).data.user?.id }
    );

    if (adminCheckError || !isAdmin) {
      console.error("Admin check failed:", adminCheckError || "User is not an admin");
      return new Response(
        JSON.stringify({ error: "Only administrators can create users" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        }
      );
    }

    // Parse request body
    const { email, password, full_name, role } = await req.json();

    // Validate inputs
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Create the user with service role (admin privileges)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // If admin role is requested, set it explicitly
    if (role === "admin" && userData.user) {
      const { error: roleError } = await supabaseAdmin.rpc("set_user_role_admin", {
        _target_user_id: userData.user.id,
        _new_role: "admin",
      });

      if (roleError) {
        console.error("Error setting admin role:", roleError);
        // Don't fail the request if just the role setting fails
        // but return a warning
        return new Response(
          JSON.stringify({ 
            data: { user: userData.user, warning: "User created but role assignment failed" },
            error: roleError.message
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 207, // Partial success
          }
        );
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({ data: { message: "User created successfully", user: userData.user } }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      }
    );
  } catch (error) {
    console.error("Unhandled error in create-user function:", error);
    
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
