import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { jobId, stageInstanceId, userId } = await req.json();
    
    console.log(`🎯 Processing proof approval for job ${jobId}, stage ${stageInstanceId}`);
    
    if (!jobId || !stageInstanceId || !userId) {
      throw new Error('Missing required parameters');
    }

    const currentTime = new Date().toISOString();

    // Update ONLY job_stage_instances - database trigger will sync production_jobs.proof_approved_at
    const { error: stageUpdateError } = await supabase
      .from('job_stage_instances')
      .update({
        proof_approved_manually_at: currentTime,
        updated_at: currentTime
      })
      .eq('id', stageInstanceId);

    if (stageUpdateError) {
      console.error('❌ Failed to update stage instance:', stageUpdateError);
      throw stageUpdateError;
    }

    console.log('✅ Stage instance updated successfully');
    console.log('✅ Database trigger will automatically sync production_jobs.proof_approved_at');

    // Trigger scheduler via edge function (Sep 24 baseline approach)
    try {
      console.log('🔄 Triggering scheduler via schedule-on-approval...');
      
      const schedulerPayload = {
        commit: true,
        onlyIfUnset: true,
        source: "proof_approval"
      };

      const { data: schedulerData, error: schedulerError } = await supabase.functions
        .invoke('schedule-on-approval', {
          body: schedulerPayload
        });

      if (schedulerError) {
        console.error('❌ Scheduler error:', schedulerError);
        // Don't fail the whole operation for scheduler issues
      } else {
        console.log('✅ Scheduler triggered successfully:', schedulerData);
      }
    } catch (schedulerErr) {
      console.error('❌ Scheduler invocation failed:', schedulerErr);
      // Continue - proof is still approved even if scheduler fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Proof approved and scheduling triggered',
        jobId,
        stageInstanceId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Proof approval flow error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});