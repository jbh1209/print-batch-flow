
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import { JobStatusDisplay } from "@/components/tracker/common/JobStatusDisplay";
import { LinkIcon } from "lucide-react";
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
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-gray-900 truncate">
                  {job.wo_no}
                </h4>
                {/* Virtual Entry Indicator for Parallel Stages */}
                {job.is_virtual_stage_entry && job.parallel_stages && job.parallel_stages.length > 1 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" />
                    {job.parallel_stages.length} Parts
                  </Badge>
                )}
              </div>
              {job.customer && (
                <p className="text-xs text-gray-600 truncate">
                  {job.customer}
                </p>
              )}
            </div>
          </div>

          {/* Part Assignment for Virtual Entries */}
          {job.is_virtual_stage_entry && job.part_assignment && (
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className="bg-indigo-50 text-indigo-700 border-indigo-300 text-xs font-medium"
              >
                {job.part_assignment === 'cover' ? 'Cover' : 
                 job.part_assignment === 'text' ? 'Text' : 
                 job.part_assignment.charAt(0).toUpperCase() + job.part_assignment.slice(1)}
              </Badge>
              <span className="text-xs text-gray-500">
                Part of {job.wo_no}
              </span>
            </div>
          )}

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
