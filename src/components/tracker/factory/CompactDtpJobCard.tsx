
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import { JobStatusDisplay } from "@/components/tracker/common/JobStatusDisplay";
import { 
  processJobStatus, 
  isJobOverdue, 
  isJobDueSoon
} from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";

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
  const isOverdue = isJobOverdue(job);
  const isDueSoon = isJobDueSoon(job);
  const jobStatus = processJobStatus(job);

  const getCardStyle = () => {
    if (jobStatus === 'active') return "border-blue-500 bg-blue-50 shadow-md";
    if (isOverdue) return "border-red-500 bg-red-50";
    if (isDueSoon) return "border-orange-500 bg-orange-50";
    return "border-gray-200 bg-white hover:shadow-sm";
  };

  const handleCardClick = () => {
    if (onJobClick) {
      onJobClick(job);
    }
  };

  return (
    <Card 
      className={cn(
        "mb-2 transition-all duration-200 cursor-pointer hover:shadow-md", 
        getCardStyle()
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-3">
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
                onJobClick={onJobClick}
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
