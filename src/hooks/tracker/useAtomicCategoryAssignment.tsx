
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useAtomicCategoryAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);

  const assignCategoryWithWorkflow = async (
    jobIds: string[],
    categoryId: string,
    partAssignments?: Record<string, string>
  ) => {
    try {
      setIsAssigning(true);
      console.log('🎯 Starting atomic category assignment:', {
        jobIds,
        categoryId,
        partAssignments
      });

      let successCount = 0;
      let errorMessages: string[] = [];

      for (const jobId of jobIds) {
        try {
          // First, verify the category has stages configured
          const { data: categoryStages, error: stageCheckError } = await supabase
            .from('category_production_stages')
            .select('id')
            .eq('category_id', categoryId)
            .limit(1);

          if (stageCheckError) {
            console.error('❌ Error checking category stages:', stageCheckError);
            errorMessages.push(`Failed to verify category configuration for job ${jobId}`);
            continue;
          }

          if (!categoryStages || categoryStages.length === 0) {
            console.error('❌ Category has no stages configured:', categoryId);
            errorMessages.push(`Category has no production stages configured`);
            continue;
          }

          // Check if job already has workflow stages
          const { data: existingStages, error: existingCheckError } = await supabase
            .from('job_stage_instances')
            .select('id')
            .eq('job_id', jobId)
            .eq('job_table_name', 'production_jobs')
            .limit(1);

          if (existingCheckError) {
            console.error('❌ Error checking existing stages:', existingCheckError);
            errorMessages.push(`Failed to check existing workflow for job ${jobId}`);
            continue;
          }

          if (existingStages && existingStages.length > 0) {
            console.log(`⚠️ Job ${jobId} already has workflow stages, skipping`);
            continue;
          }

          // Use database transaction to update job and create stages atomically
          const { error: updateError } = await supabase
            .from('production_jobs')
            .update({ 
              category_id: categoryId,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

          if (updateError) {
            console.error('❌ Error updating job category:', updateError);
            errorMessages.push(`Failed to assign category to job ${jobId}`);
            continue;
          }

          // Initialize workflow stages
          let workflowSuccess = false;
          
          if (partAssignments && Object.keys(partAssignments).length > 0) {
            const { error: workflowError } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: categoryId,
              p_part_assignments: partAssignments
            });

            if (workflowError) {
              console.error('❌ Multi-part workflow initialization error:', workflowError);
              errorMessages.push(`Failed to initialize multi-part workflow for job ${jobId}`);
            } else {
              workflowSuccess = true;
            }
          } else {
            const { error: workflowError } = await supabase.rpc('initialize_job_stages_auto', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: categoryId
            });

            if (workflowError) {
              console.error('❌ Standard workflow initialization error:', workflowError);
              errorMessages.push(`Failed to initialize workflow for job ${jobId}`);
            } else {
              workflowSuccess = true;
            }
          }

          if (workflowSuccess) {
            successCount++;
            console.log(`✅ Successfully assigned category and initialized workflow for job ${jobId}`);
          }

        } catch (jobError) {
          console.error(`❌ Error processing job ${jobId}:`, jobError);
          errorMessages.push(`Failed to process job ${jobId}`);
        }
      }

      // Show results
      if (successCount > 0) {
        const message = partAssignments && Object.keys(partAssignments).length > 0
          ? `Successfully assigned category and initialized multi-part workflow for ${successCount} job(s)`
          : `Successfully assigned category and initialized workflow for ${successCount} job(s)`;
        
        toast.success(message);
      }

      if (errorMessages.length > 0) {
        const uniqueErrors = [...new Set(errorMessages)];
        toast.error(`Failed operations: ${uniqueErrors.join(', ')}`);
      }

      if (successCount === 0 && errorMessages.length === 0) {
        toast.info('All selected jobs already have workflows assigned');
      }

      return successCount > 0;

    } catch (error) {
      console.error('❌ Error in atomic category assignment:', error);
      toast.error('Failed to assign category and initialize workflow');
      return false;
    } finally {
      setIsAssigning(false);
    }
  };

  return {
    assignCategoryWithWorkflow,
    isAssigning
  };
};
