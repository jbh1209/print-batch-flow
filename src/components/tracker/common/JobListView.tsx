
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Clock, User, Calendar, Package, Mail } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { cn } from "@/lib/utils";

interface JobListViewProps {
  jobs: AccessibleJob[];
  onStart?: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete?: (jobId: string, stageId: string) => Promise<boolean>;
  onJobClick?: (job: AccessibleJob) => void;
  className?: string;
}

export const JobListView: React.FC<JobListViewProps> = ({
  jobs,
  onStart,
  onComplete,
  onJobClick,
  className
}) => {
  const handleJobAction = async (e: React.MouseEvent, job: AccessibleJob, action: 'start' | 'complete') => {
    e.stopPropagation();
    if (!job.current_stage_id) return;
    
    if (action === 'start' && onStart) {
      await onStart(job.job_id, job.current_stage_id);
    } else if (action === 'complete' && onComplete) {
      await onComplete(job.job_id, job.current_stage_id);
    }
  };

  const isProofEmailSent = (job: AccessibleJob) => {
    return job.proof_emailed_at && job.current_stage_name?.toLowerCase().includes('proof');
  };

  const isAwaitingClientSignOff = (job: AccessibleJob) => {
    return isProofEmailSent(job) && job.current_stage_status === 'active';
  };

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-0">
        <div className="divide-y">
          {jobs.map((job) => (
            <div
              key={job.job_id}
              className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onJobClick?.(job)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-sm">{job.wo_no}</h4>
                    
                    {isAwaitingClientSignOff(job) ? (
                      <Badge className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 border-blue-300">
                        <Mail className="h-3 w-3 mr-1" />
                        Awaiting Client Sign Off
                      </Badge>
                    ) : (
                      <Badge 
                        variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                        className="text-xs px-1.5 py-0.5"
                      >
                        {job.current_stage_name}
                      </Badge>
                    )}
                    
                    <Badge 
                      variant={job.current_stage_status === 'active' ? 'success' : 'outline'}
                      className="text-xs px-1.5 py-0.5"
                    >
                      {job.current_stage_status === 'active' ? 'Active' : 'Pending'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{job.customer || 'Unknown'}</span>
                    </div>
                    
                    {job.qty && job.qty > 0 && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>Qty: {job.qty.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {job.started_by_name && job.started_by_name !== 'Unknown' && job.started_by_name !== '' && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-blue-500" />
                        <span className="font-medium text-blue-600">{job.started_by_name}</span>
                      </div>
                    )}
                    
                    {job.due_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(job.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {job.category_name && job.category_name !== 'No Category' && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>{job.category_name}</span>
                      </div>
                    )}
                    
                    {job.workflow_progress > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{job.workflow_progress}%</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {job.current_stage_status === 'pending' && onStart && !isAwaitingClientSignOff(job) && (
                    <Button
                      size="sm"
                      onClick={(e) => handleJobAction(e, job, 'start')}
                      className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  )}
                  {job.current_stage_status === 'active' && onComplete && !isAwaitingClientSignOff(job) && (
                    <Button
                      size="sm"
                      onClick={(e) => handleJobAction(e, job, 'complete')}
                      className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Button>
                  )}
                  {isAwaitingClientSignOff(job) && (
                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                      <Mail className="h-3 w-3 mr-1" />
                      Awaiting
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
