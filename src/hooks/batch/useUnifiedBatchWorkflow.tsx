
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface BatchReference {
  id: string;
  production_job_id: string;
  batch_job_table: string;
  batch_job_id: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed';
}

export const useUnifiedBatchWorkflow = () => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const moveToBatchAllocation = useCallback(async (
    productionJobId: string,
    batchCategory: string
  ) => {
    if (!user?.id) return false;

    setIsProcessing(true);
    try {
      console.log('🔄 Moving production job to batch allocation:', { productionJobId, batchCategory });

      // Update production job status to Batch Allocation
      const { error: jobUpdateError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Batch Allocation',
          batch_category: batchCategory,
          updated_at: new Date().toISOString()
        })
        .eq('id', productionJobId);

      if (jobUpdateError) {
        console.error('❌ Error updating production job:', jobUpdateError);
        throw jobUpdateError;
      }

      // Complete current active stage and create batch allocation stage
      const { error: stageCompleteError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          notes: `Job moved to batch allocation - ${batchCategory}`
        })
        .eq('job_id', productionJobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active');

      if (stageCompleteError) {
        console.error('❌ Error completing current stage:', stageCompleteError);
      }

      // Create batch allocation stage instance
      const { error: batchStageError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: productionJobId,
          job_table_name: 'production_jobs',
          production_stage_id: '00000000-0000-0000-0000-000000000001', // Special batch allocation stage
          stage_order: 999,
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user.id,
          notes: `Batch allocation stage - Category: ${batchCategory}`
        });

      if (batchStageError) {
        console.error('❌ Error creating batch allocation stage:', batchStageError);
      }

      console.log('✅ Production job moved to batch allocation successfully');
      toast.success(`Job moved to ${batchCategory} batch allocation`);
      return true;

    } catch (error) {
      console.error('❌ Error in batch allocation process:', error);
      toast.error("Failed to move job to batch allocation");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const createBatchReference = useCallback(async (
    productionJobId: string,
    batchJobTable: string,
    batchJobId: string
  ) => {
    try {
      const { error } = await supabase
        .from('batch_job_references')
        .insert({
          production_job_id: productionJobId,
          batch_job_table: batchJobTable,
          batch_job_id: batchJobId,
          status: 'pending'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Error creating batch reference:', error);
      return false;
    }
  }, []);

  const moveToBatchProcessing = useCallback(async (
    productionJobId: string,
    batchId: string
  ) => {
    if (!user?.id) return false;

    setIsProcessing(true);
    try {
      console.log('🔄 Moving job to batch processing:', { productionJobId, batchId });

      // Update production job status
      const { error: jobUpdateError } = await supabase
        .from('production_jobs')
        .update({
          status: 'In Batch Processing',
          batch_ready: true,
          batch_allocated_at: new Date().toISOString(),
          batch_allocated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', productionJobId);

      if (jobUpdateError) {
        console.error('❌ Error updating production job:', jobUpdateError);
        throw jobUpdateError;
      }

      // Complete batch allocation stage
      const { error: stageCompleteError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          notes: `Batch allocation completed - assigned to batch ${batchId}`
        })
        .eq('job_id', productionJobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active')
        .like('notes', '%batch allocation%');

      if (stageCompleteError) {
        console.error('❌ Error completing batch allocation stage:', stageCompleteError);
      }

      console.log('✅ Job moved to batch processing successfully');
      toast.success("Job moved to batch processing");
      return true;

    } catch (error) {
      console.error('❌ Error moving to batch processing:', error);
      toast.error("Failed to move job to batch processing");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const completeBatchProcessing = useCallback(async (
    productionJobId: string,
    nextStageId?: string
  ) => {
    if (!user?.id) return false;

    setIsProcessing(true);
    try {
      console.log('🔄 Completing batch processing:', { productionJobId, nextStageId });

      // Update production job status
      const nextStatus = nextStageId ? 'Ready to Print' : 'Batch Complete';
      const { error: jobUpdateError } = await supabase
        .from('production_jobs')
        .update({
          status: nextStatus,
          batch_ready: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', productionJobId);

      if (jobUpdateError) {
        console.error('❌ Error updating production job:', jobUpdateError);
        throw jobUpdateError;
      }

      // If next stage specified, activate it
      if (nextStageId) {
        const { error: nextStageError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user.id,
            notes: 'Advanced from batch processing to next stage'
          })
          .eq('job_id', productionJobId)
          .eq('job_table_name', 'production_jobs')
          .eq('production_stage_id', nextStageId)
          .eq('status', 'pending');

        if (nextStageError) {
          console.error('❌ Error activating next stage:', nextStageError);
        }
      }

      console.log('✅ Batch processing completed successfully');
      toast.success("Batch processing completed");
      return true;

    } catch (error) {
      console.error('❌ Error completing batch processing:', error);
      toast.error("Failed to complete batch processing");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const getBatchJobsForProduction = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('production_jobs')
        .select(`
          id,
          wo_no,
          customer,
          status,
          batch_category,
          due_date,
          batch_ready,
          batch_allocated_at
        `)
        .in('status', ['Batch Allocation', 'In Batch Processing'])
        .order('batch_allocated_at', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('❌ Error fetching batch jobs:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error in getBatchJobsForProduction:', error);
      return [];
    }
  }, []);

  return {
    moveToBatchAllocation,
    createBatchReference,
    moveToBatchProcessing,
    completeBatchProcessing,
    getBatchJobsForProduction,
    isProcessing
  };
};
