
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const useBatchAllocationStage = () => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const createBatchAllocationStage = useCallback(async (jobId: string) => {
    try {
      setIsProcessing(true);
      console.log('🔄 Creating batch allocation stage for job:', jobId);

      // First, check if a batch allocation stage already exists
      const { data: existingStage } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active')
        .like('notes', '%batch allocation%')
        .single();

      if (existingStage) {
        console.log('✅ Batch allocation stage already exists');
        return true;
      }

      // Create a virtual batch allocation stage
      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: jobId,
          job_table_name: 'production_jobs',
          production_stage_id: '00000000-0000-0000-0000-000000000001', // Placeholder ID for batch allocation
          stage_order: 998, // High order to indicate it's an intermediate step
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id,
          notes: 'Batch allocation stage - intermediate processing'
        });

      if (stageError) {
        console.error('❌ Error creating batch allocation stage:', stageError);
        throw stageError;
      }

      console.log('✅ Batch allocation stage created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in batch allocation stage creation:', error);
      toast.error("Failed to create batch allocation stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const completeBatchAllocation = useCallback(async (jobId: string, nextStageId?: string) => {
    try {
      setIsProcessing(true);
      console.log('🔄 Completing batch allocation stage for job:', jobId);

      // Complete the batch allocation stage
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          notes: 'Batch allocation completed - job ready for next stage'
        })
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active')
        .like('notes', '%batch allocation%');

      if (completeError) {
        console.error('❌ Error completing batch allocation stage:', completeError);
        throw completeError;
      }

      // If a next stage is specified, activate it
      if (nextStageId) {
        const { error: activateError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user?.id
          })
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs')
          .eq('production_stage_id', nextStageId)
          .eq('status', 'pending');

        if (activateError) {
          console.error('❌ Error activating next stage:', activateError);
          throw activateError;
        }
      }

      console.log('✅ Batch allocation stage completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error completing batch allocation stage:', error);
      toast.error("Failed to complete batch allocation stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const getBatchAllocationJobs = useCallback(async () => {
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
          updated_at
        `)
        .eq('status', 'Batch Allocation')
        .order('updated_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching batch allocation jobs:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error in getBatchAllocationJobs:', error);
      toast.error("Failed to fetch batch allocation jobs");
      return [];
    }
  }, []);

  return {
    createBatchAllocationStage,
    completeBatchAllocation,
    getBatchAllocationJobs,
    isProcessing
  };
};
