
import type { AccessibleJob } from './types';

export interface DashboardMetrics {
  totalJobs: number;
  pendingJobs: number;
  activeJobs: number;
  completedJobs: number;
  urgentJobs: number;
  dtpJobs: number;
  proofJobs: number;
  averageProgress: number;
}

export const calculateDashboardMetrics = (jobs: AccessibleJob[]): DashboardMetrics => {
  const pendingJobs = jobs.filter(j => j.current_stage_status === 'pending').length;
  const activeJobs = jobs.filter(j => j.current_stage_status === 'active').length;
  const completedJobs = jobs.filter(j => j.current_stage_status === 'completed').length;
  
  // Calculate urgent jobs (overdue or due soon)
  const urgentJobs = jobs.filter(j => {
    if (!j.due_date) return false;
    const dueDate = new Date(j.due_date);
    const now = new Date();
    const isOverdue = dueDate < now;
    const isDueSoon = !isOverdue && dueDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return isOverdue || isDueSoon;
  }).length;

  // Calculate job type counts
  const dtpJobs = jobs.filter(j => 
    j.current_stage_name?.toLowerCase().includes('dtp') || 
    j.current_stage_name?.toLowerCase().includes('design')
  ).length;
  
  const proofJobs = jobs.filter(j => 
    j.current_stage_name?.toLowerCase().includes('proof') ||
    j.current_stage_name?.toLowerCase().includes('check')
  ).length;

  // Calculate average progress
  const totalProgress = jobs.reduce((sum, job) => sum + (job.workflow_progress || 0), 0);
  const averageProgress = jobs.length > 0 ? Math.round(totalProgress / jobs.length) : 0;

  return {
    totalJobs: jobs.length,
    pendingJobs,
    activeJobs,
    completedJobs,
    urgentJobs,
    dtpJobs,
    proofJobs,
    averageProgress
  };
};

export const formatJobCount = (count: number, label: string): string => {
  return `${count} ${label}${count !== 1 ? 's' : ''}`;
};

export const getJobPriorityClass = (job: AccessibleJob): string => {
  if (!job.due_date) return '';
  
  const dueDate = new Date(job.due_date);
  const now = new Date();
  
  if (dueDate < now) return 'border-l-4 border-red-500 bg-red-50';
  if (dueDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000)) return 'border-l-4 border-orange-500 bg-orange-50';
  if (dueDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)) return 'border-l-4 border-yellow-500 bg-yellow-50';
  
  return '';
};
