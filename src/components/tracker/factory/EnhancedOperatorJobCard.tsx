
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Calendar,
  Pause
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { 
  processJobStatus, 
  isJobOverdue, 
  isJobDueSoon, 
  canStartJob, 
  canCompleteJob,
  getJobStatusBadgeInfo
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
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const isOverdue = isJobOverdue(job);
  const isDueSoon = isJobDueSoon(job);
  const jobStatus = processJobStatus(job);

  const getCardStyle = () => {
    if (jobStatus === 'active') return "border-blue-500 bg-blue-50 shadow-md";
    if (isOverdue) return "border-red-500 bg-red-50";
    if (isDueSoon) return "border-orange-500 bg-orange-50";
    return "border-gray-200 bg-white hover:shadow-sm";
  };

  const statusBadgeInfo = getJobStatusBadgeInfo(job);

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsActionInProgress(true);
    try {
      await action();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const showStartButton = canStartJob(job);
  const showCompleteButton = canCompleteJob(job);
  const showHoldButton = jobStatus === 'active';

  return (
    <Card className={cn("mb-3 transition-all duration-200", getCardStyle())}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-bold text-lg text-gray-900 truncate">
                  {job.wo_no}
                </h3>
                <Badge 
                  variant={statusBadgeInfo.variant}
                  className={`text-xs px-2 py-1 ${statusBadgeInfo.className}`}
                >
                  {statusBadgeInfo.text}
                </Badge>
              </div>
              
              {job.customer && (
                <p className="text-sm text-gray-600 mb-1">
                  Customer: {job.customer}
                </p>
              )}
              
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <span>Stage:</span>
                  <span className="font-medium text-gray-700">
                    {job.current_stage_name || 'No Workflow'}
                  </span>
                </div>
                
                {job.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span className={cn(
                      isOverdue ? "text-red-600 font-medium" : 
                      isDueSoon ? "text-orange-600 font-medium" : 
                      "text-gray-600"
                    )}>
                      Due: {new Date(job.due_date).toLocaleDateString()}
                    </span>
                    {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  </div>
                )}
              </div>
            </div>
          </div>

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
          {job.current_stage_id && (
            <div className="flex gap-2 pt-2">
              {showStartButton && (
                <Button 
                  onClick={() => handleAction(() => onStart(job.job_id, job.current_stage_id || 'default'))}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={isActionInProgress}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isActionInProgress ? "Starting..." : "Start Job"}
                </Button>
              )}
              
              {showCompleteButton && (
                <Button 
                  onClick={() => handleAction(() => onComplete(job.job_id, job.current_stage_id || 'default'))}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={isActionInProgress}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isActionInProgress ? "Completing..." : "Complete"}
                </Button>
              )}
              
              {showHoldButton && (
                <Button 
                  onClick={() => handleAction(() => onHold(job.job_id, 'Manual hold'))}
                  variant="outline"
                  className="px-3"
                  disabled={isActionInProgress}
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Active Timer Indicator */}
          {jobStatus === 'active' && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-100 px-3 py-2 rounded-lg">
              <Clock className="h-4 w-4 animate-pulse" />
              <span className="font-medium">Timer Active - You're working on this job</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
