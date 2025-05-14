
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS headers for browser support
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Handle requests to the function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  // Return empty array since admin functionality is removed
  return new Response(
    JSON.stringify([]),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
})
