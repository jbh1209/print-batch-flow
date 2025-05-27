
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
  const getJobsByStatus = (status: string) => {
    return jobs.filter(job => job.status === status);
  };

  const getJobStats = () => {
    const totalJobs = jobs.length;
    const statusCounts = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: totalJobs,
      statusCounts
    };
  };

  return {
    getJobsByStatus,
    getJobStats
  };
};
