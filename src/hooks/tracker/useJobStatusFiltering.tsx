
import { useMemo } from "react";
import { isJobCompleted } from "@/utils/tracker/jobCompletionUtils";

interface UseJobStatusFilteringProps {
  jobs: any[];
  statusFilter?: string | null;
}

export const useJobStatusFiltering = ({ jobs, statusFilter }: UseJobStatusFilteringProps) => {
  const statusFilteredJobs = useMemo(() => {
    if (!statusFilter) {
      // Default: show ONLY active jobs (excluding completed)
      return jobs.filter(job => !isJobCompleted(job));
    }
    
    switch (statusFilter) {
      case 'completed':
        // Show ONLY completed jobs
        return jobs.filter(job => isJobCompleted(job));
      case 'in-progress':
        // Active production jobs only
        return jobs.filter(job => 
          !isJobCompleted(job) && 
          job.status && ['Production', 'Printing', 'Finishing', 'Packaging'].includes(job.status)
        );
      case 'pending':
        // New jobs without category assignment
        return jobs.filter(job => 
          !isJobCompleted(job) && 
          (!job.status || job.status === 'Pre-Press')
        );
      case 'overdue':
        // Overdue active jobs only
        return jobs.filter(job => 
          !isJobCompleted(job) && 
          job.due_date && new Date(job.due_date) < new Date()
        );
      default:
        // For any other status filter, show jobs with that exact status (excluding completed)
        return jobs.filter(job => 
          !isJobCompleted(job) && 
          job.status === statusFilter
        );
    }
  }, [jobs, statusFilter]);

  return { statusFilteredJobs };
};
