
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SimpleJobActions {
  startStage: (jobId: string, stageId: string) => Promise<boolean>;
  completeStage: (jobId: string, stageId: string, notes?: string) => Promise<boolean>;
  isProcessing: boolean;
}

export const useSimpleJobActions = (onRefresh?: () => void): SimpleJobActions => {
  const [isProcessing, setIsProcessing] = useState(false);

  const startStage = useCallback(async (jobId: string, stageId: string): Promise<boolean> => {
    setIsProcessing(true);
    try {
      console.log('🔄 Starting stage:', { jobId, stageId });
      
      // Find the stage instance to start
      const { data: stageInstance, error: findError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId)
        .eq('status', 'pending')
        .single();

      if (findError || !stageInstance) {
        console.error('❌ Stage instance not found:', findError);
        toast.error("Stage not found or already started");
        return false;
      }

      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstance.id);

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

  const completeStage = useCallback(async (jobId: string, stageId: string, notes?: string): Promise<boolean> => {
    setIsProcessing(true);
    try {
      console.log('🔄 Completing stage:', { jobId, stageId });
      
      // Find the active stage instance to complete
      const { data: stageInstance, error: findError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId)
        .in('status', ['active', 'client_approved'])
        .single();

      if (findError || !stageInstance) {
        console.error('❌ Active stage instance not found:', findError);
        toast.error("No active stage found to complete");
        return false;
      }

      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstance.id);

      if (error) {
        console.error('❌ Error completing stage:', error);
        toast.error("Failed to complete stage");
        return false;
      }

      console.log('✅ Stage completed successfully');
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

  return {
    startStage,
    completeStage,
    isProcessing
  };
};
