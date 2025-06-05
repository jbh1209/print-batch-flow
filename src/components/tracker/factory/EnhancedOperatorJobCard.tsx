
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import { JobStatusDisplay } from "@/components/tracker/common/JobStatusDisplay";
import { 
  processJobStatus, 
  isJobOverdue, 
  isJobDueSoon
} from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";

interface EnhancedOperatorJobCardProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onHold: (jobId: string, reason: string) => Promise<boolean>;
}

export const EnhancedOperatorJobCard: React.FC<EnhancedOperatorJobCardProps> = ({
  job,
  onStart,
  onComplete,
  onHold
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

  return (
    <Card className={cn("mb-3 transition-all duration-200", getCardStyle())}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-gray-900 truncate mb-2">
                {job.wo_no}
              </h3>
              
              {job.customer && (
                <p className="text-sm text-gray-600 mb-2">
                  Customer: {job.customer}
                </p>
              )}
              
              {job.reference && (
                <p className="text-sm text-gray-600 mb-2">
                  Reference: {job.reference}
                </p>
              )}
            </div>
          </div>

          {/* Status Display */}
          <JobStatusDisplay 
            job={job} 
            showDetails={true}
            compact={false}
          />

          {/* Progress Info */}
          {job.workflow_progress !== undefined && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Workflow Progress</span>
                <span className="font-bold">{job.workflow_progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${job.workflow_progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{job.completed_stages} completed</span>
                <span>{job.total_stages - job.completed_stages} remaining</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2">
            <JobActionButtons
              job={job}
              onStart={onStart}
              onComplete={onComplete}
              onHold={onHold}
              size="default"
              layout="horizontal"
              showHold={true}
              compact={false}
            />
          </div>

          {/* Active Timer Indicator */}
          {jobStatus === 'active' && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-100 px-3 py-2 rounded-lg">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="font-medium">Timer Active - You're working on this job</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
