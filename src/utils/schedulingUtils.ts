/**
 * SCHEDULING UTILITIES
 * 
 * This file contains utility functions specifically for the Weekly Schedule Board.
 * These functions handle job scheduling, capacity planning, and timeline management
 * for jobs that have completed proof approval and are in production.
 * 
 * DO NOT modify these functions for workflow purposes - use productionWorkflowUtils.ts instead.
 */

export interface SchedulingStageInfo {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  scheduled_start?: string;
  scheduled_end?: string;
  scheduled_minutes?: number;
  status: string;
  stage_order: number;
}

export interface ScheduledJobData {
  job_id: string;
  wo_no: string;
  customer: string;
  scheduled_stages: SchedulingStageInfo[];
  total_production_time?: number;
  estimated_completion?: string;
}

/**
 * Get all scheduled stages for a job in the Weekly Schedule Board.
 * This function shows the complete production timeline for approved jobs.
 * 
 * @param jobStages - All job stage instances for the job
 * @param jobId - The job ID to analyze
 * @returns Array of all scheduled production stages for this job
 */
export const getJobScheduledStages = (
  jobStages: any[], 
  jobId: string
): SchedulingStageInfo[] => {
  if (!jobStages || jobStages.length === 0) return [];
  
  // Get all stages for this job that are scheduled or active
  const jobScheduledStages = jobStages.filter(stage => 
    stage.job_id === jobId &&
    (stage.scheduled_start_at || stage.status === 'active' || stage.status === 'pending')
  );
  
  if (jobScheduledStages.length === 0) return [];
  
  // Map to scheduling stage info
  return jobScheduledStages.map(stage => ({
    stage_id: stage.unique_stage_key || stage.production_stage_id,
    stage_name: stage.production_stages?.name || stage.stage_name,
    stage_color: stage.production_stages?.color || stage.stage_color || '#6B7280',
    scheduled_start: stage.scheduled_start_at,
    scheduled_end: stage.scheduled_end_at,
    scheduled_minutes: stage.scheduled_minutes,
    status: stage.status,
    stage_order: stage.stage_order
  })).sort((a, b) => a.stage_order - b.stage_order);
};

/**
 * Check if a job should appear in the scheduling board.
 * Only shows jobs that have completed proof approval and are in production.
 */
export const shouldJobAppearInSchedule = (job: any): boolean => {
  // Only show jobs that are past the proof stage
  const isApproved = job.status !== 'Pending Proof' && 
                    job.status !== 'Awaiting Customer Approval' &&
                    job.status !== 'Draft';
                    
  // Don't show completed jobs in scheduling
  const isInProduction = job.status !== 'Completed' && 
                        job.status !== 'Cancelled';
  
  return isApproved && isInProduction;
};

/**
 * Get all jobs that should appear in the scheduling board for a specific stage.
 * Used by Weekly Schedule Board stage columns.
 */
export const getJobsForSchedulingStage = (
  jobs: any[],
  jobStagesMap: Map<string, any[]>,
  stageId: string
): any[] => {
  return jobs.filter(job => {
    // Only include jobs that should appear in scheduling
    if (!shouldJobAppearInSchedule(job)) return false;
    
    const jobStages = jobStagesMap.get(job.job_id) || [];
    const scheduledStages = getJobScheduledStages(jobStages, job.job_id);
    
    return scheduledStages.some(stage => 
      stage.stage_id === stageId || 
      stage.stage_id === stageId
    );
  });
};

/**
 * Calculate total production time for a job based on scheduled stages.
 */
export const calculateJobProductionTime = (scheduledStages: SchedulingStageInfo[]): number => {
  return scheduledStages.reduce((total, stage) => {
    return total + (stage.scheduled_minutes || 0);
  }, 0);
};

/**
 * Get the estimated completion date for a job based on its scheduled stages.
 */
export const getJobEstimatedCompletion = (scheduledStages: SchedulingStageInfo[]): string | null => {
  const completionDates = scheduledStages
    .map(stage => stage.scheduled_end)
    .filter(date => date !== null && date !== undefined)
    .map(date => new Date(date!));
  
  if (completionDates.length === 0) return null;
  
  const latestDate = new Date(Math.max(...completionDates.map(d => d.getTime())));
  return latestDate.toISOString();
};

/**
 * Group jobs by their scheduled week for calendar display.
 */
export const groupJobsByScheduledWeek = (
  jobs: any[],
  jobStagesMap: Map<string, any[]>
): Record<string, ScheduledJobData[]> => {
  const groupedJobs: Record<string, ScheduledJobData[]> = {};
  
  jobs.forEach(job => {
    if (!shouldJobAppearInSchedule(job)) return;
    
    const jobStages = jobStagesMap.get(job.job_id) || [];
    const scheduledStages = getJobScheduledStages(jobStages, job.job_id);
    
    if (scheduledStages.length === 0) return;
    
    // Find the earliest scheduled start date
    const startDates = scheduledStages
      .map(stage => stage.scheduled_start)
      .filter(date => date !== null && date !== undefined)
      .map(date => new Date(date!));
    
    if (startDates.length === 0) return;
    
    const earliestStart = new Date(Math.min(...startDates.map(d => d.getTime())));
    const weekKey = `${earliestStart.getFullYear()}-W${getWeekNumber(earliestStart)}`;
    
    if (!groupedJobs[weekKey]) {
      groupedJobs[weekKey] = [];
    }
    
    groupedJobs[weekKey].push({
      job_id: job.job_id,
      wo_no: job.wo_no || '',
      customer: job.customer || 'Unknown',
      scheduled_stages: scheduledStages,
      total_production_time: calculateJobProductionTime(scheduledStages),
      estimated_completion: getJobEstimatedCompletion(scheduledStages)
    });
  });
  
  return groupedJobs;
};

/**
 * Helper function to get ISO week number.
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}