
import { supabase } from "@/integrations/supabase/client";
import { setProperJobOrderInStage } from "@/utils/tracker/jobOrderingService";
import { verifyJobStagesArePending } from "@/utils/tracker/workflowVerificationService";

export interface CategoryAssignmentResult {
  successCount: number;
  errorMessages: string[];
  alreadyAssignedCount: number;
}

export const assignJobCategory = async (
  jobId: string,
  selectedCategoryId: string,
  requiresPartAssignment: boolean,
  partAssignments: Record<string, string>
): Promise<boolean> => {
  
  // Check if job already has workflow stages
  const { data: existingStages, error: stageCheckError } = await supabase
    .from('job_stage_instances')
    .select('id')
    .eq('job_id', jobId)
    .eq('job_table_name', 'production_jobs')
    .limit(1);

  if (stageCheckError) {
    throw new Error(`Stage check failed: ${stageCheckError.message}`);
  }

  if (existingStages && existingStages.length > 0) {
    return false; // Already assigned
  }

  // Get category data for due date calculation and part assignment requirements
  const { data: categoryData, error: categoryError } = await supabase
    .from('categories')
    .select('sla_target_days, requires_part_assignment')
    .eq('id', selectedCategoryId)
    .single();

  if (categoryError) {
    throw new Error(`Category fetch failed: ${categoryError.message}`);
  }

  // Get job's created_at date
  const { data: jobData, error: jobError } = await supabase
    .from('production_jobs')
    .select('created_at')
    .eq('id', jobId)
    .single();

  if (jobError) {
    throw new Error(`Job fetch failed: ${jobError.message}`);
  }

  // Calculate due date
  const createdAt = new Date(jobData.created_at);
  const slaTargetDays = categoryData.sla_target_days || 3;
  const dueDate = new Date(createdAt);
  dueDate.setDate(dueDate.getDate() + slaTargetDays);
  const dueDateString = dueDate.toISOString().split('T')[0];

  // Update job category and due date
  const { error: updateError } = await supabase
    .from('production_jobs')
    .update({ 
      category_id: selectedCategoryId,
      due_date: dueDateString,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (updateError) {
    throw new Error(`Job update failed: ${updateError.message}`);
  }

  // Initialize workflow based on category requirements
  let initSuccess = false;
  
  if (categoryData.requires_part_assignment && Object.keys(partAssignments).length > 0) {
    const { error: initError } = await supabase.rpc('initialize_job_stages', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_category_id: selectedCategoryId
    });

    if (initError) {
      throw new Error(`Part-assignment workflow failed: ${initError.message}`);
    } else {
      initSuccess = true;
    }
  } else {
    const { error: standardError } = await supabase.rpc('initialize_job_stages_auto', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_category_id: selectedCategoryId
    });

    if (standardError) {
      throw new Error(`Workflow failed: ${standardError.message}`);
    } else {
      initSuccess = true;
    }
  }

  if (initSuccess) {
    await setProperJobOrderInStage(jobId, 'production_jobs');
    await verifyJobStagesArePending(jobId, 'production_jobs');
  }

  return true;
};
