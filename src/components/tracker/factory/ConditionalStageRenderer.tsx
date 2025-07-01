import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { useConditionalStageLogic } from '@/hooks/tracker/useConditionalStageLogic';
import { BatchAllocationStage } from '@/components/tracker/batch-allocation/BatchAllocationStage';

interface ConditionalStageRendererProps {
  job: AccessibleJob;
  onStageComplete: () => void;
  onCancel: () => void;
}

export const ConditionalStageRenderer: React.FC<ConditionalStageRendererProps> = ({
  job,
  onStageComplete,
  onCancel
}) => {
  const {
    shouldShowBatchAllocationStage,
    getBatchAllocationStatus,
    skipConditionalStage,
    markJobReadyForBatching
  } = useConditionalStageLogic();

  const [showBatchStage, setShowBatchStage] = useState(false);
  const [batchStatus, setBatchStatus] = useState({
    needsBatching: false,
    batchReady: false,
    batchJobsCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCurrentStageBatchAllocation = job.current_stage_name === 'Batch Allocation';

  useEffect(() => {
    const checkStageVisibility = async () => {
      if (!isCurrentStageBatchAllocation) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Check if batch allocation stage should be shown
        const shouldShow = await shouldShowBatchAllocationStage(
          job.job_id, 
          job.category_id || ''
        );

        // Get current batch status
        const status = await getBatchAllocationStatus(job.job_id);

        setShowBatchStage(shouldShow);
        setBatchStatus(status);

        console.log('🔍 Conditional stage check:', {
          jobId: job.job_id,
          stageName: job.current_stage_name,
          shouldShow,
          status
        });

      } catch (err) {
        console.error('❌ Error checking conditional stage:', err);
        setError(err instanceof Error ? err.message : 'Failed to check stage conditions');
      } finally {
        setIsLoading(false);
      }
    };

    checkStageVisibility();
  }, [job.job_id, job.category_id, job.current_stage_name, shouldShowBatchAllocationStage, getBatchAllocationStatus, isCurrentStageBatchAllocation]);

  const handleSkipStage = async () => {
    try {
      setError(null);
      await skipConditionalStage(
        job.job_id,
        job.current_stage_id,
        'Batch allocation not required for this job'
      );
      onStageComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip stage');
    }
  };

  const handleMarkReadyForBatching = async () => {
    try {
      setError(null);
      await markJobReadyForBatching(job.job_id);
      onStageComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark job ready for batching');
    }
  };

  // Only render for batch allocation stage
  if (!isCurrentStageBatchAllocation) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Checking stage conditions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center text-red-600 mb-4">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span className="font-medium">Stage Check Error</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <div className="flex gap-2">
            <Button onClick={onCancel} variant="outline" size="sm">
              Cancel
            </Button>
            <Button onClick={handleSkipStage} variant="destructive" size="sm">
              Skip Stage
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If stage should be shown, render the batch allocation interface
  if (showBatchStage) {
    return (
      <BatchAllocationStage
        job={job}
        onComplete={onStageComplete}
        onCancel={onCancel}
      />
    );
  }

  // If stage should not be shown, provide options
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EyeOff className="h-5 w-5" />
          Conditional Stage: {job.current_stage_name}
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span><strong>WO:</strong> {job.wo_no}</span>
          <span><strong>Customer:</strong> {job.customer}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {batchStatus.batchReady ? 'Batch Ready' : 'Batch Not Required'}
            </Badge>
            {batchStatus.batchJobsCount > 0 && (
              <Badge variant="secondary">
                {batchStatus.batchJobsCount} Batch Job(s)
              </Badge>
            )}
          </div>

          <p className="text-gray-600">
            {batchStatus.batchReady 
              ? 'This job is already marked as ready for batching.'
              : 'This job does not require batch allocation and can proceed directly to the next stage.'
            }
          </p>

          <div className="flex gap-3">
            {!batchStatus.batchReady && (
              <Button onClick={handleMarkReadyForBatching} variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Mark Ready for Batching
              </Button>
            )}
            
            <Button onClick={handleSkipStage}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Skip to Next Stage
            </Button>
            
            <Button onClick={onCancel} variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};