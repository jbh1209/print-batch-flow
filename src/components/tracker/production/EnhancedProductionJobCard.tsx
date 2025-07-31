
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  User, 
  Package, 
  MapPin, 
  Clock,
  CheckCircle,
  Play,
  MoreHorizontal
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { JobSpecificationCard } from "../common/JobSpecificationCard";
import { PartAssignmentIndicator } from "../common/PartAssignmentIndicator";
import { StageProgressIndicator } from "../common/StageProgressIndicator";
import { SubSpecificationBadge } from "../common/SubSpecificationBadge";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { getStageContextForJob, canStartContextStage, canCompleteContextStage } from "@/utils/stageContextUtils";

interface EnhancedProductionJobCardProps {
  job: AccessibleJob;
  contextStageName?: string | null;
  onJobClick?: (job: AccessibleJob) => void;
  onStageAction?: (jobId: string, stageId: string, action: 'start' | 'complete') => void;
  onAssignParts?: (job: AccessibleJob) => void;
  showDetails?: boolean;
}

export const EnhancedProductionJobCard: React.FC<EnhancedProductionJobCardProps> = ({
  job,
  contextStageName,
  onJobClick,
  onStageAction,
  onAssignParts,
  showDetails = true
}) => {
  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  // Get stage context for this job
  const stageContext = getStageContextForJob(job, contextStageName);
  const canStart = canStartContextStage(job, stageContext);
  const canComplete = canCompleteContextStage(job, stageContext);

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
        isOverdue ? 'border-red-300 bg-red-50' : 
        isDueSoon ? 'border-orange-300 bg-orange-50' : 
        'border-gray-200 bg-white'
      }`}
      onClick={() => onJobClick?.(job)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
            <Badge 
                variant={stageContext.stageStatus === 'active' ? 'default' : 'secondary'}
                className="font-semibold"
              >
                {job.wo_no}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  Overdue
                </Badge>
              )}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm">
                <User className="h-3 w-3 text-gray-400" />
                <span className="truncate">{job.customer || 'Unknown Customer'}</span>
              </div>
              
              {job.due_date && (
                <div className="flex items-center gap-1 text-sm">
                  <Calendar className="h-3 w-3 text-gray-400" />
                  <span className={
                    isOverdue ? 'text-red-600 font-medium' : 
                    isDueSoon ? 'text-orange-600 font-medium' : 
                    'text-gray-600'
                  }>
                    {new Date(job.due_date).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              {job.qty && (
                <div className="flex items-center gap-1 text-sm">
                  <Package className="h-3 w-3 text-gray-400" />
                  <span>Qty: {job.qty}</span>
                </div>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onAssignParts && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onAssignParts(job);
                }}>
                  <Package className="h-4 w-4 mr-2" />
                  Assign Parts
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stage Progress */}
        <StageProgressIndicator
          stages={[]} // Would need to pass actual stage data
          currentStageId={stageContext.stageId}
          workflowProgress={job.workflow_progress}
          compact={true}
          showPartInfo={true}
          jobId={job.job_id}
        />

        {/* Current Stage Sub-Specifications */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600">
            {stageContext.stageName} Details:
          </div>
          <SubSpecificationBadge 
            jobId={job.job_id}
            partAssignment={job.is_virtual_stage_entry ? job.part_assignment : undefined}
            stageId={stageContext.stageId}
            compact={false}
          />
        </div>

        {/* Job Specifications */}
        {showDetails && (
          <JobSpecificationCard
            jobId={job.job_id}
            jobTableName="production_jobs"
            compact={true}
          />
        )}

        {/* Part Assignment Status */}
        <PartAssignmentIndicator
          categoryId={job.category_id}
          compact={true}
        />

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t">
          {canStart && stageContext.stageId && (
            <Button 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                onStageAction?.(job.job_id, stageContext.stageId, 'start');
              }}
              className="flex-1"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          
          {canComplete && stageContext.stageId && (
            <Button 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                onStageAction?.(job.job_id, stageContext.stageId, 'complete');
              }}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </Button>
          )}
          
          {!canStart && !canComplete && (
            <div className="text-xs text-gray-500 text-center flex-1 py-2">
              {stageContext.stageStatus === 'completed' ? 'Stage Completed' : 'Waiting'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
