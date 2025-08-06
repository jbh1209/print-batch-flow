import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QueueSchedulerStatus {
  isCalculating: boolean;
  lastCalculation?: string;
  jobsProcessed?: number;
  error?: string;
}

export const useQueueScheduler = () => {
  const [status, setStatus] = useState<QueueSchedulerStatus>({
    isCalculating: false,
  });

  const triggerProofCompletion = useCallback(async (jobId: string, stageId: string) => {
    setStatus(prev => ({ ...prev, isCalculating: true, error: undefined }));
    
    try {
      // Complete the proof stage
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId);

      if (completeError) {
        throw new Error(`Failed to complete proof stage: ${completeError.message}`);
      }

      // Trigger due date recalculation for all affected jobs
      const { data: calcData, error: calcError } = await supabase.functions.invoke('calculate-due-dates', {
        body: {
          action: 'recalculate_all',
          trigger_reason: `Proof completion for job ${jobId}`
        }
      });

      if (calcError) {
        throw new Error(`Due date calculation failed: ${calcError.message}`);
      }

      if (calcData?.success) {
        setStatus(prev => ({
          ...prev,
          lastCalculation: new Date().toISOString(),
          jobsProcessed: calcData.jobs_processed
        }));
        
        toast.success(`Proof approved! Updated due dates for ${calcData.jobs_processed} jobs in production queue`);
        return true;
      } else {
        throw new Error(calcData?.error || 'Due date calculation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(prev => ({ ...prev, error: errorMessage }));
      toast.error(`Queue update failed: ${errorMessage}`);
      return false;
    } finally {
      setStatus(prev => ({ ...prev, isCalculating: false }));
    }
  }, []);

  const recalculateAllDueDates = useCallback(async (reason = 'Manual recalculation') => {
    setStatus(prev => ({ ...prev, isCalculating: true, error: undefined }));
    
    try {
      const { data, error } = await supabase.functions.invoke('calculate-due-dates', {
        body: {
          action: 'recalculate_all',
          trigger_reason: reason
        }
      });

      if (error) {
        throw new Error(`Calculation failed: ${error.message}`);
      }

      if (data?.success) {
        setStatus(prev => ({
          ...prev,
          lastCalculation: new Date().toISOString(),
          jobsProcessed: data.jobs_processed
        }));
        
        toast.success(`Recalculated due dates for ${data.jobs_processed} production-ready jobs`);
        return true;
      } else {
        throw new Error(data?.error || 'Calculation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(prev => ({ ...prev, error: errorMessage }));
      toast.error(`Recalculation failed: ${errorMessage}`);
      return false;
    } finally {
      setStatus(prev => ({ ...prev, isCalculating: false }));
    }
  }, []);

  const expediteJob = useCallback(async (jobId: string) => {
    setStatus(prev => ({ ...prev, isCalculating: true, error: undefined }));
    
    try {
      // Set expedited flag
      const { error: expediteError } = await supabase
        .from('production_jobs')
        .update({
          is_expedited: true,
          expedited_at: new Date().toISOString(),
          expedited_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (expediteError) {
        throw new Error(`Failed to expedite job: ${expediteError.message}`);
      }

      // Recalculate queue with expedited job prioritized
      const success = await recalculateAllDueDates(`Job ${jobId} expedited`);
      
      if (success) {
        toast.success('Job expedited and queue updated');
      }
      
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(prev => ({ ...prev, error: errorMessage }));
      toast.error(`Expedite failed: ${errorMessage}`);
      return false;
    } finally {
      setStatus(prev => ({ ...prev, isCalculating: false }));
    }
  }, [recalculateAllDueDates]);

  return {
    status,
    triggerProofCompletion,
    recalculateAllDueDates,
    expediteJob
  };
};