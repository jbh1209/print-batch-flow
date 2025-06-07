
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

      // Get current user if available
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
          created_by: currentUserId
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

      // Update stage instance to show proof is awaiting sign off (DO NOT AUTO-ADVANCE)
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'awaiting_approval',
          notes: 'Proof sent to client, awaiting sign off',
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId);

      if (updateError) {
        console.error('❌ Failed to update stage instance status:', updateError);
      } else {
        console.log('✅ Stage instance status updated to awaiting_approval');
      }

      // Use the current request URL to determine the correct domain
      const requestUrl = new URL(req.url);
      const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
      const proofUrl = `${baseUrl}/proof/${token}`;
      
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
      // Handle client approval/changes request - DO NOT AUTO-ADVANCE
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

      // Mark proof link as used and record client response
      await supabase
        .from('proof_links')
        .update({
          is_used: true,
          client_response: response,
          client_notes: notes,
          responded_at: new Date().toISOString()
        })
        .eq('id', proofLink.id);

      // Update stage instance with client response - NO AUTO-ADVANCEMENT
      let newStatus = 'awaiting_approval';
      let newNotes = `Client response: ${response}`;
      
      if (response === 'approved') {
        newStatus = 'client_approved';
        newNotes = `Client approved via external link. ${notes ? `Client notes: ${notes}` : ''} - Ready for operator to complete stage.`;
      } else if (response === 'changes_needed') {
        newStatus = 'changes_requested';
        newNotes = `Client requested changes via external link. ${notes ? `Client notes: ${notes}` : ''} - Operator must rework.`;
      }

      await supabase
        .from('job_stage_instances')
        .update({
          status: newStatus,
          notes: newNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', proofLink.job_stage_instances.id);

      console.log(`✅ Client response processed: ${response} - Status: ${newStatus}`);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: response === 'approved' 
            ? 'Approved - waiting for operator to complete stage' 
            : 'Changes requested - operator notified'
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
