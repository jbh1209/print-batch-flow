
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { FlyerJobService } from './services/flyerJobService';
import { FlyerBatchService, BatchProperties } from './services/flyerBatchService';

/**
 * Hook for flyer job operations including CRUD and batch operations
 */
export function useFlyerJobOperations() {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  /**
   * Deletes a flyer job
   */
  const deleteJob = async (jobId: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    return await FlyerJobService.deleteJob(jobId, user.id);
  };

  /**
   * Creates a new flyer job
   */
  const createJob = async (
    jobData: Omit<FlyerJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    return await FlyerJobService.createJob(jobData, user.id);
  };

  /**
   * Creates a batch with selected jobs
   */
  const createBatchWithSelectedJobs = async (
    selectedJobs: FlyerJob[], 
    batchProperties: BatchProperties
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      setIsCreatingBatch(true);
      const result = await FlyerBatchService.createBatchWithSelectedJobs(
        selectedJobs,
        batchProperties,
        user.id
      );
      return result;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return {
    deleteJob,
    createJob,
    createBatchWithSelectedJobs,
    isCreatingBatch
  };
}
