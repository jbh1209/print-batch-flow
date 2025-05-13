
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

// Enhanced CORS headers with proper security
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400", // 24 hours cache for preflight requests
  "Access-Control-Expose-Headers": "content-length, content-type" // Allow clients to see these headers
};

// Check if in preview mode
const isPreviewMode = (url: string): boolean => {
  return url.includes('lovable.dev') || 
         url.includes('gpteng.co') || 
         url.includes('localhost');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Check if in preview mode and return mock data if needed
    if (isPreviewMode(req.url)) {
      console.log("Preview mode detected, returning mock data");
      const mockUsers = [
        {
          id: "preview-admin-1",
          email: "admin@example.com",
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          role: "admin", 
          full_name: "Preview Admin",
          avatar_url: null
        },
        {
          id: "preview-user-1",
          email: "user@example.com",
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          role: "user",
          full_name: "Regular User",
          avatar_url: null
        }
      ];
      
      return new Response(JSON.stringify(mockUsers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with the user's JWT
    const supabaseClient = createClient(
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
    
    // Verify the token by getting the user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Call the RPC function to get all users with roles
    const { data, error } = await supabaseClient.rpc('get_all_users_with_roles');
    
    if (error) {
      console.error("Error calling get_all_users_with_roles:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(JSON.stringify(data), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate" 
      }
    });
  } catch (error) {
    console.error("Unexpected error in edge function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
