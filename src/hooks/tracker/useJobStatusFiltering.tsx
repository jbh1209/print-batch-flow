
import { useMemo } from "react";
import { isJobCompleted } from "@/utils/tracker/jobCompletionUtils";

interface UseJobStatusFilteringProps {
  jobs: any[];
  statusFilter?: string | null;
}

export const useJobStatusFiltering = ({ jobs, statusFilter }: UseJobStatusFilteringProps) => {
  const statusFilteredJobs = useMemo(() => {
    if (!statusFilter) {
      // Default: show active jobs (excluding completed)
      return jobs.filter(job => !isJobCompleted(job));
    }
    
    switch (statusFilter) {
      case 'completed':
        return jobs.filter(job => isJobCompleted(job));
      case 'in-progress':
        return jobs.filter(job => 
          !isJobCompleted(job) && 
          job.status && ['printing', 'finishing', 'production', 'pre-press', 'packaging'].includes(job.status.toLowerCase())
        );
      case 'pending':
        return jobs.filter(job => 
          !isJobCompleted(job) && 
          (job.status?.toLowerCase() === 'pending' || job.status?.toLowerCase() === 'pre-press' || !job.status)
        );
      case 'overdue':
        return jobs.filter(job => 
          !isJobCompleted(job) && 
          job.due_date && new Date(job.due_date) < new Date()
        );
      default:
        // For any other status filter, show jobs with that exact status (unless completed)
        return jobs.filter(job => 
          !isJobCompleted(job) && 
          job.status?.toLowerCase() === statusFilter.toLowerCase()
        );
    }
  }, [jobs, statusFilter]);

  return { statusFilteredJobs };
};
