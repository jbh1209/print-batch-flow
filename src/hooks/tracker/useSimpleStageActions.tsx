
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SimpleStageActions {
  startStage: (stageInstanceId: string) => Promise<boolean>;
  completeStage: (stageInstanceId: string, notes?: string) => Promise<boolean>;
  sendBackForRework: (stageInstanceId: string, targetStageId: string, reason?: string) => Promise<boolean>;
  isProcessing: boolean;
}

export const useSimpleStageActions = (onRefresh?: () => void): SimpleStageActions => {
  const [isProcessing, setIsProcessing] = useState(false);

  const startStage = useCallback(async (stageInstanceId: string): Promise<boolean> => {
    setIsProcessing(true);
    try {
      console.log('🔄 Starting stage:', stageInstanceId);
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId)
        .eq('status', 'pending');

      if (error) {
        console.error('❌ Error starting stage:', error);
        toast.error("Failed to start stage");
        return false;
      }

      console.log('✅ Stage started successfully');
      toast.success("Stage started");
      onRefresh?.();
      return true;
    } catch (err) {
      console.error('❌ Error starting stage:', err);
      toast.error("Failed to start stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [onRefresh]);

  const completeStage = useCallback(async (stageInstanceId: string, notes?: string): Promise<boolean> => {
    setIsProcessing(true);
    try {
      console.log('🔄 Completing stage:', stageInstanceId);
      
      // First get the current stage info
      const { data: currentStage, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select('job_id, job_table_name, stage_order')
        .eq('id', stageInstanceId)
        .single();

      if (fetchError || !currentStage) {
        console.error('❌ Error fetching stage info:', fetchError);
        toast.error("Failed to get stage information");
        return false;
      }

      // Complete current stage
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId)
        .in('status', ['active', 'client_approved']);

      if (completeError) {
        console.error('❌ Error completing stage:', completeError);
        toast.error("Failed to complete stage");
        return false;
      }

      // Next stage stays pending - no auto-advancement
      console.log('✅ Stage completed - next stage remains pending until manually started');
      toast.success("Stage completed");
      onRefresh?.();
      return true;
    } catch (err) {
      console.error('❌ Error completing stage:', err);
      toast.error("Failed to complete stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [onRefresh]);

  const sendBackForRework = useCallback(async (
    stageInstanceId: string, 
    targetStageId: string, 
    reason?: string
  ): Promise<boolean> => {
    setIsProcessing(true);
    try {
      console.log('🔄 Sending back for rework:', { stageInstanceId, targetStageId, reason });
      
      // Use the existing rework function
      const { data, error } = await supabase.rpc('rework_job_stage', {
        p_job_id: '',  // Function will get this from stage instance
        p_job_table_name: '',  // Function will get this from stage instance
        p_current_stage_id: stageInstanceId,
        p_target_stage_id: targetStageId,
        p_rework_reason: reason || 'Sent back for rework'
      });

      if (error) {
        console.error('❌ Error sending back for rework:', error);
        toast.error("Failed to send back for rework");
        return false;
      }

      console.log('✅ Sent back for rework successfully');
      toast.success("Sent back for rework");
      onRefresh?.();
      return true;
    } catch (err) {
      console.error('❌ Error sending back for rework:', err);
      toast.error("Failed to send back for rework");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [onRefresh]);

  return {
    startStage,
    completeStage,
    sendBackForRework,
    isProcessing
  };
};
