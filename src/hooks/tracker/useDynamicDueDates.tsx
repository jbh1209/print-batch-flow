import { useState, useCallback } from 'react';
import { useWorkflowFirstScheduling } from './useWorkflowFirstScheduling';

interface DueDateWarning {
  jobId: string;
  woNo: string;
  warningLevel: string;
  daysOverdue: number;
}

interface JobWithWarning {
  id: string;
  wo_no: string;
  customer: string;
  due_date: string;
  internal_completion_date: string;
  due_date_warning_level: string;
  days_overdue: number;
}

export const useDynamicDueDates = () => {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [warnings, setWarnings] = useState<DueDateWarning[]>([]);
  const [warningJobs, setWarningJobs] = useState<JobWithWarning[]>([]);
  const { scheduleJob, recalculateAllJobs } = useWorkflowFirstScheduling();

  const calculateInitialDueDate = useCallback(async (
    jobId: string, 
    jobTableName: string = 'production_jobs'
  ) => {
    try {
      const result = await scheduleJob(jobId, jobTableName);
      return result ? {
        internalCompletionDate: new Date(result.scheduledCompletionDate),
        dueDateWithBuffer: new Date(result.scheduledCompletionDate),
        bufferDays: 1,
        totalWorkingDays: 5
      } : null;
    } catch (error) {
      console.error('Failed to calculate initial due date:', error);
      return null;
    }
  }, [scheduleJob]);

  const recalculateJobDueDates = useCallback(async (jobIds?: string[]) => {
    setIsRecalculating(true);
    try {
      const result = await recalculateAllJobs();
      setWarnings([]);
      return { updated: result?.successful || 0, warnings: [] };
    } catch (error) {
      console.error('Failed to recalculate due dates:', error);
      return { updated: 0, warnings: [] };
    } finally {
      setIsRecalculating(false);
    }
  }, [recalculateAllJobs]);

  const getJobsWithWarnings = useCallback(async () => {
    try {
      // Mock implementation - would query database for jobs with warnings
      setWarningJobs([]);
      return [];
    } catch (error) {
      console.error('Failed to get jobs with warnings:', error);
      return [];
    }
  }, []);

  const triggerRecalculationForAffectedJobs = useCallback(async (
    stageId?: string, 
    jobId?: string
  ) => {
    try {
      await recalculateAllJobs();
    } catch (error) {
      console.error('Failed to trigger recalculation for affected jobs:', error);
    }
  }, [recalculateAllJobs]);

  const getWarningCounts = useCallback(() => {
    return {
      green: warningJobs.filter(j => j.due_date_warning_level === 'green').length,
      amber: warningJobs.filter(j => j.due_date_warning_level === 'amber').length,
      red: warningJobs.filter(j => j.due_date_warning_level === 'red').length,
      critical: warningJobs.filter(j => j.due_date_warning_level === 'critical').length,
      total: warningJobs.length
    };
  }, [warningJobs]);

  return {
    // State
    isRecalculating,
    warnings,
    warningJobs,
    
    // Actions
    calculateInitialDueDate,
    recalculateJobDueDates,
    getJobsWithWarnings,
    triggerRecalculationForAffectedJobs,
    
    // Computed
    getWarningCounts
  };
};