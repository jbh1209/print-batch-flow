
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, Clock, Settings, Zap, Package, Mail, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { 
  processJobStatus, 
  isJobOverdue, 
  isJobDueSoon,
  getJobStatusBadgeInfo
} from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { BatchStatusIndicator } from "@/components/tracker/batch/BatchStatusIndicator";
import { getWorkflowStateColor } from "@/utils/tracker/workflowStateUtils";

interface JobStatusDisplayProps {
  job: AccessibleJob & { 
    is_orphaned?: boolean;
    is_expedited?: boolean;
    expedite_reason?: string;
    expedited_at?: string;
    batch_name?: string | null;
    batch_category?: string | null;
  };
  showDetails?: boolean;
  compact?: boolean;
}

export const JobStatusDisplay: React.FC<JobStatusDisplayProps> = ({
  job,
  showDetails = true,
  compact = false
}) => {
  // Get the effective due date - this should already be processed by the centralized processor
  const effectiveDueDate = job.due_date; // The centralized processor already handles manual_due_date logic
  
  console.log(`🎯 JobStatusDisplay for ${job.wo_no}:`, {
    hasCustomWorkflow: job.has_custom_workflow,
    effectiveDueDate: effectiveDueDate,
    manualDueDate: job.manual_due_date,
    originalDueDate: job.due_date,
    isExpedited: job.is_expedited
  });

  const isOverdue = isJobOverdue(job);
  const isDueSoon = isJobDueSoon(job);
  const jobStatus = processJobStatus(job);
  const statusBadgeInfo = getJobStatusBadgeInfo(job);
  const isExpedited = job.is_expedited === true;
  
  // Get workflow state for enhanced DTP/Proof status display
  const workflowState = getWorkflowStateColor(job);
  const stageName = job.current_stage_name?.toLowerCase() || '';
  const isDtpOrProofStage = stageName.includes('dtp') || stageName.includes('proof');

  const iconSize = compact ? "h-3 w-3" : "h-4 w-4";
  const textSize = compact ? "text-xs" : "text-sm";

  // Enhanced custom workflow detection - check both explicit flag and workflow pattern
  const hasCustomWorkflow = job.has_custom_workflow === true || 
    (job.category_id === null && job.current_stage_id && job.current_stage_id !== '00000000-0000-0000-0000-000000000000') ||
    (job.category_id === null && job.current_stage_name && job.current_stage_name !== 'No Stage');
  
  // Enhanced orphaned detection - only if has category but missing workflow
  const isOrphaned = !hasCustomWorkflow && job.category_id && (!job.current_stage_id || job.current_stage_id === '00000000-0000-0000-0000-000000000000');
  const hasCategory = !!job.category_id;
  const hasStage = job.current_stage_id && job.current_stage_id !== '00000000-0000-0000-0000-000000000000';

  // Determine display status and styling
  let displayStatus: string;
  let badgeVariant: "default" | "secondary" | "destructive" | "outline";
  let badgeClassName: string;

  if (hasCustomWorkflow) {
    displayStatus = job.current_stage_name || 'Custom Workflow';
    badgeVariant = "outline";
    badgeClassName = "bg-purple-50 text-purple-700 border-purple-300";
  } else if (isOrphaned) {
    displayStatus = 'Configuration Issue';
    badgeVariant = "destructive";
    badgeClassName = "bg-orange-100 text-orange-800 border-orange-300";
  } else if (!hasCategory) {
    displayStatus = 'No Category';
    badgeVariant = "outline";
    badgeClassName = "bg-gray-100 text-gray-600 border-gray-300";
  } else if (!hasStage) {
    displayStatus = 'No Workflow';
    badgeVariant = "destructive";
    badgeClassName = "bg-red-100 text-red-800 border-red-300";
  } else {
    displayStatus = job.current_stage_name || job.current_stage_id || job.status || 'Unknown';
    badgeVariant = statusBadgeInfo.variant;
    badgeClassName = statusBadgeInfo.className;
  }

  return (
    <div className="space-y-2">
      {/* Expedite Status - Show prominently if expedited */}
      {isExpedited && (
        <div className="flex items-center gap-2">
          <Badge className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {compact ? "RUSH" : "EXPEDITED"}
          </Badge>
          {showDetails && job.expedite_reason && (
            <span className={cn("text-red-700 font-medium", textSize)}>
              {job.expedite_reason}
            </span>
          )}
        </div>
      )}

      {/* Status Badge - Enhanced for DTP/Proof workflows */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge 
          variant={badgeVariant}
          className={cn(
            "whitespace-nowrap", 
            isDtpOrProofStage ? workflowState.badgeClass : badgeClassName,
            compact && "text-xs px-2 py-0"
          )}
        >
          {displayStatus}
        </Badge>
        
        {/* Workflow State Pill for DTP/Proof */}
        {isDtpOrProofStage && showDetails && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs flex items-center gap-1",
              workflowState.badgeClass
            )}
          >
            {stageName.includes('proof') && job.proof_approved_at && <CheckCircle className="h-3 w-3" />}
            {stageName.includes('proof') && job.current_stage_status === 'changes_requested' && <XCircle className="h-3 w-3" />}
            {stageName.includes('proof') && job.proof_emailed_at && !job.proof_approved_at && job.current_stage_status !== 'changes_requested' && <Mail className="h-3 w-3" />}
            {workflowState.label}
          </Badge>
        )}
        
        {hasCustomWorkflow && showDetails && (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs flex items-center gap-1">
            <Settings className="h-3 w-3" />
            Custom
          </Badge>
        )}
        
        {jobStatus === 'active' && !isOrphaned && hasStage && !isDtpOrProofStage && (
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className={cn(iconSize, "animate-pulse")} />
            {!compact && <span className={cn("font-medium", textSize)}>Active</span>}
          </div>
        )}
      </div>

      {/* Warning for configuration issues */}
      {isOrphaned && showDetails && (
        <div className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className={cn(iconSize)} />
          <span className={cn("text-xs", "font-medium")}>
            Category assigned but missing workflow configuration
          </span>
        </div>
      )}

      {/* Due Date - Use the effective due date that's already processed */}
      {showDetails && effectiveDueDate && (
        <div className="flex items-center gap-2">
          <Calendar className={cn("text-gray-400", iconSize)} />
          <span className={cn(
            "font-medium",
            isExpedited ? "text-red-600" :
            isOverdue ? "text-red-600" : 
            isDueSoon ? "text-orange-600" : 
            "text-gray-700",
            textSize
          )}>
            {compact ? "" : "Due: "}{new Date(effectiveDueDate).toLocaleDateString()}
            {hasCustomWorkflow && job.manual_due_date && (
              <span className="text-xs text-purple-600 ml-1">(Manual)</span>
            )}
            {isExpedited && (
              <span className="text-xs text-red-600 ml-1">(EXPEDITED)</span>
            )}
          </span>
          {(isOverdue || isExpedited) && <AlertTriangle className={cn("text-red-500", iconSize)} />}
        </div>
      )}

      {/* Due Date Missing Warning for Custom Workflows */}
      {showDetails && hasCustomWorkflow && !effectiveDueDate && (
        <div className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className={cn(iconSize)} />
          <span className={cn("text-xs", "font-medium")}>
            Manual due date required for custom workflow
          </span>
        </div>
      )}

      {/* Workflow Progress */}
      {showDetails && (hasStage || hasCustomWorkflow) && (
        <div className="flex items-center gap-2">
          <span className={cn("text-gray-500", textSize)}>
            {job.workflow_progress !== undefined ? 'Progress:' : 'Stage:'}
          </span>
          <span className={cn("font-medium text-gray-700", textSize)}>
            {job.workflow_progress !== undefined 
              ? `${Math.round(job.workflow_progress)}%`
              : displayStatus
            }
          </span>
        </div>
      )}

      {/* Category Info */}
      {showDetails && (hasCategory || hasCustomWorkflow) && (
        <div className="flex items-center gap-2">
          <span className={cn("text-gray-500", textSize)}>
            {hasCustomWorkflow ? 'Type:' : 'Category:'}
          </span>
          <span className={cn("font-medium text-gray-700", textSize)}>
            {hasCustomWorkflow ? 'Custom Workflow' : job.category_name || 'Unknown'}
          </span>
        </div>
      )}

      {/* Batch Information */}
      {showDetails && (job.is_in_batch_processing || job.batch_name || job.batch_category) && (
        <div className="space-y-1">
          {job.is_in_batch_processing && (
            <div className="flex items-center gap-2">
              <Package className={cn("text-orange-500", iconSize)} />
              <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs">
                In Batch Processing
              </Badge>
              {job.batch_category && (
                <span className={cn("text-orange-600 font-medium", textSize)}>
                  {job.batch_category}
                </span>
              )}
            </div>
          )}
          {job.batch_name && (
            <div className="flex items-center gap-2">
              <span className={cn("text-gray-500", textSize)}>Batch:</span>
              <span className={cn("font-medium text-orange-700", textSize)}>
                {job.batch_name}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Expedite Details */}
      {showDetails && isExpedited && job.expedited_at && (
        <div className="flex items-center gap-2">
          <span className={cn("text-gray-500", textSize)}>Expedited:</span>
          <span className={cn("font-medium text-red-700", textSize)}>
            {new Date(job.expedited_at).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
};
