import React, { useState, useMemo } from "react";
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
  AlertCircle, 
  Calendar, 
  User, 
  Package, 
  MoreHorizontal, 
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Settings,
  Wrench,
  FileText,
  Trash2
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { formatDistanceToNow } from "date-fns";

interface EnhancedProductionJobsListProps {
  jobs: AccessibleJob[];
  onStartJob: (jobId: string, stageId: string) => Promise<boolean>;
  onCompleteJob: (jobId: string, stageId: string) => Promise<boolean>;
  onEditJob: (job: AccessibleJob) => void;
  onCategoryAssign: (job: AccessibleJob) => void;
  onCustomWorkflow: (job: AccessibleJob) => void;
  onPartAssignment?: (job: AccessibleJob) => void;
  onDeleteJob: (jobId: string) => void;
  onBulkCategoryAssign: (selectedJobs: AccessibleJob[]) => void;
  onBulkStatusUpdate: (selectedJobs: AccessibleJob[], status: string) => void;
  onBulkMarkCompleted: (selectedJobs: AccessibleJob[]) => void;
  onBulkDelete: (selectedJobs: AccessibleJob[]) => void;
  onGenerateBarcodes: (selectedJobs: AccessibleJob[]) => void;
  isAdmin: boolean;
  searchQuery: string;
}

export const EnhancedProductionJobsList: React.FC<EnhancedProductionJobsListProps> = ({
  jobs,
  onStartJob,
  onCompleteJob,
  onEditJob,
  onCategoryAssign,
  onCustomWorkflow,
  onPartAssignment,
  onDeleteJob,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkMarkCompleted,
  onBulkDelete,
  onGenerateBarcodes,
  isAdmin,
  searchQuery
}) => {
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  const isJobSelected = (jobId: string) => selectedJobs.includes(jobId);

  const toggleJobSelection = (jobId: string) => {
    if (isJobSelected(jobId)) {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    } else {
      setSelectedJobs([...selectedJobs, jobId]);
    }
  };

  const allJobsSelected = useMemo(() => {
    return jobs.length > 0 && selectedJobs.length === jobs.length;
  }, [jobs.length, selectedJobs.length]);

  const toggleSelectAll = () => {
    if (allJobsSelected) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(jobs.map(job => job.job_id));
    }
  };

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) {
      return jobs;
    }
    
    const query = searchQuery.toLowerCase();
    return jobs.filter(job => 
      job.reference?.toLowerCase().includes(query) ||
      job.customer?.toLowerCase().includes(query) ||
      job.wo_no?.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'active': return <Play className="h-4 w-4 text-blue-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-orange-600" />;
      case 'paused': return <Pause className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>
          Production Jobs
          {selectedJobs.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedJobs.length} Selected
            </Badge>
          )}
        </CardTitle>
        {jobs.length > 0 && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => onGenerateBarcodes(jobs.filter(job => selectedJobs.includes(job.job_id)))}>
              Generate Barcodes
            </Button>
            {isAdmin && (
              <Button variant="destructive" size="sm" onClick={() => onBulkDelete(jobs.filter(job => selectedJobs.includes(job.job_id)))}>
                Delete Selected
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => onBulkMarkCompleted(jobs.filter(job => selectedJobs.includes(job.job_id)))}>
              Mark as Completed
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onBulkStatusUpdate(jobs.filter(job => selectedJobs.includes(job.job_id)), 'pending')}>
              Mark as Pending
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onBulkCategoryAssign(jobs.filter(job => selectedJobs.includes(job.job_id)))}>
              Assign Category
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="[&_th]:font-semibold">
            <tr className="border-b">
              <th className="p-4 w-10">
                <Checkbox
                  checked={allJobsSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th className="p-4 text-left">WO Number</th>
              <th className="p-4 text-left">Customer</th>
              <th className="p-4 text-left">Reference</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Category</th>
              <th className="p-4 text-left">Current Stage</th>
              <th className="p-4 text-left">Due Date</th>
              <th className="p-4 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map((job) => (
              <tr key={job.job_id} className="border-b">
                <td className="p-4">
                  <Checkbox
                    checked={isJobSelected(job.job_id)}
                    onCheckedChange={() => toggleJobSelection(job.job_id)}
                  />
                </td>
                <td className="p-4">{job.wo_no}</td>
                <td className="p-4">{job.customer}</td>
                <td className="p-4">{job.reference}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <span className="capitalize">{job.status}</span>
                  </div>
                </td>
                <td className="p-4">
                  <Badge className="capitalize" style={{ backgroundColor: job.category_color, color: 'white' }}>
                    {job.category_name}
                  </Badge>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {job.current_stage_status === 'active' ? (
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={async () => {
                          const success = await onCompleteJob(job.job_id, job.current_stage_id || '');
                          if (success) {
                            console.log('Job completed successfully');
                          } else {
                            console.error('Failed to complete job');
                          }
                        }}
                      >
                        Complete
                      </Button>
                    ) : (
                      <Badge variant="outline" className="capitalize" style={{ color: job.current_stage_color }}>
                        {job.display_stage_name}
                      </Badge>
                    )}
                    {job.current_stage_status === 'pending' && (
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={async () => {
                          const success = await onStartJob(job.job_id, job.current_stage_id || '');
                          if (success) {
                            console.log('Job started successfully');
                          } else {
                            console.error('Failed to start job');
                          }
                        }}
                      >
                        Start
                      </Button>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  {job.due_date ? (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 opacity-75" />
                      <span>{formatDistanceToNow(new Date(job.due_date), { addSuffix: true })}</span>
                    </div>
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </td>
                <td className="p-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditJob(job)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Edit Job
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCategoryAssign(job)}>
                        <Package className="h-4 w-4 mr-2" />
                        Assign Category
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCustomWorkflow(job)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Custom Workflow
                      </DropdownMenuItem>
                      {onPartAssignment && (
                        <DropdownMenuItem onClick={() => onPartAssignment(job)}>
                          <Wrench className="h-4 w-4 mr-2" />
                          Assign Parts
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDeleteJob(job.job_id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Job
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
