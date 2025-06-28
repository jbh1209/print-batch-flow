
import React from "react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { CompactDtpJobCard } from "@/components/tracker/factory/CompactDtpJobCard";

interface ProductionJobsViewProps {
  jobs: AccessibleJob[];
  selectedStage: string | null;
  isLoading: boolean;
  onJobClick: (job: AccessibleJob) => void;
  onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete') => Promise<void>;
}

export const ProductionJobsView: React.FC<ProductionJobsViewProps> = ({
  jobs,
  selectedStage,
  isLoading,
  onJobClick,
  onStageAction
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading jobs...</span>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">
          {selectedStage 
            ? `No jobs found for stage: ${selectedStage}`
            : "No jobs found"
          }
        </p>
      </div>
    );
  }

  const handleStart = async (jobId: string, stageId: string) => {
    await onStageAction(jobId, stageId, 'start');
    return true;
  };

  const handleComplete = async (jobId: string, stageId: string) => {
    await onStageAction(jobId, stageId, 'complete');
    return true;
  };

  return (
    <div className="space-y-1">
      {jobs.map((job) => {
        const isOverdue = job.due_date && new Date(job.due_date) < new Date();
        const isDueSoon = job.due_date && !isOverdue && 
          new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

        return (
          <div 
            key={job.job_id}
            className={`flex items-center gap-4 p-2 hover:bg-gray-50 cursor-pointer border-l-4 ${
              job.current_stage_status === 'active' ? 'border-blue-500 bg-blue-50' :
              isOverdue ? 'border-red-500 bg-red-50' :
              isDueSoon ? 'border-orange-500 bg-orange-50' :
              'border-gray-200'
            }`}
            onClick={() => onJobClick(job)}
          >
            {/* Due indicator */}
            <div className="w-8 text-center">
              {isOverdue && (
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
              {isDueSoon && !isOverdue && (
                <div className="w-3 h-3 bg-orange-500 rounded-full" />
              )}
            </div>

            {/* Job details */}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-gray-900">
                {job.wo_no}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {job.customer || 'Unknown Customer'}
                {job.reference && (
                  <span className="ml-2">
                    Ref: {job.reference}
                  </span>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div className="w-32 text-xs">
              {job.due_date ? (
                <span className={`${
                  isOverdue ? 'text-red-600 font-medium' : 
                  isDueSoon ? 'text-orange-600 font-medium' : 
                  'text-gray-600'
                }`}>
                  {new Date(job.due_date).toLocaleDateString()}
                </span>
              ) : (
                <span className="text-gray-400">No due date</span>
              )}
            </div>

            {/* Current Stage */}
            <div className="w-40 text-xs">
              {job.current_stage_name ? (
                <span 
                  className={`px-2 py-1 rounded text-white text-xs ${
                    job.current_stage_status === 'active' ? 'bg-green-600' : 'bg-gray-500'
                  }`}
                  style={{ 
                    backgroundColor: job.current_stage_status === 'active' 
                      ? job.current_stage_color || '#22C55E' 
                      : '#6B7280' 
                  }}
                >
                  {job.current_stage_name}
                </span>
              ) : (
                <span className="text-gray-400">No Stage</span>
              )}
            </div>

            {/* Progress */}
            <div className="w-24 text-xs text-center">
              <div className="flex items-center gap-1">
                <div className="w-8 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${job.workflow_progress}%` }}
                  />
                </div>
                <span className="text-gray-600 font-medium">
                  {job.workflow_progress}%
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="w-24 text-right">
              {job.user_can_work && job.current_stage_id && (
                <div className="flex gap-1 justify-end">
                  {job.current_stage_status === 'pending' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStart(job.job_id, job.current_stage_id!);
                      }}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      Start
                    </button>
                  )}
                  {job.current_stage_status === 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplete(job.job_id, job.current_stage_id!);
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Complete
                    </button>
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
