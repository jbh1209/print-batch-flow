import { useMemo } from 'react';
import { useAccessibleJobs } from './useAccessibleJobs';
import { format, parseISO } from 'date-fns';

export const useProductionCalendar = () => {
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs();

  // Group jobs by due date for calendar display
  const jobsByDate = useMemo(() => {
    const grouped: Record<string, typeof jobs> = {};
    
    jobs.forEach(job => {
      // Use due_date as the calendar date
      const targetDate = job.due_date;
      if (!targetDate) return;
      
      try {
        const dateKey = format(parseISO(targetDate), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(job);
      } catch (error) {
        console.warn('Invalid date format for job:', job.job_id, targetDate);
      }
    });
    
    return grouped;
  }, [jobs]);

  return {
    jobs,
    jobsByDate,
    isLoading,
    error,
    startJob,
    completeJob,
    refreshJobs
  };
};