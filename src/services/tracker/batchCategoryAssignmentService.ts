
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

  try {
    // Get category SLA for due date calculation
    const { data: categoryData } = await supabase
      .from('categories')
      .select('sla_target_days')
      .eq('id', categoryId)
      .single();

    const slaTargetDays = categoryData?.sla_target_days || 3;

    // Process jobs in batch
    for (const jobId of jobIds) {
      try {
        // Check if job already has workflow stages
        const { data: existingStages } = await supabase
          .from('job_stage_instances')
          .select('id')
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs')
          .limit(1);

        if (existingStages && existingStages.length > 0) {
          continue; // Skip jobs that already have stages
        }

        // Get job's created_at date for due date calculation
        const { data: jobData } = await supabase
          .from('production_jobs')
          .select('created_at')
          .eq('id', jobId)
          .single();

        if (!jobData) continue;

        // Calculate due date
        const createdAt = new Date(jobData.created_at);
        const dueDate = new Date(createdAt);
        dueDate.setDate(dueDate.getDate() + slaTargetDays);
        const dueDateString = dueDate.toISOString().split('T')[0];

        // Update job category and due date
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ 
            category_id: categoryId,
            due_date: dueDateString,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (updateError) throw updateError;

        // Initialize workflow stages
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

        if (workflowError) throw workflowError;

        successCount++;

      } catch (error) {
        console.error(`Failed to assign category to job ${jobId}:`, error);
        failedCount++;
      }
    }

    return {
      successCount,
      failedCount,
      totalCount: jobIds.length
    };

  } catch (error) {
    console.error('Batch assignment failed:', error);
    return {
      successCount,
      failedCount: jobIds.length - successCount,
      totalCount: jobIds.length
    };
  }
};
