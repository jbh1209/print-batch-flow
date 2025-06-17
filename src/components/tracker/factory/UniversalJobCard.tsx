
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import { JobStatusDisplay } from "@/components/tracker/common/JobStatusDisplay";
import { Package, User, Tag, Calendar, AlertTriangle } from "lucide-react";
import { 
  processJobStatus, 
  isJobOverdue, 
  isJobDueSoon
} from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";

interface UniversalJobCardProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onJobClick?: (job: AccessibleJob) => void;
  showActions?: boolean;
}

export const UniversalJobCard: React.FC<UniversalJobCardProps> = ({
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

  // Display components
  const showQuantity = job.qty && job.qty > 0;
  const showOperator = job.started_by_name && job.started_by_name !== 'Unknown' && job.started_by_name !== '';
  const showCategory = job.category_name && job.category_name !== 'No Category';
  const showDueDate = job.due_date;

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
            
            {/* Priority Indicators */}
            <div className="flex items-center gap-1">
              {isOverdue && (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              {isDueSoon && !isOverdue && (
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              )}
            </div>
          </div>

          {/* Category Badge */}
          {showCategory && (
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              <Badge 
                variant="outline" 
                className="text-xs"
                style={{ 
                  borderColor: job.category_color,
                  color: job.category_color 
                }}
              >
                {job.category_name}
              </Badge>
            </div>
          )}

          {/* Job Details Row */}
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
            {showQuantity && (
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                <span>Qty: {job.qty.toLocaleString()}</span>
              </div>
            )}
            
            {showOperator && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-blue-500" />
                <span className="font-medium text-blue-600 truncate">{job.started_by_name}</span>
              </div>
            )}
            
            {showDueDate && (
              <div className="flex items-center gap-1 col-span-2">
                <Calendar className="h-3 w-3" />
                <span className={cn(
                  "font-medium",
                  isOverdue ? "text-red-600" : 
                  isDueSoon ? "text-orange-600" : "text-gray-700"
                )}>
                  Due: {new Date(job.due_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Status Display */}
          <JobStatusDisplay 
            job={job} 
            showDetails={false}
            compact={true}
          />

          {/* Reference Info */}
          {job.reference && (
            <div className="text-xs text-gray-500 truncate">
              Ref: {job.reference}
            </div>
          )}

          {/* Workflow Progress */}
          {job.workflow_progress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${job.workflow_progress}%` }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Progress: {job.workflow_progress}%
              </p>
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
                layout="horizontal"
                compact={true}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
