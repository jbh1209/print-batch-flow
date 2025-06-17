
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { 
  processJobStatus as coreProcessJobStatus,
  isJobOverdue as coreIsJobOverdue,
  isJobDueSoon as coreIsJobDueSoon,
  categorizeJobs as coreCategorizeJobs,
  calculateJobCounts as coreCalculateJobCounts,
  sortJobsByPriority as coreSortJobsByPriority,
  canStartJob as coreCanStartJob,
  canCompleteJob as coreCanCompleteJob,
  getJobStatusBadgeInfo as coreGetJobStatusBadgeInfo
} from "@/hooks/tracker/useAccessibleJobs/pureJobProcessor";

export interface JobStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  urgent: number;
  dtpJobs: number;
  proofJobs: number;
}

export interface JobCategories {
  pendingJobs: AccessibleJob[];
  activeJobs: AccessibleJob[];
  completedJobs: AccessibleJob[];
  urgentJobs: AccessibleJob[];
  dtpJobs: AccessibleJob[];
  proofJobs: AccessibleJob[];
}

// Re-export core functions for backwards compatibility
export const getJobStatus = coreProcessJobStatus;
export const isJobOverdue = coreIsJobOverdue;
export const isJobDueSoon = coreIsJobDueSoon;
export const categorizeJobs = coreCategorizeJobs;
export const sortJobsByPriority = coreSortJobsByPriority;
export const canStartJob = coreCanStartJob;
export const canCompleteJob = coreCanCompleteJob;
export const getJobStatusBadgeInfo = coreGetJobStatusBadgeInfo;

// Backwards compatible version that matches the old interface
export const calculateJobStats = (jobs: AccessibleJob[]): JobStats => {
  const coreStats = coreCalculateJobCounts(jobs);
  const categories = coreCategorizeJobs(jobs);
  
  return {
    total: coreStats.total,
    pending: coreStats.pending,
    active: coreStats.active,
    completed: coreStats.completed,
    urgent: coreStats.overdue + coreStats.dueSoon,
    dtpJobs: categories.dtpJobs.length,
    proofJobs: categories.proofJobs.length
  };
};
