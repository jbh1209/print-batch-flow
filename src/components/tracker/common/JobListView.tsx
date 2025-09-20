
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Clock, User, Calendar, Package } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { cn } from "@/lib/utils";
import { SubSpecificationBadge } from "./SubSpecificationBadge";
import { ProofStatusIndicator } from "../factory/ProofStatusIndicator";

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

  // Check if this job is in proof stage
  const isProofJob = (job: AccessibleJob) => {
    return job.current_stage_name && job.current_stage_name.toLowerCase().includes('proof');
  };

  // Get proof status for job  
  const getProofStatus = (job: AccessibleJob) => {
    if (job.proof_approved_at) {
      return 'completed'; // Proof approved, ready for production
    }
    if (job.proof_emailed_at) {
      return 'awaiting_approval'; // Proof sent, waiting for approval
    }
    return null;
  };

  // Get row styling based on proof status
  const getRowClassName = (job: AccessibleJob) => {
    const baseClasses = "p-3 hover:bg-gray-50 cursor-pointer transition-colors";
    
    if (isProofJob(job)) {
      // Proof approved - ready for production (green)
      if (job.proof_approved_at) {
        return `${baseClasses} bg-green-50 border-l-4 border-l-green-500`;
      }
      
      // Proof emailed - awaiting approval with urgency levels
      if (job.proof_emailed_at) {
        const daysSinceProof = Math.floor((Date.now() - new Date(job.proof_emailed_at).getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceProof >= 3) {
          return `${baseClasses} bg-red-50 border-l-4 border-l-red-500`; // Critical urgency
        } else if (daysSinceProof >= 1) {
          return `${baseClasses} bg-orange-50 border-l-4 border-l-orange-500`; // Warning urgency
        } else {
          return `${baseClasses} bg-blue-50 border-l-4 border-l-blue-500`; // Normal proof status
        }
      }
    }
    
    return baseClasses;
  };

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-0">
        <div className="divide-y">
          {jobs.map((job) => (
            <div
              key={job.job_id}
              className={getRowClassName(job)}
              onClick={() => onJobClick?.(job)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-3 flex-wrap">
                     <h4 className="font-medium text-sm">{job.wo_no}</h4>
                     
                     {/* FIXED: Single status badge - show proof approval status or current stage */}
                     {job.proof_approved_at ? (
                       <Badge variant="outline" className="factory-success text-xs px-1.5 py-0.5 font-semibold">
                         <CheckCircle className="h-3 w-3 mr-1" />
                         READY FOR PRODUCTION
                       </Badge>
                     ) : (
                       <Badge 
                         variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                         className="text-xs px-1.5 py-0.5"
                       >
                         {job.current_stage_name} - {job.current_stage_status === 'active' ? 'Active' : 'Pending'}
                       </Badge>
                     )}
                     
                     <SubSpecificationBadge 
                       jobId={job.job_id}
                       stageId={job.current_stage_id}
                       compact={true}
                     />
                   </div>
                  
                   <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                     <div className="flex items-center gap-1">
                       <User className="h-3 w-3" />
                       <span>{job.customer || 'Unknown'}</span>
                     </div>
                     {/* ADDED: Contact information display */}
                     {job.contact && (
                       <div className="flex items-center gap-1">
                         <User className="h-3 w-3" />
                         <span>Contact: {job.contact}</span>
                       </div>
                     )}
                    {job.due_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(job.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                     {job.started_by_name && (
                       <div className="flex items-center gap-1">
                         <User className="h-3 w-3" />
                         <span>Last worked by: {job.started_by_name}</span>
                       </div>
                     )}
                     {job.workflow_progress > 0 && (
                       <div className="flex items-center gap-1">
                         <Clock className="h-3 w-3" />
                         <span>{Math.round(job.workflow_progress)}%</span>
                       </div>
                     )}
                   </div>
                   
                     {/* FIXED: Only show proof indicator for jobs awaiting approval (not approved ones) */}
                     {isProofJob(job) && job.proof_emailed_at && !job.proof_approved_at && (
                       <div className="mt-2">
                         <ProofStatusIndicator
                           stageInstance={{
                             status: 'awaiting_approval',
                             proof_emailed_at: job.proof_emailed_at,
                             updated_at: job.proof_emailed_at
                           }}
                           variant="default"
                           showTimeElapsed={true}
                         />
                       </div>
                     )}
                 </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {job.current_stage_status === 'pending' && onStart && (
                    <Button
                      size="sm"
                      onClick={(e) => handleJobAction(e, job, 'start')}
                      className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  )}
                  {job.current_stage_status === 'active' && onComplete && (
                    <Button
                      size="sm"
                      onClick={(e) => handleJobAction(e, job, 'complete')}
                      className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Button>
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
