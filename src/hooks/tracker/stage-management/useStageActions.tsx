
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const useStageActions = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();

  const startStage = useCallback(async (stageId: string, qrData?: any) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Starting stage manually...', { stageId, qrData });
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId)
        .eq('status', 'pending');

      if (error) throw error;

      toast.success("Stage started successfully");
      return true;
    } catch (err) {
      console.error('❌ Error starting stage:', err);
      toast.error("Failed to start stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const completeStage = useCallback(async (stageId: string, notes?: string) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Completing stage...', { stageId, notes });
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId)
        .eq('status', 'active');

      if (error) throw error;

      toast.success("Stage completed successfully");
      return true;
    } catch (err) {
      console.error('❌ Error completing stage:', err);
      toast.error("Failed to complete stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const completeStageAndSkipConditional = useCallback(async (
    jobId: string, 
    currentStageId: string, 
    notes?: string
  ) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Completing stage and skipping conditional stages...', { 
        jobId, 
        currentStageId, 
        notes 
      });

      // First, complete the current stage
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentStageId)
        .eq('status', 'active');

      if (completeError) throw completeError;

      // Get the current stage order and job table name
      const { data: currentStageData, error: currentStageError } = await supabase
        .from('job_stage_instances')
        .select('stage_order, job_table_name')
        .eq('id', currentStageId)
        .single();

      if (currentStageError) throw currentStageError;

      // Get all pending stages after the current one, ordered by stage_order
      const { data: pendingStages, error: pendingStagesError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          production_stage_id,
          stage_order
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', currentStageData.job_table_name)
        .eq('status', 'pending')
        .gt('stage_order', currentStageData.stage_order)
        .order('stage_order', { ascending: true });

      if (pendingStagesError) throw pendingStagesError;

      if (!pendingStages || pendingStages.length === 0) {
        console.log('ℹ️ No pending stages found after current stage');
        toast.success("Stage completed - no more stages to activate");
        return true;
      }

      // Get production stage details to check which stages are conditional
      const stageIds = pendingStages.map(stage => stage.production_stage_id);
      const { data: stageDetails, error: stageDetailsError } = await supabase
        .from('category_production_stages')
        .select(`
          production_stage_id,
          is_conditional
        `)
        .in('production_stage_id', stageIds);

      if (stageDetailsError) {
        console.warn('⚠️ Could not get stage conditional info, proceeding with first pending stage');
      }

      // Find the first non-conditional stage
      let nextStageToActivate = null;
      
      for (const stage of pendingStages) {
        const stageDetail = stageDetails?.find(detail => detail.production_stage_id === stage.production_stage_id);
        const isConditional = stageDetail?.is_conditional || false;
        
        console.log(`🔍 Checking stage ${stage.production_stage_id}: conditional=${isConditional}`);
        
        if (!isConditional) {
          nextStageToActivate = stage;
          break;
        }
      }

      // If no non-conditional stage found, use the first pending stage as fallback
      if (!nextStageToActivate && pendingStages.length > 0) {
        console.log('⚠️ No non-conditional stage found, using first pending stage as fallback');
        nextStageToActivate = pendingStages[0];
      }

      if (nextStageToActivate) {
        const { error: activateError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', nextStageToActivate.id);

        if (activateError) throw activateError;

        console.log('✅ Stage completed and next stage activated:', {
          completedStage: currentStageId,
          activatedStage: nextStageToActivate.id,
          stageOrder: nextStageToActivate.stage_order
        });

        toast.success("Stage completed and workflow advanced");
      } else {
        console.log('ℹ️ No more stages to activate - workflow may be complete');
        toast.success("Stage completed - workflow finished");
      }

      return true;
    } catch (err) {
      console.error('❌ Error completing stage and advancing:', err);
      toast.error("Failed to complete stage and advance workflow");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  return {
    startStage,
    completeStage,
    completeStageAndSkipConditional,
    isProcessing
  };
};
