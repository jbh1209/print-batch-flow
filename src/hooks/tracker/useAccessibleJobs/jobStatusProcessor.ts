import type { AccessibleJob } from './types';
import { isJobCompleted } from '@/utils/tracker/jobCompletionUtils';

export interface ProcessedJobCounts {
  total: number;
  pending: number;
  active: number;
  completed: number;
  overdue: number;
  dueSoon: number;
}

export interface JobCategories {
  pendingJobs: AccessibleJob[];
  activeJobs: AccessibleJob[];
  completedJobs: AccessibleJob[];
  urgentJobs: AccessibleJob[];
  dtpJobs: AccessibleJob[];
  proofJobs: AccessibleJob[];
}

export const processJobStatus = (job: AccessibleJob): 'pending' | 'active' | 'completed' => {
  // Use the standardized completion check first
  if (isJobCompleted(job)) {
    return 'completed';
  }

  // Check if job has workflow stages - prioritize workflow status
  if (job.current_stage_status) {
    if (job.current_stage_status === 'active') return 'active';
    if (job.current_stage_status === 'pending') return 'pending';
  }
  
  // Check if job has any active workflow
  if (job.workflow_progress !== undefined && job.workflow_progress > 0 && job.workflow_progress < 100) {
    return 'active';
  }
  
  // Fallback to job status for jobs without workflows
  const status = job.status?.toLowerCase() || '';
  
  // Check for active status indicators
  const activeStatuses = ['printing', 'finishing', 'production', 'pre-press', 'packaging', 'active', 'in-progress'];
  if (activeStatuses.some(activeStatus => status.includes(activeStatus))) {
    return 'active';
  }
  
  // Default to pending for new/unstarted jobs
  return 'pending';
};

export const isJobOverdue = (job: AccessibleJob): boolean => {
  if (!job.due_date || isJobCompleted(job)) return false;
  return new Date(job.due_date) < new Date();
};

export const isJobDueSoon = (job: AccessibleJob): boolean => {
  if (!job.due_date || isJobCompleted(job)) return false;
  const dueDate = new Date(job.due_date);
  const now = new Date();
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  
  return !isJobOverdue(job) && dueDate <= threeDaysFromNow;
};

export const categorizeJobs = (jobs: AccessibleJob[]): JobCategories => {
  // Filter out completed jobs for active categories
  const activeJobs = jobs.filter(job => !isJobCompleted(job));
  
  const pendingJobs = activeJobs.filter(job => processJobStatus(job) === 'pending');
  const activeJobsList = activeJobs.filter(job => processJobStatus(job) === 'active');
  const completedJobs = jobs.filter(job => isJobCompleted(job));
  
  const urgentJobs = activeJobs.filter(job => 
    isJobOverdue(job) || isJobDueSoon(job)
  );

  // Enhanced DTP/Proof job categorization using actual stage names
  const dtpJobs = activeJobs.filter(job => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    const status = job.status?.toLowerCase() || '';
    
    // Look for DTP in stage name or job status
    return stageName.includes('dtp') || 
           stageName.includes('digital') ||
           stageName.includes('pre-press') ||
           status.includes('dtp');
  });

  const proofJobs = activeJobs.filter(job => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    const status = job.status?.toLowerCase() || '';
    
    // Look for proof/proofing in stage name or job status  
    return stageName.includes('proof') ||
           stageName.includes('review') ||
           status.includes('proof');
  });

  return {
    pendingJobs,
    activeJobs: activeJobsList,
    completedJobs,
    urgentJobs,
    dtpJobs,
    proofJobs
  };
};

export const calculateJobCounts = (jobs: AccessibleJob[]): ProcessedJobCounts => {
  const categories = categorizeJobs(jobs);
  
  return {
    total: jobs.length,
    pending: categories.pendingJobs.length,
    active: categories.activeJobs.length,
    completed: categories.completedJobs.length,
    overdue: jobs.filter(job => !isJobCompleted(job) && isJobOverdue(job)).length,
    dueSoon: jobs.filter(job => !isJobCompleted(job) && isJobDueSoon(job)).length
  };
};

export const sortJobsByPriority = (jobs: AccessibleJob[]): AccessibleJob[] => {
  return [...jobs].sort((a, b) => {
    // Active jobs first
    const aStatus = processJobStatus(a);
    const bStatus = processJobStatus(b);
    
    if (aStatus === 'active' && bStatus !== 'active') return -1;
    if (bStatus === 'active' && aStatus !== 'active') return 1;
    
    // Then by urgency (overdue first, then due soon)
    const aOverdue = isJobOverdue(a);
    const bOverdue = isJobOverdue(b);
    
    if (aOverdue && !bOverdue) return -1;
    if (bOverdue && !aOverdue) return 1;
    
    const aDueSoon = isJobDueSoon(a);
    const bDueSoon = isJobDueSoon(b);
    
    if (aDueSoon && !bDueSoon) return -1;
    if (bDueSoon && !aDueSoon) return 1;
    
    // Finally by due date
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    
    return 0;
  });
};

export const canStartJob = (job: AccessibleJob): boolean => {
  return job.user_can_work && 
         job.current_stage_id && 
         processJobStatus(job) === 'pending';
};

export const canCompleteJob = (job: AccessibleJob): boolean => {
  return job.user_can_work && 
         job.current_stage_id && 
         processJobStatus(job) === 'active';
};

export const getJobStatusBadgeInfo = (job: AccessibleJob) => {
  const status = processJobStatus(job);
  const isOverdue = isJobOverdue(job);
  const isDueSoon = isJobDueSoon(job);
  
  // Use actual stage name for display
  const displayText = job.current_stage_name || job.current_stage_id || job.status || 'No Workflow';
  
  if (status === 'active') {
    return {
      text: displayText,
      className: 'bg-blue-500 text-white',
      variant: 'default' as const
    };
  }
  
  if (status === 'completed') {
    return {
      text: 'Completed',
      className: 'bg-green-500 text-white',
      variant: 'default' as const
    };
  }
  
  // Pending status - check urgency and show proper ready state
  if (isOverdue) {
    return {
      text: `${displayText} (Overdue)`,
      className: 'bg-red-500 text-white',
      variant: 'destructive' as const
    };
  }
  
  if (isDueSoon) {
    return {
      text: `${displayText} (Due Soon)`,
      className: 'bg-orange-500 text-white',
      variant: 'default' as const
    };
  }
  
  // Show the actual stage name for pending jobs
  return {
    text: displayText,
    className: 'bg-green-600 text-white',
    variant: 'default' as const
  };
};

// Helper to determine if a job is truly new (never been started)
export const isJobNew = (job: AccessibleJob): boolean => {
  return !job.current_stage_status || job.current_stage_status === 'pending';
};

// Helper to get user-friendly status text based on actual workflow stage
export const getJobStatusText = (job: AccessibleJob): string => {
  const status = processJobStatus(job);
  
  if (status === 'active') return job.current_stage_name || 'In Progress';
  if (status === 'completed') return 'Completed';
  
  // For pending jobs, show the actual stage name they're waiting for
  if (job.current_stage_name) {
    return `Ready for ${job.current_stage_name}`;
  }
  
  return 'New';
};
