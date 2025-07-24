import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  User, 
  Package, 
  Play,
  CheckCircle,
  MoreHorizontal
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { SubSpecificationBadge } from "../common/SubSpecificationBadge";

interface ProductionJobsListProps {
  jobs: AccessibleJob[];
  onJobClick: (job: AccessibleJob) => void;
  onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => void;
  onAssignParts?: (job: AccessibleJob) => void;
}

export const ProductionJobsList: React.FC<ProductionJobsListProps> = ({
  jobs,
  onJobClick,
  onStageAction,
  onAssignParts
}) => {
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="bg-gray-50 border-b px-4 py-3">
        <div className="grid grid-cols-12 gap-4 items-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
          <div className="col-span-2">Job</div>
          <div className="col-span-2">Customer</div>
          <div className="col-span-1">Due Date</div>
          <div className="col-span-1">Qty</div>
          <div className="col-span-2">Current Stage</div>
          <div className="col-span-3">Sub-Specifications</div>
          <div className="col-span-1">Actions</div>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y">
        {jobs.map((job) => {
          const isOverdue = job.due_date && new Date(job.due_date) < new Date();
          const isDueSoon = job.due_date && !isOverdue && 
            new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          const canStart = job.user_can_work && job.current_stage_status === 'pending';
          const canComplete = job.user_can_work && job.current_stage_status === 'active';

          return (
            <div 
              key={job.job_id}
              className={`grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                isOverdue ? 'bg-red-50 border-l-4 border-red-500' : 
                isDueSoon ? 'bg-orange-50 border-l-4 border-orange-500' : ''
              }`}
              onClick={() => onJobClick(job)}
            >
              {/* Job */}
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
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
              </div>

              {/* Customer */}
              <div className="col-span-2">
                <div className="flex items-center gap-1 text-sm">
                  <User className="h-3 w-3 text-gray-400" />
                  <span className="truncate">{job.customer || 'Unknown Customer'}</span>
                </div>
              </div>

              {/* Due Date */}
              <div className="col-span-1">
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
              </div>

              {/* Quantity */}
              <div className="col-span-1">
                {job.qty && (
                  <div className="flex items-center gap-1 text-sm">
                    <Package className="h-3 w-3 text-gray-400" />
                    <span>{job.qty}</span>
                  </div>
                )}
              </div>

              {/* Current Stage */}
              <div className="col-span-2">
                <Badge variant="outline" className="text-xs">
                  {job.current_stage_name || job.display_stage_name || 'Unknown Stage'}
                </Badge>
              </div>

              {/* Sub-Specifications */}
              <div className="col-span-3">
                <SubSpecificationBadge 
                  jobId={job.job_id}
                  stageId={job.current_stage_id}
                  compact={true}
                />
              </div>

              {/* Actions */}
              <div className="col-span-1">
                <div className="flex items-center gap-1">
                  {canStart && job.current_stage_id && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStageAction(job.job_id, job.current_stage_id!, 'start');
                      }}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {canComplete && job.current_stage_id && (
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onStageAction(job.job_id, job.current_stage_id!, 'complete');
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  )}

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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};