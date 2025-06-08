
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

  return {
    startStage,
    completeStage,
    isProcessing
  };
};
