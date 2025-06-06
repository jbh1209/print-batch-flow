
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    )

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (action === 'generate-link') {
      // Generate proof link for stage instance
      const { stageInstanceId } = await req.json();
      
      console.log('🔗 Generating proof link for stage instance:', stageInstanceId);

      // Get stage instance details
      const { data: stageInstance, error: stageError } = await supabase
        .from('job_stage_instances')
        .select(`
          *,
          production_stage:production_stages(name)
        `)
        .eq('id', stageInstanceId)
        .eq('status', 'active')
        .single();

      if (stageError || !stageInstance) {
        console.error('❌ Stage instance not found:', stageError);
        return new Response(
          JSON.stringify({ error: 'Stage instance not found or not active' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Verify this is a proof stage
      const isProofStage = stageInstance.production_stage?.name?.toLowerCase().includes('proof');
      if (!isProofStage) {
        console.error('❌ Not a proof stage:', stageInstance.production_stage?.name);
        return new Response(
          JSON.stringify({ error: 'Can only generate proof links for proof stages' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Generate secure token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      // Get current user if available, but don't fail if not
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;

      // Create proof link
      const { data: proofLink, error: linkError } = await supabase
        .from('proof_links')
        .insert({
          job_id: stageInstance.job_id,
          job_table_name: stageInstance.job_table_name,
          stage_instance_id: stageInstanceId,
          token,
          expires_at: expiresAt.toISOString(),
          created_by: currentUserId // This can now be null
        })
        .select()
        .single();

      if (linkError) {
        console.error('❌ Failed to create proof link:', linkError);
        return new Response(
          JSON.stringify({ error: 'Failed to create proof link' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Update stage instance to show proof is awaiting sign off
      await supabase
        .from('job_stage_instances')
        .update({
          status: 'awaiting_approval',
          notes: 'Proof sent to client, awaiting sign off',
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId);

      // Use correct custom domain
      const customDomain = Deno.env.get('CUSTOM_DOMAIN_URL') || 'https://batchflow.jaimar.dev';
      const proofUrl = `${customDomain}/proof/${token}`;
      
      console.log('✅ Proof link generated successfully');
      return new Response(
        JSON.stringify({ 
          proofUrl,
          token,
          expiresAt: expiresAt.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'submit-approval') {
      // Handle client approval/changes request
      const { token, response, notes } = await req.json();
      
      console.log('📝 Processing client response:', { token, response });

      // Verify token and get proof link
      const { data: proofLink, error: linkError } = await supabase
        .from('proof_links')
        .select(`
          *,
          job_stage_instances(*)
        `)
        .eq('token', token)
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (linkError || !proofLink) {
        console.error('❌ Invalid or expired proof link:', linkError);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired proof link' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Mark proof link as used
      await supabase
        .from('proof_links')
        .update({
          is_used: true,
          client_response: response,
          client_notes: notes,
          responded_at: new Date().toISOString()
        })
        .eq('id', proofLink.id);

      if (response === 'approved') {
        console.log('✅ Client approved - advancing to next stage');
        
        // Auto-complete proof stage and advance to printing
        const { error: advanceError } = await supabase.rpc('advance_job_stage', {
          p_job_id: proofLink.job_id,
          p_job_table_name: proofLink.job_table_name,
          p_current_stage_id: proofLink.job_stage_instances.production_stage_id,
          p_notes: `Client approved via external link. ${notes ? `Client notes: ${notes}` : ''}`
        });

        if (advanceError) {
          console.error('❌ Failed to advance stage:', advanceError);
          return new Response(
            JSON.stringify({ error: 'Failed to advance stage after approval' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      } else if (response === 'changes_needed') {
        console.log('🔄 Client requested changes - sending back to DTP');
        
        // Find DTP stage to rework to
        const { data: dtpStages } = await supabase
          .from('job_stage_instances')
          .select(`
            *,
            production_stage:production_stages(name)
          `)
          .eq('job_id', proofLink.job_id)
          .eq('job_table_name', proofLink.job_table_name)
          .order('stage_order');

        const dtpStage = dtpStages?.find(stage => 
          stage.production_stage?.name?.toLowerCase().includes('dtp') ||
          stage.production_stage?.name?.toLowerCase().includes('design') ||
          stage.production_stage?.name?.toLowerCase().includes('prepress')
        );

        if (dtpStage) {
          const { error: reworkError } = await supabase.rpc('rework_job_stage', {
            p_job_id: proofLink.job_id,
            p_job_table_name: proofLink.job_table_name,
            p_current_stage_id: proofLink.job_stage_instances.production_stage_id,
            p_target_stage_id: dtpStage.production_stage_id,
            p_rework_reason: `Client requested changes via external link. ${notes ? `Client notes: ${notes}` : ''}`
          });

          if (reworkError) {
            console.error('❌ Failed to rework to DTP:', reworkError);
            return new Response(
              JSON.stringify({ error: 'Failed to send back to DTP' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
        }
      }

      console.log('✅ Client response processed successfully');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: response === 'approved' ? 'Approved and moved to printing' : 'Sent back to DTP for changes'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('❌ Error in proof approval handler:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
