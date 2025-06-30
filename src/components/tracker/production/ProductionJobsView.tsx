
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Package, AlertTriangle } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { BatchAllocationIndicator } from "./BatchAllocationIndicator";
import { useBatchAllocationStage } from "@/hooks/tracker/useBatchAllocationStage";

interface ProductionJobsViewProps {
  jobs: AccessibleJob[];
  selectedStage?: string | null;
  isLoading: boolean;
  onJobClick: (job: AccessibleJob) => void;
  onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete' | 'scan') => void;
}

export const ProductionJobsView: React.FC<ProductionJobsViewProps> = ({
  jobs,
  selectedStage,
  isLoading,
  onJobClick,
  onStageAction
}) => {
  const { completeBatchAllocation, isProcessing } = useBatchAllocationStage();

  const handleAdvanceToPrinting = async (jobId: string) => {
    const success = await completeBatchAllocation(jobId);
    if (success) {
      // This will trigger a refresh of the jobs list
      window.location.reload();
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'batch allocation':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'in batch processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ready to print':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading jobs...</span>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {selectedStage ? `No jobs found for ${selectedStage} stage` : 'No jobs found'}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {jobs.map((job) => {
        const isBatchAllocation = job.status === 'Batch Allocation';
        const isInBatchProcessing = job.status === 'In Batch Processing';
        
        return (
          <div
            key={job.job_id}
            className="flex gap-4 items-center p-2 hover:bg-gray-50 border-b cursor-pointer"
            onClick={() => onJobClick(job)}
          >
            {/* Due Date Indicator */}
            <div className="w-8 text-center">
              {job.due_date && (
                <div className="text-xs">
                  {new Date(job.due_date) < new Date() ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <div className="text-gray-400">
                      {Math.ceil((new Date(job.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Job Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {job.wo_no} - {job.customer || 'Unknown Customer'}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {job.reference || 'No reference'}
              </div>
            </div>

            {/* Due Date */}
            <div className="w-32 text-xs text-gray-600">
              {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'No due date'}
            </div>

            {/* Current Stage */}
            <div className="w-40">
              {isBatchAllocation ? (
                <BatchAllocationIndicator
                  jobId={job.job_id}
                  batchCategory={job.batch_category}
                  onAdvanceToPrinting={handleAdvanceToPrinting}
                  isProcessing={isProcessing}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={getStatusBadgeColor(job.status)}
                  >
                    {job.display_stage_name || job.current_stage_name || 'Unknown Stage'}
                  </Badge>
                  {isInBatchProcessing && (
                    <Package className="h-4 w-4 text-blue-600" title="In Batch Processing" />
                  )}
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="w-24 text-xs text-center">
              {job.workflow_progress ? `${job.workflow_progress}%` : 'N/A'}
            </div>

            {/* Actions */}
            <div className="w-24 flex justify-end">
              {!isBatchAllocation && !isInBatchProcessing && job.current_stage_id && (
                <div className="flex gap-1">
                  {job.current_stage_status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStageAction(job.job_id, job.current_stage_id!, 'start');
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                  {job.current_stage_status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStageAction(job.job_id, job.current_stage_id!, 'complete');
                      }}
                      className="h-6 px-2 text-xs"
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
