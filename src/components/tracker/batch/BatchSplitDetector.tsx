import React from "react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";
import { useBatchSplitting } from "@/hooks/tracker/useBatchSplitting";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, AlertTriangle } from "lucide-react";

interface BatchSplitDetectorProps {
  job: AccessibleJob;
  children: (splitInfo: {
    isBatchJob: boolean;
    isReadyForSplit: boolean;
    splitReadiness: {
      ready: boolean;
      reason: string;
      currentStage?: string;
    };
  }) => React.ReactNode;
}

/**
 * Component that detects if a job is a batch master job and if it's ready for splitting
 * Provides the split readiness information to its children via render prop pattern
 */
export const BatchSplitDetector: React.FC<BatchSplitDetectorProps> = ({
  job,
  children
}) => {
  const { checkSplitReadiness } = useBatchSplitting();
  const [splitReadiness, setSplitReadiness] = React.useState<{
    ready: boolean;
    reason: string;
    currentStage?: string;
  }>({
    ready: false,
    reason: 'Checking...'
  });
  const [isLoading, setIsLoading] = React.useState(false);

  // Check if this is a batch master job
  const isBatchJob = job.is_batch_master || job.wo_no?.startsWith('BATCH-') || false;

  React.useEffect(() => {
    if (!isBatchJob) {
      setSplitReadiness({
        ready: false,
        reason: 'Not a batch master job'
      });
      return;
    }

    const checkReadiness = async () => {
      setIsLoading(true);
      try {
        const readiness = await checkSplitReadiness(job.job_id);
        setSplitReadiness(readiness);
      } catch (error) {
        console.error('Error checking split readiness:', error);
        setSplitReadiness({
          ready: false,
          reason: 'Error checking readiness'
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkReadiness();
  }, [job.job_id, job.current_stage_name, isBatchJob, checkSplitReadiness]);

  const isReadyForSplit = isBatchJob && splitReadiness.ready && !isLoading;

  console.log('🔍 BatchSplitDetector:', {
    jobId: job.job_id,
    woNo: job.wo_no,
    isBatchJob,
    currentStage: job.current_stage_name,
    splitReadiness,
    isReadyForSplit
  });

  return (
    <>
      {children({
        isBatchJob,
        isReadyForSplit,
        splitReadiness
      })}
      
      {/* Only show batch status for jobs that are actually ready for splitting */}
      {isBatchJob && isReadyForSplit && splitReadiness.ready && (
        <div className="mt-2">
          <Alert className="border-green-500">
            <Package className="h-4 w-4" />
            <AlertDescription className="text-sm text-green-700">
              <strong>Batch Ready:</strong> This batch can now be split into individual jobs
              {splitReadiness.currentStage && (
                <span className="block mt-1">
                  Current Stage: {splitReadiness.currentStage}
                </span>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
};