
import { useMemo } from 'react';

interface ProductionJob {
  id: string;
  status: string;
  [key: string]: any;
}

export const useProductionJobStats = (jobs: ProductionJob[]) => {
  const getJobsByStatus = (status: string) => {
    return jobs.filter(job => job.status === status);
  };

  const getJobStats = () => {
    const statusCounts: Record<string, number> = {};
    
    // Initialize all statuses with 0
    const allStatuses = ["Pre-Press", "Printing", "Finishing", "Packaging", "Shipped", "Completed"];
    allStatuses.forEach(status => {
      statusCounts[status] = 0;
    });
    
    // Count actual jobs
    jobs.forEach(job => {
      if (job.status && statusCounts.hasOwnProperty(job.status)) {
        statusCounts[job.status]++;
      }
    });

    return {
      total: jobs.length,
      statusCounts
    };
  };

  return {
    getJobsByStatus,
    getJobStats: () => getJobStats()
  };
};
