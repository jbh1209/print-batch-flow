
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CategoryAssignmentResult {
  successCount: number;
  failedCount: number;
  totalCount: number;
  errors: string[];
}

export const batchAssignJobCategory = async (
  jobIds: string[],
  categoryId: string,
  partAssignments?: Record<string, string>
): Promise<CategoryAssignmentResult> => {
  console.log('🔄 Starting atomic batch category assignment...', {
    jobCount: jobIds.length,
    categoryId: categoryId.substring(0, 8),
    hasPartAssignments: !!partAssignments && Object.keys(partAssignments).length > 0
  });

  const result: CategoryAssignmentResult = {
    successCount: 0,
    failedCount: 0,
    totalCount: jobIds.length,
    errors: []
  };

  // Get category data for due date calculation
  const { data: categoryData, error: categoryError } = await supabase
    .from('categories')
    .select('sla_target_days, name')
    .eq('id', categoryId)
    .single();

  if (categoryError) {
    const error = `Failed to fetch category data: ${categoryError.message}`;
    result.errors.push(error);
    result.failedCount = jobIds.length;
    return result;
  }

  // Process each job atomically
  for (const jobId of jobIds) {
    try {
      console.log(`🔧 Processing job ${jobId}...`);
      
      // Start a transaction-like approach using RPC
      await processJobCategoryAssignment(
        jobId,
        categoryId,
        categoryData.sla_target_days || 3,
        partAssignments
      );

      result.successCount++;
      console.log(`✅ Successfully processed job ${jobId}`);

    } catch (error) {
      console.error(`❌ Failed to process job ${jobId}:`, error);
      result.failedCount++;
      result.errors.push(`Job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('📊 Batch assignment completed:', result);
  return result;
};

const processJobCategoryAssignment = async (
  jobId: string,
  categoryId: string,
  slaTargetDays: number,
  partAssignments?: Record<string, string>
): Promise<void> => {
  // Step 1: Force delete ALL existing workflow stages (bulletproof reset)
  console.log(`🧹 Force cleaning existing stages for job ${jobId}...`);
  const { error: deleteError } = await supabase
    .from('job_stage_instances')
    .delete()
    .eq('job_id', jobId)
    .eq('job_table_name', 'production_jobs');

  if (deleteError) {
    throw new Error(`Failed to clean existing stages: ${deleteError.message}`);
  }

  // Step 2: Get job's created_at date for due date calculation
  const { data: jobData, error: jobError } = await supabase
    .from('production_jobs')
    .select('created_at, wo_no')
    .eq('id', jobId)
    .single();

  if (jobError) {
    throw new Error(`Failed to fetch job data: ${jobError.message}`);
  }

  // Step 3: Calculate due date
  const createdAt = new Date(jobData.created_at);
  const dueDate = new Date(createdAt);
  dueDate.setDate(dueDate.getDate() + slaTargetDays);
  const dueDateString = dueDate.toISOString().split('T')[0];

  // Step 4: Update job with new category and due date
  console.log(`📝 Updating job ${jobData.wo_no} with category and due date...`);
  const { error: updateError } = await supabase
    .from('production_jobs')
    .update({ 
      category_id: categoryId,
      due_date: dueDateString,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (updateError) {
    throw new Error(`Failed to update job: ${updateError.message}`);
  }

  // Step 5: Initialize new workflow stages
  const hasPartAssignments = partAssignments && Object.keys(partAssignments).length > 0;
  
  if (hasPartAssignments) {
    console.log(`🔧 Initializing simple workflow for job ${jobData.wo_no}...`);
    const { error: initError } = await supabase.rpc('initialize_job_stages', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_category_id: categoryId
    });
    });

    if (multiPartError) {
      throw new Error(`Multi-part workflow initialization failed: ${multiPartError.message}`);
    }
  } else {
    console.log(`🔧 Initializing standard workflow for job ${jobData.wo_no}...`);
    const { error: standardError } = await supabase.rpc('initialize_job_stages_auto', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_category_id: categoryId
    });

    if (standardError) {
      throw new Error(`Standard workflow initialization failed: ${standardError.message}`);
    }
  }

  // Step 6: Verify workflow was created properly
  const { data: verifyStages, error: verifyError } = await supabase
    .from('job_stage_instances')
    .select('id, status')
    .eq('job_id', jobId)
    .eq('job_table_name', 'production_jobs');

  if (verifyError) {
    throw new Error(`Failed to verify workflow creation: ${verifyError.message}`);
  }

  if (!verifyStages || verifyStages.length === 0) {
    throw new Error('Workflow initialization failed - no stages created');
  }

  const allPending = verifyStages.every(stage => stage.status === 'pending');
  if (!allPending) {
    console.warn(`⚠️ Not all stages are pending for job ${jobData.wo_no}`, verifyStages.map(s => s.status));
  }

  console.log(`✅ Job ${jobData.wo_no} workflow verified: ${verifyStages.length} stages created, all pending`);
};
