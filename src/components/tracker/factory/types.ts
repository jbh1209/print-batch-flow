
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";

// Standardized job component props
export interface JobComponentProps {
  job: AccessibleJob;
  onStart?: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete?: (jobId: string, stageId: string) => Promise<boolean>;
  onHold?: (jobId: string, reason: string) => Promise<boolean>;
  onJobClick?: (job: AccessibleJob) => void;
  showActions?: boolean;
  className?: string;
}

export interface JobCardActions {
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onHold: (jobId: string, reason: string) => Promise<boolean>;
}

export interface JobModalProps {
  job: AccessibleJob | null;
  isOpen: boolean;
  onClose: () => void;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
}

export interface DashboardFilters {
  searchQuery: string;
  filterMode: 'all' | 'my-active' | 'available' | 'urgent';
}

export interface FilterCounts {
  all: number;
  available: number;
  'my-active': number;
  urgent: number;
}

export interface JobStatusBadgeInfo {
  text: string;
  className: string;
  variant: 'default' | 'destructive' | 'secondary' | 'outline';
}
