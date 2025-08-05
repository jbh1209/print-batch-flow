import { useMemo, useEffect, useState } from 'react';
import { useAccessibleJobs } from './useAccessibleJobs';
import { advancedSchedulingEngine } from '@/services/advancedSchedulingEngine';
import { format, parseISO, addDays, startOfWeek } from 'date-fns';

interface JobWithScheduling {
  job_id: string;
  wo_no: string;
  customer: string;
  current_stage_id: string;
  current_stage_name: string;
  current_stage_status: string;
  display_stage_name: string;
  workflow_progress: number;
  user_can_work: boolean;
  // Scheduling data
  scheduledDate?: Date;
  queuePosition?: number;
  estimatedStartDate?: Date;
  estimatedCompletionDate?: Date;
  isBottleneck?: boolean;
}

export const useProductionCalendar = () => {
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs();
  const [jobsWithScheduling, setJobsWithScheduling] = useState<JobWithScheduling[]>([]);
  const [isCalculatingSchedules, setIsCalculatingSchedules] = useState(false);

  // Calculate advanced schedules for all jobs
  useEffect(() => {
    const calculateSchedulesForJobs = async () => {
      if (!jobs.length || isLoading) return;
      
      setIsCalculatingSchedules(true);
      try {
        const scheduledJobs: JobWithScheduling[] = [];
        
        for (const job of jobs) {
          try {
            // Get advanced schedule for each job
            const schedule = await advancedSchedulingEngine.calculateAdvancedSchedule(
              job.job_id,
              'production_jobs',
              job.workflow_progress > 50 ? 70 : 50 // Higher priority for jobs further along
            );

            // Find the current stage in the timeline
            const currentStageSchedule = schedule.queuePositions.find(
              pos => pos.stageId === job.current_stage_id
            );

            scheduledJobs.push({
              job_id: job.job_id,
              wo_no: job.wo_no,
              customer: job.customer,
              current_stage_id: job.current_stage_id,
              current_stage_name: job.current_stage_name,
              current_stage_status: job.current_stage_status,
              display_stage_name: job.display_stage_name,
              workflow_progress: job.workflow_progress,
              user_can_work: job.user_can_work,
              // Add scheduling information
              scheduledDate: currentStageSchedule?.estimatedStartDate,
              queuePosition: currentStageSchedule?.position,
              estimatedStartDate: currentStageSchedule?.estimatedStartDate,
              estimatedCompletionDate: currentStageSchedule?.estimatedCompletionDate,
              isBottleneck: currentStageSchedule?.isBottleneck || false
            });
          } catch (error) {
            console.warn(`Failed to calculate schedule for job ${job.job_id}:`, error);
            // Fall back to original job data without scheduling
            scheduledJobs.push({
              job_id: job.job_id,
              wo_no: job.wo_no,
              customer: job.customer,
              current_stage_id: job.current_stage_id,
              current_stage_name: job.current_stage_name,
              current_stage_status: job.current_stage_status,
              display_stage_name: job.display_stage_name,
              workflow_progress: job.workflow_progress,
              user_can_work: job.user_can_work
            });
          }
        }
        
        setJobsWithScheduling(scheduledJobs);
      } catch (error) {
        console.error('Error calculating job schedules:', error);
        // Fall back to original jobs without scheduling data
        setJobsWithScheduling(jobs.map(job => ({
          job_id: job.job_id,
          wo_no: job.wo_no,
          customer: job.customer,
          current_stage_id: job.current_stage_id,
          current_stage_name: job.current_stage_name,
          current_stage_status: job.current_stage_status,
          display_stage_name: job.display_stage_name,
          workflow_progress: job.workflow_progress,
          user_can_work: job.user_can_work
        })));
      } finally {
        setIsCalculatingSchedules(false);
      }
    };

    calculateSchedulesForJobs();
  }, [jobs, isLoading]);

  // Group jobs by their calculated scheduled date (not due date)
  const jobsByDate = useMemo(() => {
    const grouped: Record<string, JobWithScheduling[]> = {};
    
    jobsWithScheduling.forEach(job => {
      // Use the calculated scheduled date for current stage, or fall back to today
      const targetDate = job.scheduledDate || new Date();
      
      try {
        const dateKey = format(targetDate, 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(job);
      } catch (error) {
        console.warn('Invalid scheduled date for job:', job.job_id, targetDate);
        // Fall back to today
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        if (!grouped[todayKey]) {
          grouped[todayKey] = [];
        }
        grouped[todayKey].push(job);
      }
    });
    
    // Sort jobs within each day by queue position
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => {
        // Bottleneck stages first
        if (a.isBottleneck && !b.isBottleneck) return -1;
        if (!a.isBottleneck && b.isBottleneck) return 1;
        // Then by queue position
        return (a.queuePosition || 999) - (b.queuePosition || 999);
      });
    });
    
    return grouped;
  }, [jobsWithScheduling]);

  return {
    jobs: jobsWithScheduling,
    jobsByDate,
    isLoading: isLoading || isCalculatingSchedules,
    error,
    startJob,
    completeJob,
    refreshJobs
  };
};