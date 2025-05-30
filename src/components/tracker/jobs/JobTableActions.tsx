
import React from "react";
import { Button } from "@/components/ui/button";
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
  Trash2, 
  Play,
  CheckCircle,
  RefreshCw
} from "lucide-react";
import { MobileJobActions } from "./MobileJobActions";

interface JobTableActionsProps {
  job: any;
  onJobUpdate: () => void;
  onEditJob: (job: any) => void;
  onSyncJob: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onWorkflowInit: (job: any) => void;
  onDeleteJob: (jobId: string) => void;
}

export const JobTableActions: React.FC<JobTableActionsProps> = ({
  job,
  onJobUpdate,
  onEditJob,
  onSyncJob,
  onCategoryAssign,
  onWorkflowInit,
  onDeleteJob
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Mobile Actions (visible on mobile) */}
      <div className="md:hidden">
        <MobileJobActions
          job={job}
          onJobUpdate={onJobUpdate}
          onEditJob={() => onEditJob(job)}
          onSyncJob={() => onSyncJob(job)}
        />
      </div>

      {/* Desktop Actions (hidden on mobile) */}
      <div className="hidden md:block">
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
            <DropdownMenuItem onClick={() => onSyncJob(job)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Data
            </DropdownMenuItem>
            {!job.category_id && (
              <DropdownMenuItem onClick={() => onCategoryAssign(job)}>
                <Play className="h-4 w-4 mr-2" />
                Assign Category
              </DropdownMenuItem>
            )}
            {job.category_id && !job.has_workflow && (
              <DropdownMenuItem onClick={() => onWorkflowInit(job)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Initialize Workflow
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDeleteJob(job.id)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
