
import { supabase } from "@/integrations/supabase/client";
import { extractWONumber } from "@/utils/tracker/jobOrderingUtils";

export interface JobStageOrder {
  id: string;
  production_stage_id: string;
  job_id: string;
  woNumber: number;
}

export const setProperJobOrderInStage = async (jobId: string, jobTableName: string): Promise<void> => {
  try {
    console.log('🔧 Setting proper job_order_in_stage for job:', jobId);

    // Get the job's WO number
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

    // Process each stage
    for (const jobStage of jobStages) {
      await setStageOrder(jobStage, woNumber, jobTableName);
    }

  } catch (error) {
    console.error('Error in setProperJobOrderInStage:', error);
  }
};

const setStageOrder = async (
  jobStage: { id: string; production_stage_id: string },
  woNumber: number,
  jobTableName: string
): Promise<void> => {
  // Get existing jobs in this stage
  const { data: existingInStage, error: existingError } = await supabase
    .from('job_stage_instances')
    .select('id, job_order_in_stage, job_id')
    .eq('production_stage_id', jobStage.production_stage_id)
    .eq('job_table_name', jobTableName)
    .neq('id', jobStage.id);

  if (existingError) {
    console.error('Error fetching existing stages:', existingError);
    return;
  }

  let sortedExisting: JobStageOrder[] = [];
  if (existingInStage && existingInStage.length > 0) {
    sortedExisting = await getSortedExistingStages(existingInStage);
  }

  const properOrder = calculateProperOrder(woNumber, sortedExisting);
  await updateStageOrders(jobStage.id, properOrder, sortedExisting);
};

const getSortedExistingStages = async (existingStages: any[]): Promise<JobStageOrder[]> => {
  const jobIds = existingStages.map(stage => stage.job_id);
  const { data: existingJobs, error: jobsError } = await supabase
    .from('production_jobs')
    .select('id, wo_no')
    .in('id', jobIds);

  if (jobsError || !existingJobs) {
    return [];
  }

  return existingStages
    .map(stage => {
      const jobData = existingJobs.find(job => job.id === stage.job_id);
      return {
        ...stage,
        woNumber: jobData ? extractWONumber(jobData.wo_no) : 0
      };
    })
    .sort((a, b) => a.woNumber - b.woNumber);
};

const calculateProperOrder = (woNumber: number, sortedExisting: JobStageOrder[]): number => {
  if (sortedExisting.length === 0) return 1;

  // Find insertion position
  for (let i = 0; i < sortedExisting.length; i++) {
    if (woNumber < sortedExisting[i].woNumber) {
      return i + 1;
    }
  }
  return sortedExisting.length + 1;
};

const updateStageOrders = async (
  stageId: string,
  properOrder: number,
  sortedExisting: JobStageOrder[]
): Promise<void> => {
  // Update existing jobs that should come after this one
  for (let i = properOrder - 1; i < sortedExisting.length; i++) {
    const existingStage = sortedExisting[i];
    await supabase
      .from('job_stage_instances')
      .update({ job_order_in_stage: i + 2 })
      .eq('id', existingStage.id);
  }

  // Update this job's order
  const { error: updateError } = await supabase
    .from('job_stage_instances')
    .update({ job_order_in_stage: properOrder })
    .eq('id', stageId);

  if (updateError) {
    console.error('Error updating job order:', updateError);
  } else {
    console.log(`✅ Set job_order_in_stage to ${properOrder} for stage ${stageId}`);
  }
};
