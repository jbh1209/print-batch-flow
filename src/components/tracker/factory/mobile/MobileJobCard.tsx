
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  CheckCircle, 
  Pause,
  Clock, 
  AlertTriangle,
  Calendar,
  Package,
  User,
  MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface MobileJobCardProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onHold: (jobId: string, reason: string) => Promise<boolean>;
  onSelect: (jobId: string, selected: boolean) => void;
  isSelected: boolean;
  onClick: () => void;
}

export const MobileJobCard: React.FC<MobileJobCardProps> = ({
  job,
  onStart,
  onComplete,
  onHold,
  onSelect,
  isSelected,
  onClick
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const getCardStyle = () => {
    if (isSelected) return "border-blue-500 bg-blue-50 ring-2 ring-blue-200";
    if (job.current_stage_status === 'active') return "border-green-500 bg-green-50";
    if (isOverdue) return "border-red-500 bg-red-50";
    if (isDueSoon) return "border-orange-500 bg-orange-50";
    return "border-gray-200 bg-white";
  };

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsProcessing(true);
    try {
      await action();
      setShowActions(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickHold = (reason: string) => {
    handleAction(() => onHold(job.job_id, reason));
  };

  return (
    <Card className={cn("mb-4 transition-all duration-200 touch-manipulation", getCardStyle())}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with selection */}
          <div className="flex items-start justify-between">
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={onClick}
            >
              <h3 className="text-lg font-bold text-gray-900 truncate">
                {job.wo_no}
              </h3>
              {job.customer && (
                <p className="text-sm text-gray-600 truncate">
                  {job.customer}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2 ml-2">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect(job.job_id, e.target.checked)}
                className="w-5 h-5 rounded border-2 touch-manipulation"
                onClick={(e) => e.stopPropagation()}
              />
              <Badge 
                variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                className="text-xs px-2 py-1"
              >
                {job.current_stage_name || 'Pending'}
              </Badge>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Progress</span>
              <span className="font-bold text-gray-900">
                {Math.round(job.workflow_progress)}%
              </span>
            </div>
            <Progress value={job.workflow_progress} className="h-2" />
            <div className="text-xs text-gray-500">
              Stage {job.completed_stages} of {job.total_stages}
            </div>
          </div>

          {/* Job details */}
          <div className="grid grid-cols-1 gap-2 text-sm">
            {job.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className={cn(
                  "font-medium",
                  isOverdue ? "text-red-600" : 
                  isDueSoon ? "text-orange-600" : 
                  "text-gray-700"
                )}>
                  Due: {new Date(job.due_date).toLocaleDateString()}
                </span>
                {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
              </div>
            )}
            
            {job.reference && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700 truncate">
                  Ref: {job.reference}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {job.user_can_work && job.current_stage_id && (
            <div className="pt-2 border-t">
              {!showActions ? (
                <div className="flex gap-2">
                  {job.current_stage_status === 'pending' && (
                    <Button 
                      onClick={() => handleAction(() => onStart(job.job_id, job.current_stage_id!))}
                      className="flex-1 h-12 text-base font-semibold bg-green-600 hover:bg-green-700 touch-manipulation"
                      disabled={isProcessing}
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Start
                    </Button>
                  )}
                  
                  {job.current_stage_status === 'active' && (
                    <>
                      <Button 
                        onClick={() => setShowActions(true)}
                        variant="outline"
                        className="h-12 px-3 touch-manipulation"
                        disabled={isProcessing}
                      >
                        <Pause className="h-5 w-5" />
                      </Button>
                      <Button 
                        onClick={() => handleAction(() => onComplete(job.job_id, job.current_stage_id!))}
                        className="flex-1 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 touch-manipulation"
                        disabled={isProcessing}
                      >
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Complete
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700 mb-2">Hold Reason:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Break', 'Material', 'Equipment', 'Quality'].map((reason) => (
                      <Button
                        key={reason}
                        onClick={() => handleQuickHold(reason)}
                        variant="outline"
                        size="sm"
                        className="h-10 text-xs touch-manipulation"
                        disabled={isProcessing}
                      >
                        {reason}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setShowActions(false)}
                    variant="ghost"
                    size="sm"
                    className="w-full h-10 touch-manipulation"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Active indicator */}
          {job.current_stage_status === 'active' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 -mx-4 -mb-4 rounded-b-lg border-t">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-700">
                Job Active
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
