
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  hasMultiPartStages: boolean,
  partAssignments: Record<string, string>
): Promise<boolean> => {
  console.log(`🔄 Processing job ${jobId}...`);
  
  // Check if job already has workflow stages
  const { data: existingStages, error: stageCheckError } = await supabase
    .from('job_stage_instances')
    .select('id')
    .eq('job_id', jobId)
    .eq('job_table_name', 'production_jobs')
    .limit(1);

  if (stageCheckError) {
    console.error('❌ Error checking existing stages:', stageCheckError);
    throw new Error(`Stage check failed: ${stageCheckError.message}`);
  }

  if (existingStages && existingStages.length > 0) {
    console.log(`⚠️ Job ${jobId} already has workflow stages`);
    return false; // Indicates already assigned
  }

  // Get category data to calculate due date
  const { data: categoryData, error: categoryError } = await supabase
    .from('categories')
    .select('sla_target_days')
    .eq('id', selectedCategoryId)
    .single();

  if (categoryError) {
    console.error('❌ Error fetching category data:', categoryError);
    throw new Error(`Category fetch failed: ${categoryError.message}`);
  }

  // Get job's created_at date to calculate due date
  const { data: jobData, error: jobError } = await supabase
    .from('production_jobs')
    .select('created_at')
    .eq('id', jobId)
    .single();

  if (jobError) {
    console.error('❌ Error fetching job data:', jobError);
    throw new Error(`Job fetch failed: ${jobError.message}`);
  }

  // Calculate due date: created_at + sla_target_days
  const createdAt = new Date(jobData.created_at);
  const slaTargetDays = categoryData.sla_target_days || 3;
  const dueDate = new Date(createdAt);
  dueDate.setDate(dueDate.getDate() + slaTargetDays);
  const dueDateString = dueDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD

  console.log(`📅 Calculated due date for job ${jobId}: ${dueDateString} (${slaTargetDays} days from ${createdAt.toDateString()})`);

  // Update the job's category and due date
  const { error: updateError } = await supabase
    .from('production_jobs')
    .update({ 
      category_id: selectedCategoryId,
      due_date: dueDateString,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (updateError) {
    console.error('❌ Error updating job category and due date:', updateError);
    throw new Error(`Job update failed: ${updateError.message}`);
  }

  console.log(`✅ Updated job ${jobId} category to ${selectedCategoryId} with due date ${dueDateString}`);

  // Initialize workflow
  let initSuccess = false;
  
  if (hasMultiPartStages && Object.keys(partAssignments).length > 0) {
    console.log(`🔧 Initializing multi-part workflow for job ${jobId} (ALL STAGES PENDING)...`);
    
    const { error: multiPartError } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_category_id: selectedCategoryId,
      p_part_assignments: partAssignments
    });

    if (multiPartError) {
      console.error('❌ Multi-part workflow initialization error:', multiPartError);
      throw new Error(`Multi-part workflow failed: ${multiPartError.message}`);
    } else {
      initSuccess = true;
      console.log(`✅ Multi-part workflow initialized for job ${jobId} - SETTING PROPER ORDER`);
    }
  } else {
    console.log(`🔧 Initializing standard workflow for job ${jobId} (ALL STAGES PENDING)...`);
    
    const { error: standardError } = await supabase.rpc('initialize_job_stages_auto', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_category_id: selectedCategoryId
    });

    if (standardError) {
      console.error('❌ Standard workflow initialization error:', standardError);
      throw new Error(`Workflow failed: ${standardError.message}`);
    } else {
      initSuccess = true;
      console.log(`✅ Standard workflow initialized for job ${jobId} - SETTING PROPER ORDER`);
    }
  }

  if (initSuccess) {
    await setProperJobOrderInStage(jobId, 'production_jobs');
    await verifyJobStagesArePending(jobId, 'production_jobs');
  }

  return true;
};
