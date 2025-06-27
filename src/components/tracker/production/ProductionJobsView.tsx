
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, Play, CheckCircle } from "lucide-react";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useJobRowColors } from "@/hooks/tracker/useJobRowColors";

interface ProductionJobsViewProps {
  jobs: AccessibleJob[];
  selectedStage: string | null;
  isLoading: boolean;
  onJobClick: (job: AccessibleJob) => void;
  onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => void;
}

export const ProductionJobsView: React.FC<ProductionJobsViewProps> = ({
  jobs,
  selectedStage,
  isLoading,
  onJobClick,
  onStageAction
}) => {
  // Use the job row colors hook for traffic light color coding
  const jobRowColors = useJobRowColors(jobs);

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getDaysOverdue = (dueDate?: string) => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = now.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getProgressPercentage = (job: AccessibleJob) => {
    // Calculate progress based on workflow completion
    if (job.workflow_progress !== undefined) {
      return job.workflow_progress;
    }
    // Fallback calculation if workflow_progress is not available
    return 0;
  };

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No jobs in this stage</p>
          <p className="text-sm">Jobs will appear here when they enter this workflow stage</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {jobs.map((job) => {
        const overdue = isOverdue(job.due_date);
        const daysOverdue = overdue ? getDaysOverdue(job.due_date) : 0;
        const progress = getProgressPercentage(job);
        const rowColorClass = jobRowColors[job.job_id] || '';

        return (
          <div
            key={job.job_id}
            className={`flex items-center gap-4 py-2 px-2 hover:bg-gray-50 border-b border-gray-100 cursor-pointer transition-colors ${rowColorClass}`}
            onClick={() => onJobClick(job)}
          >
            {/* Due Status Indicator - Fixed width */}
            <div className="w-8 flex justify-center">
              {overdue ? (
                <div title={`${daysOverdue}d overdue`}>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
              ) : (
                <div className="w-4 h-4" />
              )}
            </div>

            {/* Job Name/Number - Flexible width */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{job.wo_no}</div>
              {job.customer && (
                <div className="text-xs text-gray-500 truncate">{job.customer}</div>
              )}
            </div>

            {/* Due Date - Fixed wider width */}
            <div className="w-32 text-sm">
              {job.due_date ? (
                <div className={`flex items-center gap-1 ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
                  <Calendar className="h-3 w-3" />
                  <span className="truncate">
                    {new Date(job.due_date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: new Date(job.due_date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                    })}
                  </span>
                </div>
              ) : (
                <span className="text-gray-400 text-xs">No due date</span>
              )}
            </div>

            {/* Current Stage - Fixed wider width */}
            <div className="w-40">
              {job.current_stage_name ? (
                <Badge 
                  variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                  className="text-xs px-2 py-1 truncate max-w-full"
                  style={{ 
                    backgroundColor: job.current_stage_color || undefined,
                    color: job.current_stage_color ? 'white' : undefined
                  }}
                >
                  {job.current_stage_name}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">No Stage</Badge>
              )}
            </div>

            {/* Progress - Fixed width */}
            <div className="w-24">
              {progress > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-8">{progress}%</span>
                </div>
              ) : (
                <span className="text-xs text-gray-400">0%</span>
              )}
            </div>

            {/* Action Buttons - Fixed width */}
            <div className="w-24 flex justify-end">
              {job.current_stage_id && (
                <div className="flex gap-1">
                  {job.current_stage_status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStageAction(job.job_id, job.current_stage_id!, 'start');
                      }}
                      className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                  {job.current_stage_status === 'active' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStageAction(job.job_id, job.current_stage_id!, 'complete');
                      }}
                      className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
