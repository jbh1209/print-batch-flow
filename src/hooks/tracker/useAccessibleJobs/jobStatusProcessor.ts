
import type { AccessibleJob } from './types';

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
  // Check if job has workflow stages
  if (job.current_stage_status) {
    // Use the current stage status from the database
    if (job.current_stage_status === 'active') return 'active';
    if (job.current_stage_status === 'completed') return 'completed';
    if (job.current_stage_status === 'pending') return 'pending';
  }
  
  // Fallback to overall job status for jobs without workflows
  const status = job.status?.toLowerCase() || '';
  if (['completed', 'finished', 'shipped', 'delivered'].includes(status)) {
    return 'completed';
  }
  
  // Default to pending for new/unstarted jobs
  return 'pending';
};

export const isJobOverdue = (job: AccessibleJob): boolean => {
  if (!job.due_date) return false;
  return new Date(job.due_date) < new Date();
};

export const isJobDueSoon = (job: AccessibleJob): boolean => {
  if (!job.due_date) return false;
  const dueDate = new Date(job.due_date);
  const now = new Date();
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  
  return !isJobOverdue(job) && dueDate <= threeDaysFromNow;
};

export const categorizeJobs = (jobs: AccessibleJob[]): JobCategories => {
  const pendingJobs = jobs.filter(job => processJobStatus(job) === 'pending');
  const activeJobs = jobs.filter(job => processJobStatus(job) === 'active');
  const completedJobs = jobs.filter(job => processJobStatus(job) === 'completed');
  
  const urgentJobs = jobs.filter(job => 
    isJobOverdue(job) || isJobDueSoon(job)
  );

  // Enhanced DTP/Proof job categorization
  const dtpJobs = jobs.filter(job => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    const status = job.status?.toLowerCase() || '';
    
    // Look for DTP in stage name or job status
    return stageName.includes('dtp') || 
           stageName.includes('digital') ||
           status.includes('dtp') ||
           status.includes('pre-press');
  });

  const proofJobs = jobs.filter(job => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    const status = job.status?.toLowerCase() || '';
    
    // Look for proof/proofing in stage name or job status  
    return stageName.includes('proof') ||
           stageName.includes('review') ||
           status.includes('proof');
  });

  return {
    pendingJobs,
    activeJobs,
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
    overdue: jobs.filter(isJobOverdue).length,
    dueSoon: jobs.filter(isJobDueSoon).length
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
  
  if (status === 'active') {
    return {
      text: 'In Progress',
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
      text: 'Overdue',
      className: 'bg-red-500 text-white',
      variant: 'destructive' as const
    };
  }
  
  if (isDueSoon) {
    return {
      text: 'Due Soon',
      className: 'bg-orange-500 text-white',
      variant: 'default' as const
    };
  }
  
  // Show "Ready to Start" for new/pending jobs instead of generic "pending"
  return {
    text: 'Ready to Start',
    className: 'bg-green-600 text-white',
    variant: 'default' as const
  };
};

// Helper to determine if a job is truly new (never been started)
export const isJobNew = (job: AccessibleJob): boolean => {
  return !job.current_stage_status || job.current_stage_status === 'pending';
};

// Helper to get user-friendly status text
export const getJobStatusText = (job: AccessibleJob): string => {
  const status = processJobStatus(job);
  
  if (status === 'active') return 'In Progress';
  if (status === 'completed') return 'Completed';
  
  // For pending jobs, show more specific status
  if (isJobNew(job)) {
    return 'New';
  }
  
  return 'Ready to Start';
};
