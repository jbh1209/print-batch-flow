
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Edit, 
  Tag, 
  Settings, 
  Trash2, 
  Play, 
  CheckCircle,
  Package
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface JobRowProps {
  job: AccessibleJob;
  isSelected: boolean;
  hasCustomWorkflow: boolean;
  rowColorClass: string;
  onSelectJob: (job: AccessibleJob, checked: boolean) => void;
  onStartJob: (jobId: string, stageId: string) => Promise<boolean>;
  onCompleteJob: (jobId: string, stageId: string) => Promise<boolean>;
  onEditJob: (job: AccessibleJob) => void;
  onCategoryAssign: (job: AccessibleJob) => void;
  onCustomWorkflow: (job: AccessibleJob) => void;
  onAssignParts: (job: AccessibleJob) => void;
  onDeleteJob: (jobId: string) => void;
}

export const JobRow: React.FC<JobRowProps> = ({
  job,
  isSelected,
  hasCustomWorkflow,
  rowColorClass,
  onSelectJob,
  onStartJob,
  onCompleteJob,
  onEditJob,
  onCategoryAssign,
  onCustomWorkflow,
  onAssignParts,
  onDeleteJob
}) => {
  const handleStartJob = async () => {
    if (job.current_stage_id) {
      await onStartJob(job.job_id, job.current_stage_id);
    }
  };

  const handleCompleteJob = async () => {
    if (job.current_stage_id) {
      await onCompleteJob(job.job_id, job.current_stage_id);
    }
  };

  return (
    <div className={`border rounded-lg p-4 hover:bg-gray-50 ${rowColorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectJob(job, checked as boolean)}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{job.wo_no}</span>
              <Badge variant="outline" className="text-xs">
                {job.customer}
              </Badge>
              {hasCustomWorkflow && (
                <Badge variant="secondary" className="text-xs">
                  Custom Workflow
                </Badge>
              )}
            </div>
            
            <div className="text-sm text-gray-600 mb-2">
              {job.reference} • Qty: {job.qty}
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Badge 
                style={{ backgroundColor: job.category_color }}
                className="text-white"
              >
                {job.category_name}
              </Badge>
              <Badge 
                variant="outline" 
                style={{ borderColor: job.current_stage_color }}
              >
                {job.display_stage_name}
              </Badge>
              <span className="text-gray-500">
                Progress: {job.completed_stages}/{job.total_stages}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {job.current_stage_status === 'pending' && job.user_can_work && (
            <Button
              size="sm"
              onClick={handleStartJob}
              className="flex items-center gap-1"
            >
              <Play className="h-3 w-3" />
              Start
            </Button>
          )}
          
          {job.current_stage_status === 'active' && job.user_can_work && (
            <Button
              size="sm"
              onClick={handleCompleteJob}
              className="flex items-center gap-1"
            >
              <CheckCircle className="h-3 w-3" />
              Complete
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditJob(job)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Job
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => onCategoryAssign(job)}>
                <Tag className="h-4 w-4 mr-2" />
                Assign Category
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => onCustomWorkflow(job)}>
                <Settings className="h-4 w-4 mr-2" />
                Custom Workflow
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => onAssignParts(job)}>
                <Package className="h-4 w-4 mr-2" />
                Assign Parts
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={() => onDeleteJob(job.job_id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
