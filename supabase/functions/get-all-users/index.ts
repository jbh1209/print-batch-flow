
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
        "Allow": "GET, OPTIONS",
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
    // Only allow GET requests
    if (req.method !== "GET") {
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
    
    // Create a client with the user's JWT to check permissions
    const userJWT = authHeader.substring(7);
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${userJWT}` } }
    });

    // Get the requesting user's ID
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(userJWT);
    
    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: "Failed to authenticate user" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Check if the user is an admin
    const { data: isAdmin, error: adminCheckError } = await supabaseClient.rpc(
      "is_admin_secure_fixed",
      { _user_id: user.id }
    );

    if (adminCheckError) {
      console.error("Admin check failed:", adminCheckError);
      return new Response(
        JSON.stringify({ error: `Admin check failed: ${adminCheckError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only administrators can view all users" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        }
      );
    }

    // Use the get_all_users_with_roles RPC function
    const { data: users, error: usersError } = await supabaseClient.rpc("get_all_users_with_roles");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch users: ${usersError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Return the users
    return new Response(
      JSON.stringify(users || []),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Unhandled error in get-all-users function:", error);
    
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
