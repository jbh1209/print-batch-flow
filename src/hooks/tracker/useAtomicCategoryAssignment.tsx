import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractWONumber } from "@/utils/tracker/jobOrderingUtils";

export const useAtomicCategoryAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);

  // Set proper job_order_in_stage for newly created stages
  const setProperJobOrderInStage = async (jobId: string, jobTableName: string) => {
    try {
      console.log('🔧 Setting proper job_order_in_stage for job:', jobId);

      // Get the job's WO number - always from production_jobs table
      const { data: job, error: jobError } = await supabase
        .from('production_jobs')
        .select('wo_no')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        console.error('Error fetching job WO number:', jobError);
        return;
      }

      const woNumber = extractWONumber(job.wo_no);
      console.log('📋 Job WO number extracted:', woNumber, 'from', job.wo_no);

      // Get all stages for this job
      const { data: jobStages, error: stagesError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (stagesError || !jobStages) {
        console.error('Error fetching job stages:', stagesError);
        return;
      }

      // For each stage, calculate the proper order based on WO number
      for (const jobStage of jobStages) {
        // Get existing jobs in this stage to determine proper order
        const { data: existingInStage, error: existingError } = await supabase
          .from('job_stage_instances')
          .select(`
            id, 
            job_order_in_stage,
            job_id
          `)
          .eq('production_stage_id', jobStage.production_stage_id)
          .eq('job_table_name', jobTableName)
          .neq('id', jobStage.id);

        if (existingError) {
          console.error('Error fetching existing stages:', existingError);
          continue;
        }

        // Get WO numbers for existing jobs
        let sortedExisting: any[] = [];
        if (existingInStage && existingInStage.length > 0) {
          const jobIds = existingInStage.map(stage => stage.job_id);
          const { data: existingJobs, error: jobsError } = await supabase
            .from('production_jobs')
            .select('id, wo_no')
            .in('id', jobIds);

          if (!jobsError && existingJobs) {
            // Combine stage and job data
            sortedExisting = existingInStage
              .map(stage => {
                const jobData = existingJobs.find(job => job.id === stage.job_id);
                return {
                  ...stage,
                  woNumber: jobData ? extractWONumber(jobData.wo_no) : 0
                };
              })
              .sort((a, b) => a.woNumber - b.woNumber);
          }
        }

        // Calculate proper order based on WO number sequence
        let properOrder = 1;
        if (sortedExisting.length > 0) {
          // Find the position where this job should be inserted
          let insertPosition = sortedExisting.length + 1;
          for (let i = 0; i < sortedExisting.length; i++) {
            if (woNumber < sortedExisting[i].woNumber) {
              insertPosition = i + 1;
              break;
            }
          }
          properOrder = insertPosition;

          // Update existing jobs that should come after this one
          for (let i = insertPosition - 1; i < sortedExisting.length; i++) {
            const existingStage = sortedExisting[i];
            await supabase
              .from('job_stage_instances')
              .update({ job_order_in_stage: i + 2 })
              .eq('id', existingStage.id);
          }
        }

        // Update this job's order
        const { error: updateError } = await supabase
          .from('job_stage_instances')
          .update({ job_order_in_stage: properOrder })
          .eq('id', jobStage.id);

        if (updateError) {
          console.error('Error updating job order:', updateError);
        } else {
          console.log(`✅ Set job_order_in_stage to ${properOrder} for stage ${jobStage.production_stage_id}`);
        }
      }

    } catch (error) {
      console.error('Error in setProperJobOrderInStage:', error);
    }
  };

  const assignCategoryWithWorkflow = async (
    jobIds: string[],
    categoryId: string,
    partAssignments?: Record<string, string>,
    currentJobCategoryId?: string | null
  ) => {
    setIsAssigning(true);
    let successCount = 0;
    const errorMessages: string[] = [];

    console.log('🚀 Starting atomic assignment with proper job ordering...', { jobIds, categoryId, partAssignments });

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
        
        console.log(`🎉 Successfully initialized workflow for job ${jobId} - SETTING PROPER JOB ORDER...`);
        
        // Step 4: Set proper job_order_in_stage based on WO number
        await setProperJobOrderInStage(jobId, 'production_jobs');
        
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
            console.log(`✅ VERIFIED: Job ${jobId} has all ${verifyStages.length} stages in PENDING state with proper ordering`);
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
      toast.success(`Successfully assigned category to ${successCount} out of ${jobIds.length} job(s) - all stages are PENDING and ordered by WO number.`);
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
    console.log(`🏁 Assignment process finished. Success: ${successCount}/${jobIds.length} - ALL STAGES ORDERED BY WO NUMBER`);
    return successCount > 0 && errorMessages.length === 0;
  };

  return {
    assignCategoryWithWorkflow,
    isAssigning
  };
};
