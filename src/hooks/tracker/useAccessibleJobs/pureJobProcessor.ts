
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

export interface JobStatusBadgeInfo {
  text: string;
  className: string;
  variant: 'default' | 'destructive' | 'secondary' | 'outline';
}

// Pure function to determine job status from current stage status
export const processJobStatus = (job: AccessibleJob): 'pending' | 'active' | 'completed' => {
  if (job.current_stage_status === 'active') return 'active';
  if (job.current_stage_status === 'completed') return 'completed';
  return 'pending';
};

// Pure function to check if job is overdue
export const isJobOverdue = (job: AccessibleJob): boolean => {
  if (!job.due_date) return false;
  return new Date(job.due_date) < new Date();
};

// Pure function to check if job is due soon
export const isJobDueSoon = (job: AccessibleJob): boolean => {
  if (!job.due_date) return false;
  const dueDate = new Date(job.due_date);
  const now = new Date();
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  
  return !isJobOverdue(job) && dueDate <= threeDaysFromNow;
};

// Pure function to categorize jobs
export const categorizeJobs = (jobs: AccessibleJob[]): JobCategories => {
  const pendingJobs = jobs.filter(job => processJobStatus(job) === 'pending');
  const activeJobs = jobs.filter(job => processJobStatus(job) === 'active');
  const completedJobs = jobs.filter(job => processJobStatus(job) === 'completed');
  
  const urgentJobs = jobs.filter(job => 
    isJobOverdue(job) || isJobDueSoon(job)
  );

  const dtpJobs = jobs.filter(job => {
    if (!job.current_stage_name) return false;
    return job.current_stage_name.toLowerCase().includes('dtp');
  });

  const proofJobs = jobs.filter(job => {
    if (!job.current_stage_name) return false;
    return job.current_stage_name.toLowerCase().includes('proof');
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

// Pure function to calculate job counts
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

// Pure function to sort jobs by priority
export const sortJobsByPriority = (jobs: AccessibleJob[]): AccessibleJob[] => {
  return [...jobs].sort((a, b) => {
    const aStatus = processJobStatus(a);
    const bStatus = processJobStatus(b);
    
    if (aStatus === 'active' && bStatus !== 'active') return -1;
    if (bStatus === 'active' && aStatus !== 'active') return 1;
    
    const aOverdue = isJobOverdue(a);
    const bOverdue = isJobOverdue(b);
    
    if (aOverdue && !bOverdue) return -1;
    if (bOverdue && !aOverdue) return 1;
    
    const aDueSoon = isJobDueSoon(a);
    const bDueSoon = isJobDueSoon(b);
    
    if (aDueSoon && !bDueSoon) return -1;
    if (bDueSoon && !aDueSoon) return 1;
    
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    
    return 0;
  });
};

// Pure function to check if job can be started
export const canStartJob = (job: AccessibleJob): boolean => {
  return job.user_can_work && 
         job.current_stage_id && 
         processJobStatus(job) === 'pending';
};

// Pure function to check if job can be completed
export const canCompleteJob = (job: AccessibleJob): boolean => {
  return job.user_can_work && 
         job.current_stage_id && 
         processJobStatus(job) === 'active';
};

// Pure function to get job status badge info
export const getJobStatusBadgeInfo = (job: AccessibleJob): JobStatusBadgeInfo => {
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
  
  return {
    text: 'Ready to Start',
    className: 'bg-green-600 text-white',
    variant: 'default' as const
  };
};

// Pure function to calculate filter counts
export const calculateFilterCounts = (jobs: AccessibleJob[]) => {
  if (!jobs || jobs.length === 0) {
    return { all: 0, available: 0, 'my-active': 0, urgent: 0 };
  }

  const categories = categorizeJobs(jobs);

  return {
    all: jobs.length,
    available: categories.pendingJobs.filter(j => j.user_can_work).length,
    'my-active': categories.activeJobs.filter(j => j.user_can_work).length,
    urgent: categories.urgentJobs.length
  };
};
