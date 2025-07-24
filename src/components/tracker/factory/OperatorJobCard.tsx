
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  User, 
  Clock, 
  AlertTriangle
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { cn } from "@/lib/utils";
import { SubSpecificationBadge } from "../common/SubSpecificationBadge";

interface OperatorJobCardProps {
  job: AccessibleJob;
  onStart?: (jobId: string, stageId: string) => void;
  onComplete?: (jobId: string, stageId: string) => void;
  onClick?: () => void;
}

export const OperatorJobCard: React.FC<OperatorJobCardProps> = ({
  job,
  onClick
}) => {
  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const getCardStyle = () => {
    if (isOverdue) return "border-red-400 bg-red-50";
    if (isDueSoon) return "border-orange-400 bg-orange-50";
    if (job.current_stage_status === 'active') return "border-green-400 bg-green-50";
    return "border-gray-200 bg-white";
  };

  const getStatusBadge = () => {
    if (job.current_stage_status === 'active') {
      return <Badge className="bg-green-500 text-white">Active</Badge>;
    }
    if (job.current_stage_status === 'pending') {
      return <Badge variant="outline">Ready</Badge>;
    }
    return <Badge variant="secondary">{job.current_stage_status}</Badge>;
  };

  const getPriorityIcon = () => {
    if (isOverdue) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (isDueSoon) return <Clock className="h-4 w-4 text-orange-500" />;
    return null;
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-all touch-manipulation",
        getCardStyle()
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {getPriorityIcon()}
                <h3 className="font-semibold text-lg truncate">{job.wo_no}</h3>
              </div>
              {job.current_stage_name && (
                <div className="mt-1">
                  <p className="text-sm text-gray-600 mb-1">{job.current_stage_name}</p>
                  <SubSpecificationBadge 
                    jobId={job.job_id}
                    stageId={job.current_stage_id}
                    compact={true}
                  />
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              {getStatusBadge()}
            </div>
          </div>

          {/* Customer */}
          {job.customer && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm font-medium truncate">{job.customer}</span>
            </div>
          )}

          {/* Due Date */}
          {job.due_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className={cn(
                "text-sm",
                isOverdue ? "text-red-600 font-medium" : 
                isDueSoon ? "text-orange-600 font-medium" : 
                "text-gray-600"
              )}>
                Due: {new Date(job.due_date).toLocaleDateString()}
                {isOverdue && " (OVERDUE)"}
              </span>
            </div>
          )}

          {/* Progress */}
          {job.workflow_progress !== undefined && job.workflow_progress > 0 && (
            <div className="w-full">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span>{job.workflow_progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${job.workflow_progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Click to open modal hint */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t">
            Click to view details and manage job
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
