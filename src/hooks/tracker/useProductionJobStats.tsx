
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
  const getJobsByStatus = useMemo(() => {
    return (status: string) => {
      return jobs.filter(job => job.status === status);
    };
  }, [jobs]);

  const getJobStats = useMemo(() => {
    return () => {
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

      console.log("Job stats calculated:", { total: jobs.length, statusCounts });

      return {
        total: jobs.length,
        statusCounts
      };
    };
  }, [jobs]);

  return {
    getJobsByStatus,
    getJobStats
  };
};
