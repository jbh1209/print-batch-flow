import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Utility function to trigger queue-based due date calculation after proof approval
 */
export const triggerProofCompletionCalculation = async (
  jobId: string,
  jobTableName: string = 'production_jobs'
): Promise<void> => {
  console.log('🎯 Proof stage completed, triggering queue-based due date calculation...', {
    jobId,
    jobTableName
  });

  
  try {
    const { data: calcData, error: calcError } = await supabase.functions.invoke('calculate-due-dates', {
      body: {
        jobIds: [jobId],
        tableName: jobTableName,
        priority: 'high',
        triggerReason: 'proof_approval'
      }
    });

    if (calcError) {
      console.error('❌ Error triggering queue-based calculation:', calcError);
      toast.error('Failed to update due date after proof approval');
    } else {
      console.log('✅ Queue-based calculation triggered:', calcData);
      toast.success('Due date updated based on current production queue');
    }
  } catch (calcErr) {
    console.error('❌ Error in queue calculation:', calcErr);
    toast.error('Failed to update due date');
  }
};

/**
 * Check if a stage name indicates it's a proof stage
 */
export const isProofStage = (stageName?: string): boolean => {
  if (!stageName) return false;
  return stageName.toLowerCase().includes('proof');
};

/**
 * Get stage information from database to determine if it's a proof stage
 */
export const getStageInfoForProofCheck = async (stageId: string) => {
  
  
  const { data: stageInfo, error } = await supabase
    .from('job_stage_instances')
    .select(`
      id,
      job_id,
      job_table_name,
      production_stage:production_stages(name)
    `)
    .eq('id', stageId)
    .single();

  if (error) {
    console.error('Error fetching stage info for proof check:', error);
    return null;
  }

  return {
    ...stageInfo,
    isProof: isProofStage(stageInfo?.production_stage?.name)
  };
};