
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import { JobStatusDisplay } from "@/components/tracker/common/JobStatusDisplay";
import { ProofStatusIndicator } from "./ProofStatusIndicator";
import { processJobStatus } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { getWorkflowStateColor } from "@/utils/tracker/workflowStateUtils";

interface CompactDtpJobCardProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onJobClick?: (job: AccessibleJob) => void;
  showActions?: boolean;
}

export const CompactDtpJobCard: React.FC<CompactDtpJobCardProps> = ({
  job,
  onStart,
  onComplete,
  onJobClick,
  showActions = true
}) => {
  const jobStatus = processJobStatus(job);
  
  // Get workflow state-based colors
  const workflowState = getWorkflowStateColor(job);
  
  // Check if this is a proof stage job
  const isProofJob = job.current_stage_name && job.current_stage_name.toLowerCase().includes('proof');
  
  // Get proof status for corner indicator
  const getProofStatus = () => {
    if (job.proof_approved_at) return "approved";
    if (job.current_stage_status === 'changes_requested') return "changes_requested";
    if (job.proof_emailed_at) return "awaiting_approval";
    return null;
  };
  
  const proofStatus = getProofStatus();

  const handleCardClick = () => {
    if (onJobClick) {
      onJobClick(job);
    }
  };

  return (
    <Card 
      className={cn(
        "mb-2 transition-all duration-200 cursor-pointer hover:shadow-md relative", 
        workflowState.cardClass
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-3">
         {/* FIXED: Show corner indicator for jobs awaiting approval or with changes requested */}
         {isProofJob && (proofStatus === "awaiting_approval" || proofStatus === "changes_requested") && (
           <ProofStatusIndicator
             stageInstance={{
               status: proofStatus === "changes_requested" ? 'changes_requested' : 'awaiting_approval',
               proof_emailed_at: job.proof_emailed_at,
               updated_at: job.proof_emailed_at
             }}
             variant="corner-badge"
             showTimeElapsed={false}
           />
         )}
        
        <div className="space-y-2">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-sm text-gray-900 truncate">
                {job.wo_no}
              </h4>
               {job.customer && (
                 <p className="text-xs text-gray-600 truncate">
                   {job.customer}
                 </p>
               )}
               {/* ADDED: Contact information */}
               {job.contact && (
                 <p className="text-xs text-gray-500 truncate">
                   Contact: {job.contact}
                 </p>
               )}
            </div>
          </div>

          {/* Status Display */}
          <JobStatusDisplay 
            job={job} 
            showDetails={true}
            compact={true}
          />

          {/* Reference Info */}
          {job.reference && (
            <div className="text-xs text-gray-500">
              Ref: {job.reference}
            </div>
          )}

          {/* Action Buttons */}
          {showActions && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <JobActionButtons
                job={job}
                onStart={onStart}
                onComplete={onComplete}
                size="sm"
                layout="vertical"
                compact={true}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
