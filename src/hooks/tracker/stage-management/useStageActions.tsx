
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

      // Get the current stage order
      const { data: currentStageData, error: currentStageError } = await supabase
        .from('job_stage_instances')
        .select('stage_order, job_table_name')
        .eq('id', currentStageId)
        .single();

      if (currentStageError) throw currentStageError;

      // Find the next non-conditional stage
      const { data: nextStageData, error: nextStageError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          production_stage_id,
          stage_order,
          category_production_stages!inner(
            is_conditional
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', currentStageData.job_table_name)
        .eq('status', 'pending')
        .gt('stage_order', currentStageData.stage_order)
        .eq('category_production_stages.is_conditional', false)
        .order('stage_order', { ascending: true })
        .limit(1);

      if (nextStageError) throw nextStageError;

      // If we found a next non-conditional stage, activate it
      if (nextStageData && nextStageData.length > 0) {
        const nextStage = nextStageData[0];
        
        const { error: activateError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', nextStage.id);

        if (activateError) throw activateError;

        console.log('✅ Stage completed and next non-conditional stage activated:', {
          completedStage: currentStageId,
          activatedStage: nextStage.id
        });
      } else {
        console.log('ℹ️ No next non-conditional stage found - workflow may be complete');
      }

      toast.success("Stage completed and workflow advanced");
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
