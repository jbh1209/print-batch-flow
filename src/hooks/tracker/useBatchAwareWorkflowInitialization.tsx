import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkflowInitializationCore } from "./useWorkflowInitializationCore";

interface BatchWorkflowOptions {
  isBatchMaster?: boolean;
  batchName?: string;
  constituentJobIds?: string[];
  batchCategory?: string;
}

/**
 * Enhanced workflow initialization with batch awareness
 * Handles workflow setup for both individual jobs and batch master jobs
 */
export const useBatchAwareWorkflowInitialization = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const { initializeStandardWorkflow, initializeMultiPartWorkflow } = useWorkflowInitializationCore();

  const initializeBatchAwareWorkflow = useCallback(async (
    jobId: string,
    jobTableName: string,
    categoryId: string,
    batchOptions?: BatchWorkflowOptions
  ) => {
    setIsInitializing(true);
    try {
      console.log('🔄 Initializing batch-aware workflow...', {
        jobId,
        jobTableName,
        categoryId,
        batchOptions
      });

      // Initialize the standard workflow first
      const success = await initializeStandardWorkflow(jobId, jobTableName, categoryId);
      
      if (!success) {
        throw new Error('Failed to initialize standard workflow');
      }

      // If this is a batch master job, perform additional setup
      if (batchOptions?.isBatchMaster && batchOptions.constituentJobIds?.length) {
        console.log('🔄 Setting up batch master workflow...', {
          batchName: batchOptions.batchName,
          constituentCount: batchOptions.constituentJobIds.length
        });

        // Update constituent jobs to reflect batch processing status
        const { error: statusError } = await supabase
          .from('production_jobs')
          .update({
            status: 'In Batch Processing',
            batch_category: batchOptions.batchCategory,
            updated_at: new Date().toISOString()
          })
          .in('id', batchOptions.constituentJobIds);

        if (statusError) {
          console.warn('⚠️ Error updating constituent job status:', statusError);
          // Don't fail the entire operation for this
        }

        // Create batch job references if they don't exist
        const batchReferences = batchOptions.constituentJobIds.map(jobId => ({
          production_job_id: jobId,
          batch_id: '', // This would be filled by the batch creation process
          batch_job_id: jobId, // Reference to the batch master job
          batch_job_table: jobTableName,
          status: 'in_progress',
          notes: `Part of batch: ${batchOptions.batchName}`
        }));

        // Note: The actual batch_id would be set by the batch creation process
        console.log('📋 Batch references prepared for:', batchReferences.length, 'jobs');
      }

      // For individual jobs that are batch ready, ensure they have proper status
      if (batchOptions?.batchCategory && !batchOptions.isBatchMaster) {
        const { error: batchReadyError } = await supabase
          .from('production_jobs')
          .update({
            batch_ready: true,
            batch_category: batchOptions.batchCategory,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (batchReadyError) {
          console.warn('⚠️ Error marking job as batch ready:', batchReadyError);
        }
      }

      toast.success(
        batchOptions?.isBatchMaster 
          ? `Batch workflow initialized: ${batchOptions.batchName}` 
          : "Workflow initialized successfully"
      );

      return true;
    } catch (err) {
      console.error('❌ Error initializing batch-aware workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [initializeStandardWorkflow]);

  const initializeBatchAwareWorkflowWithParts = useCallback(async (
    jobId: string,
    jobTableName: string,
    categoryId: string,
    partAssignments?: Record<string, string>,
    batchOptions?: BatchWorkflowOptions
  ) => {
    setIsInitializing(true);
    try {
      console.log('🔄 Initializing batch-aware workflow with parts...', {
        jobId,
        jobTableName,
        categoryId,
        partAssignments,
        batchOptions
      });

      // Initialize the multi-part workflow
      const success = await initializeMultiPartWorkflow(jobId, jobTableName, categoryId, partAssignments);
      
      if (!success) {
        throw new Error('Failed to initialize multi-part workflow');
      }

      // Apply batch-specific logic
      if (batchOptions?.isBatchMaster && batchOptions.constituentJobIds?.length) {
        // Similar batch master setup as above
        const { error: statusError } = await supabase
          .from('production_jobs')
          .update({
            status: 'In Batch Processing',
            batch_category: batchOptions.batchCategory,
            updated_at: new Date().toISOString()
          })
          .in('id', batchOptions.constituentJobIds);

        if (statusError) {
          console.warn('⚠️ Error updating constituent job status:', statusError);
        }
      }

      toast.success(
        batchOptions?.isBatchMaster 
          ? `Batch workflow with parts initialized: ${batchOptions.batchName}` 
          : "Multi-part workflow initialized successfully"
      );

      return true;
    } catch (err) {
      console.error('❌ Error initializing batch-aware workflow with parts:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [initializeMultiPartWorkflow]);

  const repairBatchAwareWorkflow = useCallback(async (
    jobId: string,
    jobTableName: string,
    categoryId: string,
    batchOptions?: BatchWorkflowOptions
  ) => {
    setIsInitializing(true);
    try {
      console.log('🔧 Repairing batch-aware workflow...', {
        jobId,
        jobTableName,
        categoryId,
        batchOptions
      });

      // Delete any existing orphaned stages first
      const { error: deleteError } = await supabase
        .from('job_stage_instances')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (deleteError) {
        console.error('❌ Error cleaning up existing stages:', deleteError);
      }

      // Reinitialize with batch awareness
      return await initializeBatchAwareWorkflow(jobId, jobTableName, categoryId, batchOptions);
    } catch (err) {
      console.error('❌ Error repairing batch-aware workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to repair workflow';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [initializeBatchAwareWorkflow]);

  return {
    initializeBatchAwareWorkflow,
    initializeBatchAwareWorkflowWithParts,
    repairBatchAwareWorkflow,
    isInitializing
  };
};