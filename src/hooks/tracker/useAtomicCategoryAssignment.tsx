
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useAtomicCategoryAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);

  const assignCategoryWithWorkflow = async (
    jobIds: string[],
    categoryId: string,
    partAssignments?: Record<string, string>,
    currentJobCategoryId?: string | null // Optional: Pass the job's current category ID for logging
  ) => {
    try {
      setIsAssigning(true);
      console.log('🎯 Starting atomic category assignment:', {
        jobIds,
        categoryId,
        partAssignments,
        currentJobCategoryId
      });

      if (currentJobCategoryId) {
        if (currentJobCategoryId === categoryId) {
          console.log(`🔄 Re-initializing workflow for category ${categoryId} on job(s): ${jobIds.join(', ')}`);
        } else {
          console.log(`🔁 Changing category from ${currentJobCategoryId} to ${categoryId} on job(s): ${jobIds.join(', ')}`);
        }
      } else {
        console.log(`✨ Assigning new category ${categoryId} to job(s): ${jobIds.join(', ')}`);
      }

      // Enhanced validation for part assignments
      if (partAssignments && Object.keys(partAssignments).length > 0) {
        console.log('📋 Validating part assignments before sending:', {
          partAssignments,
          partCount: Object.keys(partAssignments).length,
          parts: Object.keys(partAssignments),
          stageIds: Object.values(partAssignments)
        });

        // Validate that all values are valid UUIDs
        for (const [partName, stageId] of Object.entries(partAssignments)) {
          if (!stageId || typeof stageId !== 'string') {
            console.error('❌ Invalid stage ID for part:', { partName, stageId });
            toast.error(`Invalid stage assignment for part: ${partName}`);
            setIsAssigning(false);
            return false;
          }

          // Verify stage exists in database
          const { data: stageExists, error: stageCheckError } = await supabase
            .from('production_stages')
            .select('id, name')
            .eq('id', stageId)
            .single();

          if (stageCheckError || !stageExists) {
            console.error('❌ Stage does not exist:', { partName, stageId, error: stageCheckError });
            toast.error(`Stage does not exist for part: ${partName}`);
            setIsAssigning(false);
            return false;
          }

          console.log(`✅ Validated stage for ${partName}:`, stageExists.name);
        }
      }

      let successCount = 0;
      let errorMessages: string[] = [];

      for (const jobId of jobIds) {
        try {
          console.log(`Processing job ${jobId} for category assignment to ${categoryId}`);
          // First, verify the category has stages configured
          const { data: categoryStages, error: stageCheckError } = await supabase
            .from('category_production_stages')
            .select('id')
            .eq('category_id', categoryId)
            .limit(1);

          if (stageCheckError) {
            console.error(`❌ Error checking category stages for job ${jobId}, category ${categoryId}:`, stageCheckError);
            errorMessages.push(`Failed to verify category configuration for job ${jobId}`);
            continue;
          }

          if (!categoryStages || categoryStages.length === 0) {
            console.error(`❌ Category ${categoryId} has no stages configured. Cannot assign to job ${jobId}.`);
            // This toast might be too aggressive if multiple jobs, consider summarizing errors later.
            // toast.error(`Category "${categoryId}" has no production stages configured.`);
            errorMessages.push(`Category has no production stages configured (for job ${jobId})`);
            continue; 
          }
          console.log(`✅ Category ${categoryId} has stages. Proceeding for job ${jobId}.`);

          // Before creating new workflow: Delete any existing workflow stages for this job
          // This is crucial for re-assignment or changing categories.
          console.log(`🧹 Attempting to delete existing workflow stages for job ${jobId}...`);
          const { error: deleteError } = await supabase
            .from('job_stage_instances')
            .delete()
            .eq('job_id', jobId)
            .eq('job_table_name', 'production_jobs');
            
          if (deleteError) {
            console.error(`❌ Error cleaning up existing workflow stages for job ${jobId}:`, deleteError);
            errorMessages.push(`Failed to delete existing workflow for job ${jobId}: ${deleteError.message}`);
            continue;
          } else {
            console.log(`✅ Existing workflow stages (if any) deleted for job ${jobId}`);
          }

          // Update the job's category
          console.log(`🔄 Updating job ${jobId} category_id to ${categoryId}...`);
          const { error: updateError } = await supabase
            .from('production_jobs')
            .update({ 
              category_id: categoryId,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

          if (updateError) {
            console.error(`❌ Error updating job category for job ${jobId}:`, updateError);
            errorMessages.push(`Failed to assign category to job ${jobId}: ${updateError.message}`);
            continue;
          }
          console.log(`✅ Job ${jobId} category_id updated to ${categoryId}.`);

          // Initialize workflow stages with enhanced error handling
          let workflowSuccess = false;
          
          if (partAssignments && Object.keys(partAssignments).length > 0) {
            console.log(`🔧 Initializing multi-part workflow for job ${jobId} with validated assignments:`, partAssignments);
            
            const { data, error: workflowError } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: categoryId,
              p_part_assignments: partAssignments
            });

            if (workflowError) {
              console.error('❌ Multi-part workflow initialization error:', {
                jobId,
                categoryId,
                partAssignments,
                error: workflowError,
              });
              
              let errorMessage = `Failed to initialize multi-part workflow for job ${jobId}`;
              if (workflowError.message?.includes('does not exist')) {
                errorMessage += ': One or more assigned stages do not exist';
              } else if (workflowError.message?.includes('part')) {
                errorMessage += ': Invalid part assignment detected';
              } else {
                errorMessage += `: ${workflowError.message}`;
              }
              
              errorMessages.push(errorMessage);
            } else {
              workflowSuccess = true;
              console.log(`✅ Multi-part workflow initialized successfully for job ${jobId}`);
            }
          } else {
            console.log(`🔧 Initializing standard workflow for job ${jobId} with category ${categoryId}`);
            
            const { data, error: workflowError } = await supabase.rpc('initialize_job_stages_auto', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs',
              p_category_id: categoryId
            });

            if (workflowError) {
              console.error('❌ Standard workflow initialization error:', {
                jobId,
                categoryId,
                error: workflowError,
              });
              errorMessages.push(`Failed to initialize workflow for job ${jobId}: ${workflowError.message}`);
            } else {
              workflowSuccess = true;
              console.log(`✅ Standard workflow initialized successfully for job ${jobId}`);
            }
          }

          if (workflowSuccess) {
            successCount++;
            console.log(`🎉 Successfully assigned category and initialized workflow for job ${jobId}`);
          }

        } catch (jobError) {
          console.error(`❌ Error processing job ${jobId}:`, jobError);
          errorMessages.push(`Failed to process job ${jobId}: ${jobError instanceof Error ? jobError.message : 'Unknown error'}`);
        }
      }

      // Show results with enhanced feedback
      if (successCount > 0) {
        const message = partAssignments && Object.keys(partAssignments).length > 0
          ? `Successfully processed ${successCount} job(s) with multi-part workflow.`
          : `Successfully processed ${successCount} job(s) with standard workflow.`;
        
        toast.success(message);
      }

      if (errorMessages.length > 0) {
        const uniqueErrors = [...new Set(errorMessages)];
        console.error('❌ Assignment errors summary:', uniqueErrors);
        // Show a more detailed error if only one, or a summary if multiple
        if (uniqueErrors.length === 1) {
            toast.error(`Operation failed: ${uniqueErrors[0]}`);
        } else {
            toast.error(`Failed operations for ${uniqueErrors.length} job(s)/steps. Check console for details.`);
        }
      }

      if (successCount === 0 && errorMessages.length === 0 && jobIds.length > 0) {
        toast.info('No workflows assigned (all jobs were skipped or no changes made).');
      }
      
      console.log(`🏁 Atomic category assignment finished. Success: ${successCount}/${jobIds.length}`);
      return successCount > 0 || (jobIds.length > 0 && errorMessages.length === 0); // Return true if successful or no errors and jobs were processed

    } catch (error) {
      console.error('❌ Fatal error in atomic category assignment:', error);
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
      toast.error('A critical error occurred during category assignment.');
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
