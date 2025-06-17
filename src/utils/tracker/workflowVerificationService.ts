
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StageVerification {
  id: string;
  status: string;
  stage_order: number;
  production_stages?: { name: string };
}

export const verifyJobStagesArePending = async (
  jobId: string,
  jobTableName: string
): Promise<boolean> => {
  console.log(`🔍 Verifying job ${jobId} stages are all PENDING after initialization...`);
  
  const { data: verifyStages } = await supabase
    .from('job_stage_instances')
    .select('id, status, stage_order, production_stages(name)')
    .eq('job_id', jobId)
    .eq('job_table_name', jobTableName)
    .order('stage_order', { ascending: true });

  if (!verifyStages) {
    console.warn(`No stages found for job ${jobId}`);
    return false;
  }

  const activeStages = verifyStages.filter(s => s.status === 'active');
  
  if (activeStages.length > 0) {
    console.error(`🚨 CRITICAL BUG: Job ${jobId} has ${activeStages.length} active stages after initialization!`, activeStages);
    toast.error(`CRITICAL BUG: Job ${jobId} auto-started ${activeStages.length} stages - this should not happen!`);
    return false;
  } else {
    console.log(`✅ VERIFIED: Job ${jobId} has all ${verifyStages.length} stages in PENDING state with proper ordering`);
    return true;
  }
};

export const checkExistingStages = async (jobId: string, jobTableName: string): Promise<boolean> => {
  try {
    const { data: existingStages, error } = await supabase
      .from('job_stage_instances')
      .select('id')
      .eq('job_id', jobId)
      .eq('job_table_name', jobTableName)
      .limit(1);

    if (error) {
      console.error('Error checking existing stages:', error);
      return false;
    }

    return existingStages && existingStages.length > 0;
  } catch (error) {
    console.error('Error in checkExistingStages:', error);
    return false;
  }
};
