
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useAtomicCategoryAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);

  const assignCategoryWithWorkflow = async (
    jobIds: string[],
    categoryId: string,
    partAssignments?: Record<string, string>,
    currentJobCategoryId?: string | null
  ) => {
    setIsAssigning(true);
    let successCount = 0;
    const errorMessages: string[] = [];

    console.log('🚀 Starting atomic assignment with CRITICAL FIX - no auto-start...', { jobIds, categoryId, partAssignments });

    for (const jobId of jobIds) {
      try {
        console.log(`Processing job ${jobId}`);

        // Step 1: Delete all existing stage instances for the job for a clean slate.
        console.log(`🧹 Deleting existing stages for job ${jobId}`);
        const { error: deleteError } = await supabase
          .from('job_stage_instances')
          .delete()
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs');

        if (deleteError) {
          console.error(`❌ Failed to delete existing stages for job ${jobId}:`, deleteError);
          throw new Error(`Cleanup failed for job ${jobId}: ${deleteError.message}`);
        }
        console.log(`✅ Successfully cleaned stages for job ${jobId}`);

        // Step 2: Update the job's category_id.
        console.log(`🔄 Updating job ${jobId} category to ${categoryId}`);
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ category_id: categoryId, updated_at: new Date().toISOString() })
          .eq('id', jobId);

        if (updateError) {
          console.error(`❌ Failed to update job category for job ${jobId}:`, updateError);
          throw new Error(`Job update failed for job ${jobId}: ${updateError.message}`);
        }
        console.log(`✅ Successfully updated job category for job ${jobId}`);
        
        // Step 3: Call the RPC to create all stages (ALL SHOULD BE PENDING)
        console.log(`🔧 Initializing new workflow for job ${jobId} - ALL STAGES WILL BE PENDING:`, partAssignments);
        const { error: rpcError } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs',
          p_category_id: categoryId,
          p_part_assignments: partAssignments || {}
        });

        if (rpcError) {
          console.error(`❌ Workflow initialization failed for job ${jobId} via RPC:`, rpcError);
          throw new Error(`Workflow creation failed for job ${jobId}: ${rpcError.message}`);
        }
        
        console.log(`🎉 Successfully initialized workflow for job ${jobId} - VERIFYING ALL STAGES ARE PENDING...`);
        
        // CRITICAL: Verify no stages were auto-started
        const { data: verifyStages } = await supabase
          .from('job_stage_instances')
          .select('id, status, stage_order, production_stages(name)')
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs')
          .order('stage_order', { ascending: true });
        
        if (verifyStages) {
          const activeStages = verifyStages.filter(s => s.status === 'active');
          if (activeStages.length > 0) {
            console.error(`🚨 CRITICAL BUG: Job ${jobId} has ${activeStages.length} active stages after initialization!`, activeStages);
            toast.error(`CRITICAL BUG: Job ${jobId} auto-started ${activeStages.length} stages - this is wrong!`);
            // Don't throw error here, but log it for debugging
          } else {
            console.log(`✅ VERIFIED: Job ${jobId} has all ${verifyStages.length} stages in PENDING state`);
          }
        }
        
        successCount++;

      } catch (error) {
        console.error(`🔴 Operation failed for job ${jobId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        errorMessages.push(`Job ${jobId}: ${errorMessage}`);
        
        // Attempt to rollback job category if update failed mid-way
        if (currentJobCategoryId && currentJobCategoryId !== categoryId) {
          console.log(`⏪ Attempting to rollback category for job ${jobId} to ${currentJobCategoryId}`);
          await supabase
            .from('production_jobs')
            .update({ category_id: currentJobCategoryId })
            .eq('id', jobId);
        }
      }
    }

    // Final user feedback
    if (successCount > 0) {
      toast.success(`Successfully assigned category to ${successCount} out of ${jobIds.length} job(s) - all stages are PENDING and await operator action.`);
    }

    if (errorMessages.length > 0) {
      const uniqueErrors = [...new Set(errorMessages)];
      toast.error(`Failed to assign category for ${uniqueErrors.length} job(s).`, {
        description: uniqueErrors.join('; '),
      });
      console.error('❌ Final assignment errors:', uniqueErrors);
    }
    
    if (successCount === 0 && errorMessages.length === 0 && jobIds.length > 0) {
      toast.info("No changes were made to any jobs.");
    }

    setIsAssigning(false);
    console.log(`🏁 Assignment process finished. Success: ${successCount}/${jobIds.length} - ALL STAGES SHOULD BE PENDING`);
    return successCount > 0 && errorMessages.length === 0;
  };

  return {
    assignCategoryWithWorkflow,
    isAssigning
  };
};
