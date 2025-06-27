
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Tags, 
  Settings, 
  Trash2,
  Users,
  RotateCcw,
  X,
  Workflow,
  Barcode,
  CheckCircle
} from "lucide-react";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface EnhancedProductionJobsListProps {
  jobs: AccessibleJob[];
  onStartJob: (jobId: string, stageId: string) => Promise<boolean>;
  onCompleteJob: (jobId: string, stageId: string) => Promise<boolean>;
  onEditJob: (job: AccessibleJob) => void;
  onCategoryAssign: (job: AccessibleJob) => void;
  onCustomWorkflow: (job: AccessibleJob) => void;
  onDeleteJob: (jobId: string) => void;
  onBulkCategoryAssign: (selectedJobs: AccessibleJob[]) => void;
  onBulkStatusUpdate: (selectedJobs: AccessibleJob[], status: string) => void;
  onBulkDelete: (selectedJobs: AccessibleJob[]) => void;
  onGenerateBarcodes: (selectedJobs: AccessibleJob[]) => void;
  onBulkMarkCompleted?: (selectedJobs: AccessibleJob[]) => void;
  isAdmin?: boolean;
}

export const EnhancedProductionJobsList: React.FC<EnhancedProductionJobsListProps> = ({
  jobs,
  onStartJob,
  onCompleteJob,
  onEditJob,
  onCategoryAssign,
  onCustomWorkflow,
  onDeleteJob,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkDelete,
  onGenerateBarcodes,
  onBulkMarkCompleted,
  isAdmin = false
}) => {
  const [selectedJobs, setSelectedJobs] = useState<AccessibleJob[]>([]);

  // Helper function to determine if a job has a custom workflow using reverse logic
  const hasCustomWorkflow = (job: AccessibleJob) => {
    // Primary check: explicit has_custom_workflow flag
    if (job.has_custom_workflow === true) {
      return true;
    }
    
    // Reverse logic: if job has category but unusual workflow indicators
    if (job.category_name) {
      // If job has category but no current stage (unusual for standard workflows)
      if (!job.current_stage_name && job.total_stages > 0) {
        return true;
      }
      
      // If job has category but workflow progress doesn't match standard patterns
      if (job.workflow_progress && job.workflow_progress > 0 && !job.current_stage_name) {
        return true;
      }
      
      // If job has stages but they don't follow standard naming patterns
      if (job.total_stages > 0 && job.current_stage_name && 
          !['Pre-Press', 'Printing', 'Finishing', 'Quality Control', 'Dispatch'].includes(job.current_stage_name)) {
        return true;
      }
    }
    
    return false;
  };

  const handleSelectJob = (job: AccessibleJob, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.job_id !== job.job_id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(jobs);
    } else {
      setSelectedJobs([]);
    }
  };

  const clearSelection = () => {
    setSelectedJobs([]);
  };

  const isSelected = (job: AccessibleJob) => {
    return selectedJobs.some(j => j.job_id === job.job_id);
  };

  return (
    <div className="space-y-4">
      {/* Sticky Bulk Actions Bar */}
      {selectedJobs.length > 0 && (
        <div className="sticky top-0 z-50 bg-white pb-4">
          <Card className="border-blue-200 bg-blue-50 shadow-lg">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} selected
                  </Badge>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onBulkCategoryAssign(selectedJobs)}
                      className="flex items-center gap-1"
                    >
                      <Users className="h-3 w-3" />
                      Assign Category
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onBulkStatusUpdate(selectedJobs, "printing")}
                      className="flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Update Status
                    </Button>
                    {isAdmin && onBulkMarkCompleted && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onBulkMarkCompleted(selectedJobs)}
                        className="flex items-center gap-1 border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Mark Completed
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onCustomWorkflow(selectedJobs[0])}
                      disabled={selectedJobs.length !== 1}
                      className="flex items-center gap-1"
                    >
                      <Workflow className="h-3 w-3" />
                      Custom Workflow
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onGenerateBarcodes(selectedJobs)}
                      className="flex items-center gap-1"
                    >
                      <Barcode className="h-3 w-3" />
                      Barcode Labels
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => onBulkDelete(selectedJobs)}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={clearSelection}
                  className="flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Production Jobs Overview</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedJobs.length === jobs.length && jobs.length > 0}
                onCheckedChange={handleSelectAll}
                disabled={jobs.length === 0}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {jobs.map((job) => (
              <div 
                key={job.job_id} 
                className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${
                  isSelected(job) ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isSelected(job)}
                    onCheckedChange={(checked) => handleSelectJob(job, checked as boolean)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-lg">{job.wo_no}</h4>
                      {job.category_name && (
                        <Badge variant="secondary" style={{ backgroundColor: job.category_color || '#6B7280', color: 'white' }}>
                          {job.category_name}
                        </Badge>
                      )}
                      {hasCustomWorkflow(job) && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          <Settings className="h-3 w-3 mr-1" />
                          Custom Workflow
                        </Badge>
                      )}
                      {job.current_stage_name && (
                        <Badge 
                          variant={job.current_stage_status === 'active' ? 'default' : 'outline'}
                          style={{ 
                            backgroundColor: job.current_stage_status === 'active' ? job.current_stage_color || '#22C55E' : 'transparent',
                            borderColor: job.current_stage_color || '#6B7280',
                            color: job.current_stage_status === 'active' ? 'white' : job.current_stage_color || '#6B7280'
                          }}
                        >
                          {job.current_stage_name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {job.workflow_progress}% Complete
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span>Customer: {job.customer || 'Unknown'}</span>
                      {job.due_date && (
                        <span> • Due: {new Date(job.due_date).toLocaleDateString()}</span>
                      )}
                      {job.reference && (
                        <span> • Reference: {job.reference}</span>
                      )}
                      <span> • Stages: {job.completed_stages}/{job.total_stages}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <JobActionButtons
                    job={job}
                    onStart={onStartJob}
                    onComplete={onCompleteJob}
                  />
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onEditJob(job)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Job
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem onClick={() => onCategoryAssign(job)}>
                        <Tags className="h-4 w-4 mr-2" />
                        Assign Category
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem onClick={() => onCustomWorkflow(job)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Custom Workflow
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem 
                        onClick={() => onDeleteJob(job.job_id)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Job
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
