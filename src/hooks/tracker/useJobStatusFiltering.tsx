
import { useMemo } from "react";

interface UseJobStatusFilteringProps {
  jobs: any[];
  statusFilter?: string | null;
}

export const useJobStatusFiltering = ({ jobs, statusFilter }: UseJobStatusFilteringProps) => {
  const statusFilteredJobs = useMemo(() => {
    if (!statusFilter) {
      // Default: show production jobs (excluding completed)
      return jobs.filter(job => job.status?.toLowerCase() !== 'completed');
    }
    
    switch (statusFilter) {
      case 'completed':
        return jobs.filter(job => job.status?.toLowerCase() === 'completed');
      case 'in-progress':
        return jobs.filter(job => 
          job.status && ['printing', 'finishing', 'production', 'pre-press', 'packaging'].includes(job.status.toLowerCase())
        );
      case 'pending':
        return jobs.filter(job => 
          job.status?.toLowerCase() === 'pending' || !job.status
        );
      case 'overdue':
        return jobs.filter(job => 
          job.due_date && new Date(job.due_date) < new Date() && job.status?.toLowerCase() !== 'completed'
        );
      default:
        return jobs.filter(job => job.status?.toLowerCase() !== 'completed');
    }
  }, [jobs, statusFilter]);

  return { statusFilteredJobs };
};
