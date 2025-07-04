import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  BatchSplittingService, 
  BatchSplitResult, 
  BatchSplitOptions 
} from "@/utils/batch/batchSplittingService";

interface UseBatchSplittingReturn {
  splitBatch: (options: Omit<BatchSplitOptions, 'userId'>) => Promise<BatchSplitResult>;
  checkSplitReadiness: (batchJobId: string) => Promise<{
    ready: boolean;
    reason: string;
    currentStage?: string;
  }>;
  getSplitAuditTrail: (batchJobId: string) => Promise<{
    batchInfo?: {
      batchName: string;
      originalJobCount: number;
      splitAt: string;
    };
    splitJobs?: Array<{
      jobId: string;
      woNo: string;
      splitStatus: string;
      currentStage: string;
    }>;
  }>;
  isLoading: boolean;
  lastSplitResult: BatchSplitResult | null;
}

/**
 * Hook for managing batch splitting operations
 * Provides high-level interface to the BatchSplittingService
 */
export const useBatchSplitting = (): UseBatchSplittingReturn => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [lastSplitResult, setLastSplitResult] = useState<BatchSplitResult | null>(null);

  const splitBatch = useCallback(async (options: Omit<BatchSplitOptions, 'userId'>): Promise<BatchSplitResult> => {
    if (!user?.id) {
      const errorResult: BatchSplitResult = {
        success: false,
        splitJobsCount: 0,
        message: 'User not authenticated'
      };
      toast.error('Authentication required for batch operations');
      return errorResult;
    }

    setIsLoading(true);
    
    try {
      console.log('🔄 Starting batch split operation via hook:', options);
      
      const result = await BatchSplittingService.splitBatchToIndividualJobs({
        ...options,
        userId: user.id
      });

      setLastSplitResult(result);

      if (result.success) {
        toast.success(result.message);
        console.log('✅ Batch split completed successfully:', result);
      } else {
        toast.error(result.message);
        console.error('❌ Batch split failed:', result);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during batch split';
      const errorResult: BatchSplitResult = {
        success: false,
        splitJobsCount: 0,
        message: errorMessage
      };
      
      setLastSplitResult(errorResult);
      toast.error(`Batch split failed: ${errorMessage}`);
      console.error('❌ Exception during batch split:', error);
      
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const checkSplitReadiness = useCallback(async (batchJobId: string) => {
    try {
      console.log('🔍 Checking batch split readiness for:', batchJobId);
      
      const readiness = await BatchSplittingService.isBatchReadyForSplit(batchJobId);
      
      console.log('📋 Split readiness check result:', readiness);
      return readiness;
    } catch (error) {
      console.error('❌ Error checking split readiness:', error);
      return {
        ready: false,
        reason: `Error checking readiness: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, []);

  const getSplitAuditTrail = useCallback(async (batchJobId: string) => {
    try {
      console.log('📜 Fetching batch split audit trail for:', batchJobId);
      
      const auditTrail = await BatchSplittingService.getBatchSplitAuditTrail(batchJobId);
      
      console.log('📋 Audit trail retrieved:', auditTrail);
      return auditTrail;
    } catch (error) {
      console.error('❌ Error fetching audit trail:', error);
      return {};
    }
  }, []);

  return {
    splitBatch,
    checkSplitReadiness,
    getSplitAuditTrail,
    isLoading,
    lastSplitResult
  };
};