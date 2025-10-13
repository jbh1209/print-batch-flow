import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

/**
 * Workflow State Color System
 * Prioritizes workflow states over timing for DTP/Proof stages
 */

export interface WorkflowStateColor {
  cardClass: string;
  badgeClass: string;
  label: string;
  priority: number; // Lower = higher priority
}

/**
 * Get color scheme for DTP stage jobs
 */
export const getDtpStateColor = (job: AccessibleJob): WorkflowStateColor => {
  const stageName = job.current_stage_name?.toLowerCase() || '';
  
  // Active - currently being worked on
  if (job.current_stage_status === 'active') {
    return {
      cardClass: "border-blue-500 bg-blue-50 shadow-md",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
      label: "Active",
      priority: 2
    };
  }
  
  // Blocked/Issue - something preventing progress
  if (job.current_stage_status === 'blocked' || job.current_stage_status === 'on_hold') {
    return {
      cardClass: "border-red-500 bg-red-50 shadow-md",
      badgeClass: "bg-red-100 text-red-800 border-red-300",
      label: "Blocked",
      priority: 1
    };
  }
  
  // Ready for Proof - DTP completed, ready to send proof
  if (stageName.includes('ready') || job.current_stage_status === 'completed') {
    return {
      cardClass: "border-green-500 bg-green-50 shadow-md",
      badgeClass: "bg-green-100 text-green-800 border-green-300",
      label: "Ready for Proof",
      priority: 3
    };
  }
  
  // Pending - not started yet
  return {
    cardClass: "border-gray-300 bg-white hover:shadow-sm",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
    label: "Pending",
    priority: 4
  };
};

/**
 * Get color scheme for Proof stage jobs
 */
export const getProofStateColor = (job: AccessibleJob): WorkflowStateColor => {
  const status = job.current_stage_status;
  const proofEmailedAt = job.proof_emailed_at;
  const proofApprovedAt = job.proof_approved_at;
  
  // Changes Requested - HIGHEST PRIORITY
  if (status === 'changes_requested') {
    return {
      cardClass: "border-red-500 bg-red-50 shadow-md",
      badgeClass: "bg-red-100 text-red-800 border-red-300",
      label: "Changes Requested",
      priority: 1
    };
  }
  
  // Proof Approved - Ready for production
  if (proofApprovedAt || status === 'completed') {
    return {
      cardClass: "border-green-500 bg-green-50 shadow-md shadow-green-200",
      badgeClass: "bg-green-100 text-green-800 border-green-300",
      label: "Approved - Ready",
      priority: 2
    };
  }
  
  // Awaiting Approval - Check urgency based on email age
  if (proofEmailedAt) {
    const daysSinceProof = Math.floor(
      (Date.now() - new Date(proofEmailedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Critical - 3+ days
    if (daysSinceProof >= 3) {
      return {
        cardClass: "border-red-500 bg-red-50 shadow-md animate-pulse",
        badgeClass: "bg-red-100 text-red-800 border-red-300",
        label: "Approval Overdue",
        priority: 3
      };
    }
    
    // Warning - 1-2 days
    if (daysSinceProof >= 1) {
      return {
        cardClass: "border-orange-500 bg-orange-50 shadow-md",
        badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
        label: "Awaiting Approval",
        priority: 4
      };
    }
    
    // Fresh - less than 1 day
    return {
      cardClass: "border-purple-500 bg-purple-50 shadow-sm",
      badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
      label: "Proof Sent",
      priority: 5
    };
  }
  
  // Not sent yet
  return {
    cardClass: "border-gray-300 bg-white hover:shadow-sm",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
    label: "Proof Not Sent",
    priority: 6
  };
};

/**
 * Get color scheme for Batch Allocation jobs
 */
export const getBatchStateColor = (job: AccessibleJob): WorkflowStateColor => {
  const stageName = job.current_stage_name?.toLowerCase() || '';
  
  // Allocated - batch assigned
  if (job.is_in_batch_processing || stageName.includes('allocated')) {
    return {
      cardClass: "border-green-500 bg-green-50 shadow-md",
      badgeClass: "bg-green-100 text-green-800 border-green-300",
      label: "Allocated",
      priority: 1
    };
  }
  
  // In Progress - being allocated
  if (job.current_stage_status === 'active') {
    return {
      cardClass: "border-orange-500 bg-orange-50 shadow-md",
      badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
      label: "In Progress",
      priority: 2
    };
  }
  
  // Pending allocation
  return {
    cardClass: "border-gray-300 bg-white hover:shadow-sm",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
    label: "Pending",
    priority: 3
  };
};

/**
 * Main function to get workflow state color based on job stage
 */
export const getWorkflowStateColor = (job: AccessibleJob): WorkflowStateColor => {
  const stageName = job.current_stage_name?.toLowerCase() || '';
  
  // Detect stage type
  if (stageName.includes('proof')) {
    return getProofStateColor(job);
  }
  
  if (stageName.includes('batch') || stageName.includes('allocat')) {
    return getBatchStateColor(job);
  }
  
  // Default to DTP color scheme
  return getDtpStateColor(job);
};

/**
 * Sort jobs by workflow state priority with tie-breakers
 * Lower priority number = higher in list
 * Tie-breakers: proof_emailed_at (oldest first), due_date (earliest first), wo_no (numeric)
 */
export const sortJobsByWorkflowPriority = (jobs: AccessibleJob[]): AccessibleJob[] => {
  return [...jobs].sort((a, b) => {
    const aColor = getWorkflowStateColor(a);
    const bColor = getWorkflowStateColor(b);
    
    // Primary sort by priority
    if (aColor.priority !== bColor.priority) {
      return aColor.priority - bColor.priority;
    }
    
    // Tie-breaker 1: For proof jobs with emails, oldest first (most urgent)
    const aIsProof = (a.current_stage_name || '').toLowerCase().includes('proof');
    const bIsProof = (b.current_stage_name || '').toLowerCase().includes('proof');
    if (aIsProof && bIsProof && a.proof_emailed_at && b.proof_emailed_at) {
      const aTime = new Date(a.proof_emailed_at).getTime();
      const bTime = new Date(b.proof_emailed_at).getTime();
      if (aTime !== bTime) return aTime - bTime; // older first
    }
    
    // Tie-breaker 2: Due date (earliest first)
    if (a.due_date && b.due_date) {
      const aDate = new Date(a.due_date).getTime();
      const bDate = new Date(b.due_date).getTime();
      if (aDate !== bDate) return aDate - bDate;
    }
    
    // Tie-breaker 3: Work order number (numeric ascending)
    const aNum = parseInt((a.wo_no || '').replace(/\D/g, '')) || 0;
    const bNum = parseInt((b.wo_no || '').replace(/\D/g, '')) || 0;
    return aNum - bNum;
  });
};
