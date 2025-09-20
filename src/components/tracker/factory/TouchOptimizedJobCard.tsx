
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Calendar,
  Package,
  MapPin,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface TouchOptimizedJobCardProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onHold?: (jobId: string, reason: string) => Promise<boolean>;
  showFullDetails?: boolean;
  size?: 'compact' | 'normal' | 'large';
}

export const TouchOptimizedJobCard: React.FC<TouchOptimizedJobCardProps> = ({
  job,
  onStart,
  onComplete,
  onHold,
  showFullDetails = false,
  size = 'normal'
}) => {
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [showHoldReasons, setShowHoldReasons] = useState(false);

  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const getCardStyle = () => {
    if (job.current_stage_status === 'active') return "border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200";
    if (isOverdue) return "border-red-500 bg-red-50";
    if (isDueSoon) return "border-orange-500 bg-orange-50";
    return "border-gray-200 bg-white hover:shadow-md";
  };

  const getStatusColor = () => {
    if (job.current_stage_status === 'active') return "bg-blue-600";
    if (job.current_stage_status === 'completed') return "bg-green-600";
    return "bg-gray-400";
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'compact':
        return { card: "mb-2", content: "p-3", text: "text-sm", button: "h-8 text-sm" };
      case 'large':
        return { card: "mb-6", content: "p-8", text: "text-lg", button: "h-16 text-xl" };
      default:
        return { card: "mb-4", content: "p-6", text: "text-base", button: "h-12 text-lg" };
    }
  };

  const sizeClasses = getSizeClasses();

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsActionInProgress(true);
    try {
      await action();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const holdReasons = [
    "Material shortage",
    "Equipment issue", 
    "Quality check needed",
    "Waiting for approval",
    "Break/Lunch",
    "Other"
  ];

  return (
    <Card className={cn("transition-all duration-200 touch-manipulation", getCardStyle(), sizeClasses.card)}>
      <CardContent className={sizeClasses.content}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className={cn("font-bold text-gray-900 truncate", sizeClasses.text)}>
                {job.wo_no}
              </h3>
              {job.customer && (
                <p className={cn("text-gray-600 truncate", size === 'compact' ? 'text-xs' : 'text-sm')}>
                  {job.customer}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2">
              <div className={cn("w-3 h-3 rounded-full", getStatusColor())} />
              <Badge 
                variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                className={cn("whitespace-nowrap", size === 'compact' ? 'text-xs px-2 py-0' : 'px-3 py-1')}
              >
                {job.current_stage_name || 'Pending'}
              </Badge>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn("font-medium text-gray-700", size === 'compact' ? 'text-xs' : 'text-sm')}>
                Progress
              </span>
              <span className={cn("font-bold text-gray-900", size === 'compact' ? 'text-xs' : 'text-sm')}>
                {Math.round(job.workflow_progress)}%
              </span>
            </div>
            <Progress 
              value={job.workflow_progress} 
              className={cn("transition-all duration-300", size === 'compact' ? 'h-1' : 'h-2')}
            />
            <div className={cn("text-gray-500", size === 'compact' ? 'text-xs' : 'text-sm')}>
              Stage {job.completed_stages} of {job.total_stages}
            </div>
          </div>

          {/* Job Details */}
          {(showFullDetails || size !== 'compact') && (
            <div className="grid grid-cols-1 gap-2">
              {job.due_date && (
                <div className="flex items-center gap-2">
                  <Calendar className={cn("text-gray-400", size === 'compact' ? 'h-3 w-3' : 'h-4 w-4')} />
                  <span className={cn(
                    "font-medium",
                    isOverdue ? "text-red-600" : 
                    isDueSoon ? "text-orange-600" : 
                    "text-gray-700",
                    size === 'compact' ? 'text-xs' : 'text-sm'
                  )}>
                    Due: {new Date(job.due_date).toLocaleDateString()}
                  </span>
                  {isOverdue && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              )}
              
              {job.reference && (
                <div className="flex items-center gap-2">
                  <Package className={cn("text-gray-400", size === 'compact' ? 'h-3 w-3' : 'h-4 w-4')} />
                  <span className={cn("text-gray-700 truncate", size === 'compact' ? 'text-xs' : 'text-sm')}>
                    Ref: {job.reference}
                  </span>
                </div>
              )}

              {job.category_name && (
                <div className="flex items-center gap-2">
                  <div 
                    className={cn("rounded-full", size === 'compact' ? 'w-3 h-3' : 'w-4 h-4')}
                    style={{ backgroundColor: job.category_color || '#6B7280' }}
                  />
                  <span className={cn("text-gray-700", size === 'compact' ? 'text-xs' : 'text-sm')}>
                    {job.category_name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {job.user_can_work && job.current_stage_id && (
            <div className="pt-2 border-t">
              {showHoldReasons ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {holdReasons.map((reason) => (
                      <Button
                        key={reason}
                        onClick={() => {
                          handleAction(() => onHold?.(job.job_id, reason) || Promise.resolve(true));
                          setShowHoldReasons(false);
                        }}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={isActionInProgress}
                      >
                        {reason}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setShowHoldReasons(false)}
                    variant="ghost"
                    size="sm"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  {job.current_stage_status === 'pending' && (
                    <Button 
                      onClick={() => handleAction(() => onStart(job.job_id, job.current_stage_id!))}
                      className={cn(
                        "flex-1 font-semibold bg-green-600 hover:bg-green-700 touch-manipulation",
                        sizeClasses.button
                      )}
                      disabled={isActionInProgress}
                    >
                      <Play className={cn("mr-2", size === 'compact' ? 'h-3 w-3' : 'h-5 w-5')} />
                      Start Job
                    </Button>
                  )}
                  
                  {job.current_stage_status === 'active' && (
                    <>
                      {onHold && (
                        <Button 
                          onClick={() => setShowHoldReasons(true)}
                          variant="outline"
                          className={cn(
                            "flex-1 font-semibold border-orange-500 text-orange-600 hover:bg-orange-50 touch-manipulation",
                            sizeClasses.button
                          )}
                          disabled={isActionInProgress}
                        >
                          <Pause className={cn("mr-2", size === 'compact' ? 'h-3 w-3' : 'h-5 w-5')} />
                          Hold
                        </Button>
                      )}
                      <Button 
                        onClick={() => handleAction(() => onComplete(job.job_id, job.current_stage_id!))}
                        className={cn(
                          "flex-1 font-semibold bg-blue-600 hover:bg-blue-700 touch-manipulation",
                          sizeClasses.button
                        )}
                        disabled={isActionInProgress}
                      >
                        <CheckCircle className={cn("mr-2", size === 'compact' ? 'h-3 w-3' : 'h-5 w-5')} />
                        Complete
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Job Timer */}
          {job.current_stage_status === 'active' && (
            <div className="flex items-center gap-2 pt-2 border-t bg-blue-50 -mx-6 -mb-6 px-6 py-3 rounded-b-lg">
              <Timer className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                Job Active - Track your time
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
