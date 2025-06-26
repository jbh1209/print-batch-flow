
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BatchAssignmentResult {
  successCount: number;
  failedCount: number;
  totalCount: number;
}

export const batchAssignJobCategory = async (
  jobIds: string[],
  categoryId: string,
  partAssignments?: Record<string, string>
): Promise<BatchAssignmentResult> => {
  if (!jobIds.length) {
    return { successCount: 0, failedCount: 0, totalCount: 0 };
  }

  let successCount = 0;
  let failedCount = 0;

  console.log('🔄 Starting batch category assignment...', { jobIds, categoryId });

  try {
    // Get category SLA for due date calculation (only if categoryId is not empty)
    let slaTargetDays = 3; // default
    if (categoryId) {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('sla_target_days')
        .eq('id', categoryId)
        .single();

      slaTargetDays = categoryData?.sla_target_days || 3;
    }

    // Process jobs in batch
    for (const jobId of jobIds) {
      try {
        console.log(`🔄 Processing job ${jobId}...`);

        // Check if job already has workflow stages
        const { data: existingStages } = await supabase
          .from('job_stage_instances')
          .select('id')
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs');

        const hasExistingStages = existingStages && existingStages.length > 0;

        console.log(`Job ${jobId} has existing stages:`, hasExistingStages);

        // Get job's created_at date for due date calculation
        const { data: jobData } = await supabase
          .from('production_jobs')
          .select('created_at, category_id')
          .eq('id', jobId)
          .single();

        if (!jobData) {
          console.error(`❌ Job ${jobId} not found`);
          failedCount++;
          continue;
        }

        // Check if category is already assigned and same
        if (jobData.category_id === categoryId) {
          console.log(`✅ Job ${jobId} already has correct category`);
          successCount++;
          continue;
        }

        // Calculate due date (only if categoryId is provided)
        let dueDateString = null;
        if (categoryId) {
          const createdAt = new Date(jobData.created_at);
          const dueDate = new Date(createdAt);
          dueDate.setDate(dueDate.getDate() + slaTargetDays);
          dueDateString = dueDate.toISOString().split('T')[0];
        }

        // Update job category and due date
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ 
            category_id: categoryId || null,
            due_date: dueDateString,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (updateError) {
          console.error(`❌ Failed to update job ${jobId}:`, updateError);
          throw updateError;
        }

        console.log(`✅ Updated job ${jobId} category to ${categoryId || 'null'}`);

        // Handle workflow stages
        if (hasExistingStages) {
          console.log(`🗑️ Deleting existing stages for job ${jobId}...`);
          // Delete existing workflow stages
          const { error: deleteError } = await supabase
            .from('job_stage_instances')
            .delete()
            .eq('job_id', jobId)
            .eq('job_table_name', 'production_jobs');

          if (deleteError) {
            console.error(`❌ Failed to delete existing stages for job ${jobId}:`, deleteError);
            // Don't fail the whole operation, just log the error
          } else {
            console.log(`✅ Deleted existing stages for job ${jobId}`);
          }
        }

        // Initialize new workflow stages (only if categoryId is provided)
        if (categoryId) {
          console.log(`🔄 Initializing new workflow for job ${jobId}...`);
          
          const { error: workflowError } = await supabase.rpc(
            partAssignments && Object.keys(partAssignments).length > 0
              ? 'initialize_job_stages_with_part_assignments'
              : 'initialize_job_stages_auto',
            partAssignments && Object.keys(partAssignments).length > 0
              ? {
                  p_job_id: jobId,
                  p_job_table_name: 'production_jobs',
                  p_category_id: categoryId,
                  p_part_assignments: partAssignments
                }
              : {
                  p_job_id: jobId,
                  p_job_table_name: 'production_jobs',
                  p_category_id: categoryId
                }
          );

          if (workflowError) {
            console.error(`❌ Failed to initialize workflow for job ${jobId}:`, workflowError);
            throw workflowError;
          }

          console.log(`✅ Initialized new workflow for job ${jobId}`);
        } else {
          console.log(`ℹ️ No category assigned to job ${jobId}, skipping workflow initialization`);
        }

        successCount++;

      } catch (error) {
        console.error(`❌ Failed to assign category to job ${jobId}:`, error);
        failedCount++;
      }
    }

    console.log('✅ Batch category assignment completed', { successCount, failedCount, totalCount: jobIds.length });

    return {
      successCount,
      failedCount,
      totalCount: jobIds.length
    };

  } catch (error) {
    console.error('❌ Batch assignment failed:', error);
    return {
      successCount,
      failedCount: jobIds.length - successCount,
      totalCount: jobIds.length
    };
  }
};
