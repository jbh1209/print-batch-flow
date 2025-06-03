
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
  ChevronDown,
  ChevronUp,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface EnhancedOperatorJobCardProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onHold: (jobId: string, reason: string) => Promise<boolean>;
}

const HOLD_REASONS = [
  "Material shortage",
  "Equipment issue", 
  "Quality check needed",
  "Waiting for approval",
  "Break/Lunch",
  "Other issue"
];

export const EnhancedOperatorJobCard: React.FC<EnhancedOperatorJobCardProps> = ({
  job,
  onStart,
  onComplete,
  onHold
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHoldReasons, setShowHoldReasons] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

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

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsActionInProgress(true);
    try {
      await action();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleHoldWithReason = async (reason: string) => {
    await handleAction(() => onHold(job.job_id, reason));
    setShowHoldReasons(false);
  };

  return (
    <Card className={cn("mb-4 transition-all duration-200 touch-manipulation", getCardStyle())}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header - Always Visible */}
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-gray-900 truncate">
                {job.wo_no}
              </h3>
              {job.customer && (
                <p className="text-sm text-gray-600 truncate">
                  {job.customer}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2">
              <div className={cn("w-3 h-3 rounded-full", getStatusColor())} />
              <Badge 
                variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                className="whitespace-nowrap"
              >
                {job.current_stage_name || 'Pending'}
              </Badge>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-bold text-gray-900">{job.workflow_progress}%</span>
            </div>
            <Progress value={job.workflow_progress} className="h-2" />
            <div className="text-xs text-gray-500">
              Stage {job.completed_stages} of {job.total_stages}
            </div>
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-1 gap-2">
            {job.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className={cn(
                  "text-sm font-medium",
                  isOverdue ? "text-red-600" : 
                  isDueSoon ? "text-orange-600" : 
                  "text-gray-700"
                )}>
                  Due: {new Date(job.due_date).toLocaleDateString()}
                </span>
                {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
              </div>
            )}
          </div>

          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-center"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show Details
              </>
            )}
          </Button>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="space-y-3 pt-3 border-t">
              {job.reference && (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Ref: {job.reference}</span>
                </div>
              )}

              {job.category_name && (
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: job.category_color || '#6B7280' }}
                  />
                  <span className="text-sm text-gray-700">{job.category_name}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">Status: {job.status}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {job.user_can_work && job.current_stage_id && (
            <div className="pt-3 border-t">
              {showHoldReasons ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Select hold reason:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {HOLD_REASONS.map((reason) => (
                      <Button
                        key={reason}
                        onClick={() => handleHoldWithReason(reason)}
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
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
                <div className="space-y-2">
                  {job.current_stage_status === 'pending' && (
                    <Button 
                      onClick={() => handleAction(() => onStart(job.job_id, job.current_stage_id!))}
                      className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700 touch-manipulation"
                      disabled={isActionInProgress}
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Start Job
                    </Button>
                  )}
                  
                  {job.current_stage_status === 'active' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={() => setShowHoldReasons(true)}
                        variant="outline"
                        className="h-12 text-lg font-semibold border-orange-500 text-orange-600 hover:bg-orange-50 touch-manipulation"
                        disabled={isActionInProgress}
                      >
                        <Pause className="h-5 w-5 mr-2" />
                        Hold
                      </Button>
                      <Button 
                        onClick={() => handleAction(() => onComplete(job.job_id, job.current_stage_id!))}
                        className="h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 touch-manipulation"
                        disabled={isActionInProgress}
                      >
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Complete
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Job Timer */}
          {job.current_stage_status === 'active' && (
            <div className="flex items-center gap-2 pt-2 border-t bg-blue-50 -mx-6 -mb-6 px-6 py-3 rounded-b-lg">
              <Clock className="h-4 w-4 text-blue-600" />
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
