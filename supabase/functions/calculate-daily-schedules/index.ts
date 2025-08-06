import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { start_date, end_date, calculation_type = 'nightly_full' } = await req.json();

    console.log(`Starting daily schedules calculation: ${start_date} to ${end_date}, type: ${calculation_type}`);

    // Call the database function to calculate daily schedules
    const { data, error } = await supabase.rpc('calculate_daily_schedules', {
      p_start_date: start_date,
      p_end_date: end_date,
      p_calculation_type: calculation_type
    });

    if (error) {
      console.error('Error calling calculate_daily_schedules:', error);
      throw error;
    }

    console.log('Daily schedules calculation completed:', data);

    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});