
import { useMemo } from 'react';

interface ProductionJob {
  id: string;
  wo_no: string;
  status: string;
  date?: string | null;
  so_no?: string | null;
  qt_no?: string | null;
  rep?: string | null;
  user_name?: string | null;
  category?: string | null;
  customer?: string | null;
  reference?: string | null;
  qty?: number | null;
  due_date?: string | null;
  location?: string | null;
  highlighted?: boolean;
  qr_code_data?: string | null;
  qr_code_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const useProductionJobStats = (jobs: ProductionJob[]) => {
  // Memoize job filtering by status
  const getJobsByStatus = useMemo(() => {
    const jobsByStatus = jobs.reduce((acc, job) => {
      const status = job.status || 'Pre-Press';
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(job);
      return acc;
    }, {} as Record<string, ProductionJob[]>);

    return (status: string) => {
      return jobsByStatus[status] || [];
    };
  }, [jobs]);

  // Memoize stats calculation
  const getJobStats = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    
    // Initialize all statuses with 0
    const allStatuses = ["Pre-Press", "Printing", "Finishing", "Packaging", "Shipped", "Completed"];
    allStatuses.forEach(status => {
      statusCounts[status] = 0;
    });
    
    // Count actual jobs
    jobs.forEach(job => {
      const status = job.status || 'Pre-Press';
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }
    });

    const stats = {
      total: jobs.length,
      statusCounts
    };

    console.log("Job stats calculated:", stats);
    return () => stats;
  }, [jobs]);

  return {
    getJobsByStatus,
    getJobStats
  };
};
