import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Utility to fix jobs with completed proof stages but missing proof_approved_at timestamps
 */
export const fixProofApprovals = async () => {
  try {
    console.log('🔄 Starting proof approval fix process...');
    
    // Step 1: Get jobs that need fixing
    const { data: jobsToFix, error: queryError } = await supabase
      .from('production_jobs')
      .select(`
        id,
        wo_no,
        proof_approved_at,
        job_stage_instances!inner(
          id,
          completed_at,
          status,
          production_stages!inner(name)
        )
      `)
      .is('proof_approved_at', null)
      .eq('job_stage_instances.job_table_name', 'production_jobs')
      .eq('job_stage_instances.status', 'completed')
      .ilike('job_stage_instances.production_stages.name', '%proof%');

    if (queryError) {
      console.error('❌ Error querying jobs to fix:', queryError);
      throw queryError;
    }

    if (!jobsToFix || jobsToFix.length === 0) {
      console.log('✅ No jobs found that need proof approval timestamp fixes');
      toast.success('No jobs need fixing');
      return { fixed: 0, scheduled: false };
    }

    console.log(`📋 Found ${jobsToFix.length} jobs to fix:`, jobsToFix.map(j => j.wo_no));

    // Step 2: Fix each job individually
    let fixedCount = 0;
    for (const job of jobsToFix) {
      const proofStage = job.job_stage_instances[0]; // Should have the proof stage
      if (proofStage && proofStage.completed_at) {
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({
            proof_approved_at: proofStage.completed_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (updateError) {
          console.error(`❌ Failed to update job ${job.wo_no}:`, updateError);
          continue;
        }

        console.log(`✅ Fixed job ${job.wo_no} - set proof_approved_at to ${proofStage.completed_at}`);
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      toast.success(`Fixed ${fixedCount} jobs with missing proof approval timestamps`);
      
      // Step 3: Trigger scheduler to pick up these jobs
      console.log('🎯 Triggering scheduler to pick up fixed jobs...');
      
      try {
        const { data, error } = await supabase.rpc('simple_scheduler_wrapper', {
          p_mode: 'reschedule_all'
        });

        if (error) {
          console.error('❌ Scheduler error:', error);
          toast.error('Jobs fixed but scheduler failed - please run scheduler manually');
          return { fixed: fixedCount, scheduled: false };
        }

        console.log('✅ Scheduler completed via wrapper:', data);
        toast.success(`Fixed ${fixedCount} jobs and rescheduled successfully`);
        return { fixed: fixedCount, scheduled: true };
        
      } catch (schedulerErr) {
        console.error('❌ Error calling scheduler:', schedulerErr);
        toast.error('Jobs fixed but scheduler failed - please run scheduler manually');
        return { fixed: fixedCount, scheduled: false };
      }
    } else {
      toast.error('Failed to fix any jobs');
      return { fixed: 0, scheduled: false };
    }

  } catch (error) {
    console.error('❌ Error in fixProofApprovals:', error);
    toast.error('Failed to fix proof approvals');
    throw error;
  }
};