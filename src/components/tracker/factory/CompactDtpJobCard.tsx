
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
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

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
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  console.log(`🃏 Job Card for ${job.wo_no}:`, {
    current_stage_status: job.current_stage_status,
    current_stage_id: job.current_stage_id,
    current_stage_name: job.current_stage_name,
    user_can_work: job.user_can_work,
    showActions
  });

  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const getCardStyle = () => {
    if (job.current_stage_status === 'active') return "border-blue-500 bg-blue-50 shadow-md";
    if (isOverdue) return "border-red-500 bg-red-50";
    if (isDueSoon) return "border-orange-500 bg-orange-50";
    return "border-gray-200 bg-white hover:shadow-sm";
  };

  const getStatusBadge = () => {
    const status = job.current_stage_status;
    
    if (status === 'active') {
      return <Badge variant="default" className="text-xs px-2 py-0 bg-blue-500">In Progress</Badge>;
    }
    
    if (status === 'completed') {
      return <Badge variant="default" className="text-xs px-2 py-0 bg-green-500">Completed</Badge>;
    }
    
    // Default to pending
    return <Badge variant="secondary" className="text-xs px-2 py-0 bg-green-600 text-white">Ready to Start</Badge>;
  };

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsActionInProgress(true);
    try {
      await action();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleCardClick = () => {
    if (onJobClick) {
      onJobClick(job);
    }
  };

  // FIXED: Corrected action logic
  const shouldShowActions = showActions && job.user_can_work && job.current_stage_id;
  const canStart = job.current_stage_status === 'pending';
  const canComplete = job.current_stage_status === 'active';

  console.log(`🎬 Action visibility for ${job.wo_no}:`, {
    shouldShowActions,
    canStart,
    canComplete,
    current_stage_status: job.current_stage_status
  });

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
            <div className="flex items-center gap-1 ml-2">
              {getStatusBadge()}
            </div>
          </div>

          {/* Stage Info */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Stage:</span>
              <span className="font-medium text-gray-700">
                {job.current_stage_name || 'No Workflow'}
              </span>
            </div>
          </div>

          {/* Info Row */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              {job.due_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span className={cn(
                    isOverdue ? "text-red-600 font-medium" : 
                    isDueSoon ? "text-orange-600 font-medium" : 
                    "text-gray-600"
                  )}>
                    {new Date(job.due_date).toLocaleDateString()}
                  </span>
                  {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
                </div>
              )}
              
              {job.current_stage_status === 'active' && (
                <div className="flex items-center gap-1 text-blue-600">
                  <User className="h-3 w-3" />
                  <span className="font-medium">Working</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          {shouldShowActions && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              {canStart && (
                <Button 
                  onClick={() => handleAction(() => onStart(job.job_id, job.current_stage_id || 'default'))}
                  size="sm"
                  className="w-full h-7 text-xs bg-green-600 hover:bg-green-700 mb-1"
                  disabled={isActionInProgress}
                >
                  <Play className="h-3 w-3 mr-1" />
                  {isActionInProgress ? "Starting..." : "Start Job"}
                </Button>
              )}
              
              {canComplete && (
                <Button 
                  onClick={() => handleAction(() => onComplete(job.job_id, job.current_stage_id || 'default'))}
                  size="sm"
                  className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700"
                  disabled={isActionInProgress}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {isActionInProgress ? "Completing..." : "Complete"}
                </Button>
              )}
            </div>
          )}

          {/* Active Timer Indicator */}
          {job.current_stage_status === 'active' && (
            <div className="flex items-center gap-1 pt-1 text-xs text-blue-600 bg-blue-50 -mx-3 -mb-3 px-3 py-1 rounded-b">
              <Clock className="h-3 w-3 animate-pulse" />
              <span className="font-medium">Timer Active</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
