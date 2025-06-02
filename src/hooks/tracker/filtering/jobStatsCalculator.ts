
import { JobStats } from './types';

export const calculateJobStats = (filteredJobs: any[]): JobStats => {
  const stats: JobStats = {
    total: filteredJobs.length,
    pending: 0,
    inProgress: 0,
    completedToday: 0,
    byStage: {}
  };

  const today = new Date().toDateString();

  filteredJobs.forEach(job => {
    // Count by status patterns
    if (job.status?.toLowerCase() === 'pending' || 
        job.current_stage?.toLowerCase() === 'dtp' ||
        job.stages?.some((s: any) => s.status === 'pending')) {
      stats.pending++;
    }

    if (['in-progress', 'active'].includes(job.status?.toLowerCase() || '') ||
        job.stages?.some((s: any) => s.status === 'active')) {
      stats.inProgress++;
    }

    // Count completed today
    if (job.stages?.some((s: any) => 
      s.status === 'completed' &&
      s.completed_at &&
      new Date(s.completed_at).toDateString() === today
    )) {
      stats.completedToday++;
    }

    // Count by current stage
    if (job.current_stage) {
      stats.byStage[job.current_stage] = (stats.byStage[job.current_stage] || 0) + 1;
    }
  });

  return stats;
};
