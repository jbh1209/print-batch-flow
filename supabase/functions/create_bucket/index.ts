
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get the authorization header from the request
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'No authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    // Parse request body
    const { bucket_name } = await req.json();
    
    if (!bucket_name) {
      return new Response(
        JSON.stringify({ error: 'No bucket name provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create a Supabase client with the service role key
    // This will have admin privileges and can create buckets
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '',
      { auth: { persistSession: false } }
    );

    // Check if the bucket already exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      return new Response(
        JSON.stringify({ error: `Error checking buckets: ${listError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // If bucket doesn't exist, create it
    if (!buckets?.some(bucket => bucket.name === bucket_name)) {
      const { data, error } = await supabaseAdmin.storage.createBucket(bucket_name, {
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (error) {
        console.error("Error creating bucket:", error);
        return new Response(
          JSON.stringify({ error: `Error creating bucket: ${error.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      
      // Update bucket public access
      const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucket_name, {
        public: true
      });
      
      if (updateError) {
        console.error("Error updating bucket visibility:", updateError);
      }
      
      console.log(`Bucket '${bucket_name}' created successfully`);
      return new Response(
        JSON.stringify({ success: true, message: `Bucket '${bucket_name}' created successfully` }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } else {
      console.log(`Bucket '${bucket_name}' already exists`);
      return new Response(
        JSON.stringify({ success: true, message: `Bucket '${bucket_name}' already exists` }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
  } catch (error) {
    console.error("Error in create_bucket function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
