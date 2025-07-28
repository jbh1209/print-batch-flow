import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DueDateCalculationStatus {
  isCalculating: boolean;
  progress: number;
  totalJobs: number;
  completedJobs: number;
  lastUpdate: Date | null;
}

export const useDueDateCalculation = () => {
  const [status, setStatus] = useState<DueDateCalculationStatus>({
    isCalculating: false,
    progress: 0,
    totalJobs: 0,
    completedJobs: 0,
    lastUpdate: null
  });

  const triggerDueDateCalculation = useCallback(async (
    jobIds: string[],
    tableName: string = 'production_jobs',
    priority: 'low' | 'normal' | 'high' = 'normal'
  ) => {
    if (jobIds.length === 0) return { success: false, error: 'No jobs provided' };

    setStatus({
      isCalculating: true,
      progress: 0,
      totalJobs: jobIds.length,
      completedJobs: 0,
      lastUpdate: new Date()
    });

    try {
      const { data, error } = await supabase.functions.invoke('calculate-due-dates', {
        body: {
          jobIds,
          tableName,
          priority
        }
      });

      if (error) {
        console.error('Due date calculation error:', error);
        setStatus(prev => ({ ...prev, isCalculating: false }));
        return { success: false, error: error.message };
      }

      setStatus(prev => ({
        ...prev,
        isCalculating: false,
        progress: 100,
        completedJobs: data?.totalUpdated || 0,
        lastUpdate: new Date()
      }));

      return { 
        success: true, 
        data: {
          totalUpdated: data?.totalUpdated || 0,
          processedBatches: data?.processedBatches || 0,
          successfulBatches: data?.successfulBatches || 0
        }
      };

    } catch (error) {
      console.error('Failed to trigger due date calculation:', error);
      setStatus(prev => ({ ...prev, isCalculating: false }));
      return { success: false, error: error.message };
    }
  }, []);

  const recalculateAllJobs = useCallback(async () => {
    try {
      // Get all active jobs
      const { data: jobs, error } = await supabase
        .from('production_jobs')
        .select('id')
        .neq('status', 'completed');

      if (error || !jobs) {
        toast.error('Failed to fetch jobs for recalculation');
        return { success: false, error: error?.message || 'No jobs found' };
      }

      const jobIds = jobs.map(job => job.id);
      return await triggerDueDateCalculation(jobIds, 'production_jobs', 'low');

    } catch (error) {
      console.error('Failed to recalculate all jobs:', error);
      return { success: false, error: error.message };
    }
  }, [triggerDueDateCalculation]);

  const recalculateJobsByStage = useCallback(async (stageId: string) => {
    try {
      // Get jobs that have this stage and are not completed
      const { data: stageInstances, error } = await supabase
        .from('job_stage_instances')
        .select('job_id')
        .eq('production_stage_id', stageId)
        .eq('job_table_name', 'production_jobs')
        .neq('status', 'completed');

      if (error || !stageInstances) {
        toast.error('Failed to fetch jobs for stage recalculation');
        return { success: false, error: error?.message || 'No jobs found' };
      }

      const jobIds = [...new Set(stageInstances.map(si => si.job_id))];
      return await triggerDueDateCalculation(jobIds, 'production_jobs', 'high');

    } catch (error) {
      console.error('Failed to recalculate jobs by stage:', error);
      return { success: false, error: error.message };
    }
  }, [triggerDueDateCalculation]);

  return {
    status,
    triggerDueDateCalculation,
    recalculateAllJobs,
    recalculateJobsByStage
  };
};