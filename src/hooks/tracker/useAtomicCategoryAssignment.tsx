
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

      // Enhanced logging for part assignments
      if (partAssignments && Object.keys(partAssignments).length > 0) {
        console.log('📋 Part assignments being sent:', partAssignments);
        console.log('📋 Part assignment details:', {
          partCount: Object.keys(partAssignments).length,
          parts: Object.keys(partAssignments),
          stages: Object.values(partAssignments)
        });
      }

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

          // Before creating new workflow: Delete any existing workflow stages for this job
          const { error: deleteError } = await supabase
            .from('job_stage_instances')
            .delete()
            .eq('job_id', jobId)
            .eq('job_table_name', 'production_jobs');
            
          if (deleteError) {
            console.error('❌ Error cleaning up existing workflow stages:', deleteError);
            errorMessages.push(`Failed to delete existing workflow for job ${jobId}`);
            continue;
          } else {
            console.log(`🧹 Existing workflow stages deleted for job ${jobId}`);
          }

          // Update the job's category
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
            console.log(`🔧 Initializing multi-part workflow for job ${jobId} with assignments:`, partAssignments);
            
            const { error: workflowError } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: categoryId,
              p_part_assignments: partAssignments
            });

            if (workflowError) {
              console.error('❌ Multi-part workflow initialization error:', workflowError);
              console.error('❌ Error details:', {
                message: workflowError.message,
                hint: workflowError.hint,
                details: workflowError.details,
                code: workflowError.code
              });
              console.error('❌ Part assignments that failed:', partAssignments);
              errorMessages.push(`Failed to initialize multi-part workflow for job ${jobId}: ${workflowError.message}`);
            } else {
              workflowSuccess = true;
              console.log(`✅ Multi-part workflow initialized for job ${jobId}`);
            }
          } else {
            console.log(`🔧 Initializing standard workflow for job ${jobId}`);
            
            const { error: workflowError } = await supabase.rpc('initialize_job_stages_auto', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: categoryId
            });

            if (workflowError) {
              console.error('❌ Standard workflow initialization error:', workflowError);
              console.error('❌ Error details:', {
                message: workflowError.message,
                hint: workflowError.hint,
                details: workflowError.details,
                code: workflowError.code
              });
              errorMessages.push(`Failed to initialize workflow for job ${jobId}: ${workflowError.message}`);
            } else {
              workflowSuccess = true;
              console.log(`✅ Standard workflow initialized for job ${jobId}`);
            }
          }

          if (workflowSuccess) {
            successCount++;
            console.log(`✅ Successfully assigned category and initialized workflow for job ${jobId}`);
          }

        } catch (jobError) {
          console.error(`❌ Error processing job ${jobId}:`, jobError);
          errorMessages.push(`Failed to process job ${jobId}: ${jobError instanceof Error ? jobError.message : 'Unknown error'}`);
        }
      }

      // Show results with enhanced feedback
      if (successCount > 0) {
        const message = partAssignments && Object.keys(partAssignments).length > 0
          ? `Successfully assigned category and initialized multi-part workflow for ${successCount} job(s)`
          : `Successfully assigned category and initialized workflow for ${successCount} job(s)`;
        
        toast.success(message);
      }

      if (errorMessages.length > 0) {
        const uniqueErrors = [...new Set(errorMessages)];
        console.error('❌ Assignment errors summary:', uniqueErrors);
        toast.error(`Failed operations: ${uniqueErrors.slice(0, 2).join(', ')}${uniqueErrors.length > 2 ? ` and ${uniqueErrors.length - 2} more...` : ''}`);
      }

      if (successCount === 0 && errorMessages.length === 0) {
        toast.info('No workflows assigned (all jobs were skipped)');
      }

      return successCount > 0;

    } catch (error) {
      console.error('❌ Error in atomic category assignment:', error);
      console.error('❌ Assignment context:', {
        jobIds,
        categoryId,
        partAssignments,
        errorDetails: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      });
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
