
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

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

      // CRITICAL FIX: Update stage instance to show proof is awaiting sign off
      // This is what the UI checks to display "Proof Sent" status
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
        // Don't fail the whole operation, but log the error
      } else {
        console.log('✅ Stage instance status updated to awaiting_approval');
      }

      // Generate proof URL using production domain
      const PRODUCTION_DOMAIN = 'https://printstream.impressweb.co.za';
      const proofUrl = `${PRODUCTION_DOMAIN}/proof/${token}`;
      console.log('🔗 Proof URL generated:', proofUrl);
      
      // Get job details for email
      const { data: jobDetails } = await supabase
        .from('production_jobs')
        .select('wo_no, client_name, client_email')
        .eq('id', stageInstance.job_id)
        .single();
      
      // Send email notification if client email exists
      if (jobDetails?.client_email) {
        try {
          await resend.emails.send({
            from: 'proofing@impressweb.co.za',
            to: [jobDetails.client_email],
            subject: `Proof Ready for Review - WO ${jobDetails.wo_no}`,
            html: `
              <h2>Your proof is ready for review</h2>
              <p>Hello ${jobDetails.client_name || 'valued client'},</p>
              <p>Your proof for Work Order <strong>${jobDetails.wo_no}</strong> is now ready for your review and approval.</p>
              <p><a href="${proofUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Proof</a></p>
              <p>Or copy and paste this link into your browser:</p>
              <p><a href="${proofUrl}">${proofUrl}</a></p>
              <p>This link will expire on ${expiresAt.toLocaleDateString()}.</p>
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Review the proof carefully</li>
                <li>Click "Approve" if everything looks good - we'll schedule your job immediately</li>
                <li>Click "Request Changes" if you need any modifications</li>
              </ul>
              <p>Thank you for your business!</p>
            `,
          });
          console.log('✅ Proof email sent to:', jobDetails.client_email);
        } catch (emailError) {
          console.error('⚠️ Failed to send proof email:', emailError);
          // Don't fail the whole operation if email fails
        }
      }
      
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

    // NEW ENDPOINT: Get schedule estimate
    if (url.pathname.endsWith('/get-schedule-estimate')) {
      const { jobId } = await req.json();
      
      // Query last stage's scheduled_end_at
      const { data: lastStage, error: stageError } = await supabase
        .from('job_stage_instances')
        .select('scheduled_end_at')
        .eq('job_id', jobId)
        .order('stage_order', { ascending: false })
        .limit(1)
        .single();
      
      if (stageError || !lastStage?.scheduled_end_at) {
        return new Response(
          JSON.stringify({ error: 'Unable to calculate estimate' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ estimatedCompletion: lastStage.scheduled_end_at }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NEW ENDPOINT: Resend proof email
    if (action === 'resend-email') {
      const { proofLinkId } = await req.json();
      
      console.log('📧 Resending proof email for:', proofLinkId);
      
      const { data: proofLink, error: linkError } = await supabase
        .from('proof_links')
        .select(`
          *,
          production_jobs!inner(wo_no, client_name, client_email)
        `)
        .eq('id', proofLinkId)
        .single();
      
      if (linkError || !proofLink) {
        return new Response(
          JSON.stringify({ error: 'Proof link not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      const PRODUCTION_DOMAIN = 'https://printstream.impressweb.co.za';
      const proofUrl = `${PRODUCTION_DOMAIN}/proof/${proofLink.token}`;
      const jobDetails = proofLink.production_jobs;
      
      if (jobDetails?.client_email) {
        try {
          await resend.emails.send({
            from: 'proofing@impressweb.co.za',
            to: [jobDetails.client_email],
            subject: `[RESEND] Proof Ready for Review - WO ${jobDetails.wo_no}`,
            html: `
              <h2>Reminder: Your proof is ready for review</h2>
              <p>Hello ${jobDetails.client_name || 'valued client'},</p>
              <p>This is a reminder that your proof for Work Order <strong>${jobDetails.wo_no}</strong> is awaiting your review.</p>
              <p><a href="${proofUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Proof</a></p>
              <p>Or copy and paste this link into your browser:</p>
              <p><a href="${proofUrl}">${proofUrl}</a></p>
              <p>Thank you for your prompt attention!</p>
            `,
          });
          
          // Increment resend count
          await supabase
            .from('proof_links')
            .update({ 
              resend_count: (proofLink.resend_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', proofLinkId);
          
          console.log('✅ Proof email resent successfully');
          return new Response(
            JSON.stringify({ success: true, message: 'Email resent successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (emailError) {
          console.error('❌ Failed to resend email:', emailError);
          return new Response(
            JSON.stringify({ error: 'Failed to resend email' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      }
      
      return new Response(
        JSON.stringify({ error: 'No client email available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // NEW ENDPOINT: Regenerate proof link
    if (action === 'regenerate-link') {
      const { stageInstanceId } = await req.json();
      
      console.log('🔄 Regenerating proof link for:', stageInstanceId);
      
      // Invalidate old link
      await supabase
        .from('proof_links')
        .update({ 
          is_used: true,
          invalidated_at: new Date().toISOString()
        })
        .eq('stage_instance_id', stageInstanceId)
        .eq('is_used', false);
      
      // Generate new token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const { data: stageInstance } = await supabase
        .from('job_stage_instances')
        .select('*, production_jobs!inner(wo_no, client_name, client_email)')
        .eq('id', stageInstanceId)
        .single();
      
      if (!stageInstance) {
        return new Response(
          JSON.stringify({ error: 'Stage instance not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      // Create new proof link
      const { data: newProofLink } = await supabase
        .from('proof_links')
        .insert({
          job_id: stageInstance.job_id,
          job_table_name: stageInstance.job_table_name,
          stage_instance_id: stageInstanceId,
          token,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();
      
      const PRODUCTION_DOMAIN = 'https://printstream.impressweb.co.za';
      const proofUrl = `${PRODUCTION_DOMAIN}/proof/${token}`;
      const jobDetails = stageInstance.production_jobs;
      
      // Send new email
      if (jobDetails?.client_email) {
        await resend.emails.send({
          from: 'proofing@impressweb.co.za',
          to: [jobDetails.client_email],
          subject: `Updated Proof Link - WO ${jobDetails.wo_no}`,
          html: `
            <h2>Your proof link has been updated</h2>
            <p>Hello ${jobDetails.client_name || 'valued client'},</p>
            <p>A new proof link has been generated for Work Order <strong>${jobDetails.wo_no}</strong>.</p>
            <p><a href="${proofUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Proof</a></p>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${proofUrl}">${proofUrl}</a></p>
          `,
        });
      }
      
      console.log('✅ Proof link regenerated successfully');
      return new Response(
        JSON.stringify({ success: true, proofUrl, token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NEW ENDPOINT: Invalidate proof link
    if (action === 'invalidate-link') {
      const { token } = await req.json();
      
      console.log('🚫 Invalidating proof link:', token);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('proof_links')
        .update({ 
          is_used: true,
          invalidated_at: new Date().toISOString(),
          invalidated_by: user?.id || null
        })
        .eq('token', token);
      
      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to invalidate link' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      console.log('✅ Proof link invalidated successfully');
      return new Response(
        JSON.stringify({ success: true, message: 'Link invalidated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NEW ENDPOINT: List all proof links (admin)
    if (action === 'list-proof-links') {
      const { status, startDate, endDate, searchTerm } = await req.json();
      
      console.log('📋 Fetching proof links with filters:', { status, startDate, endDate, searchTerm });
      
      let query = supabase
        .from('proof_links')
        .select(`
          *,
          production_jobs!inner(wo_no, client_name, client_email),
          job_stage_instances!inner(
            production_stage_id,
            production_stages(name)
          )
        `)
        .order('created_at', { ascending: false });
      
      // Filter by status
      if (status === 'pending') {
        query = query.eq('is_used', false).gte('expires_at', new Date().toISOString());
      } else if (status === 'approved') {
        query = query.eq('client_response', 'approved');
      } else if (status === 'changes_requested') {
        query = query.eq('client_response', 'changes_needed');
      } else if (status === 'expired') {
        query = query.eq('is_used', false).lt('expires_at', new Date().toISOString());
      }
      
      // Filter by date range
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }
      
      const { data: proofLinks, error } = await query;
      
      if (error) {
        console.error('❌ Failed to fetch proof links:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch proof links' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      // Filter by search term if provided
      let filteredLinks = proofLinks || [];
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredLinks = filteredLinks.filter(link => 
          link.production_jobs?.wo_no?.toLowerCase().includes(search) ||
          link.production_jobs?.client_name?.toLowerCase().includes(search) ||
          link.production_jobs?.client_email?.toLowerCase().includes(search)
        );
      }
      
      console.log(`✅ Found ${filteredLinks.length} proof links`);
      return new Response(
        JSON.stringify({ proofLinks: filteredLinks }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'submit-approval') {
      // Handle client approval/changes request
      const { token, response, notes } = await req.json();
      
      console.log('📝 Processing client response:', { token, response });

      // Track that client viewed the link
      await supabase
        .from('proof_links')
        .update({ 
          viewed_at: new Date().toISOString()
        })
        .eq('token', token)
        .is('viewed_at', null);

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
        console.log('✅ Client approved - completing proof stage and scheduling');
        
        // Mark proof stage as completed with approval timestamp
        const { error: completeError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            proof_approved_manually_at: new Date().toISOString(),
            notes: `Client approved via external link. ${notes ? `Client notes: ${notes}` : ''}`
          })
          .eq('id', proofLink.stage_instance_id);

        if (completeError) {
          console.error('❌ Failed to complete proof stage:', completeError);
          return new Response(
            JSON.stringify({ error: 'Failed to complete proof stage after approval' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        // Append this job to the production schedule (not full reschedule)
        const { error: scheduleError } = await supabase.rpc('scheduler_append_jobs', {
          p_job_ids: [proofLink.job_id],
          p_only_if_unset: true
        });

        if (scheduleError) {
          console.error('⚠️ Failed to append to schedule:', scheduleError);
          // Don't fail the whole operation - proof is still approved
        } else {
          console.log('✅ Job appended to production schedule');
        }

        // Query estimated completion date
        const { data: lastStage } = await supabase
          .from('job_stage_instances')
          .select('scheduled_end_at')
          .eq('job_id', proofLink.job_id)
          .order('stage_order', { ascending: false })
          .limit(1)
          .single();

        const estimatedCompletion = lastStage?.scheduled_end_at || null;

        // Update proof_links with estimate
        await supabase
          .from('proof_links')
          .update({ 
            estimated_completion_date: estimatedCompletion,
            client_ip_address: req.headers.get('x-forwarded-for'),
            client_user_agent: req.headers.get('user-agent')
          })
          .eq('id', proofLink.id);
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
          message: response === 'approved' ? 'Proof approved and job scheduled successfully' : 'Sent back to DTP for changes',
          estimatedCompletion: response === 'approved' ? estimatedCompletion : null
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
