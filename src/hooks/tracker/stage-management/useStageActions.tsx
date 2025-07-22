
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
    currentStageInstanceId: string, 
    notes?: string
  ) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Completing stage and skipping conditional stages...', { 
        jobId, 
        currentStageInstanceId, 
        notes 
      });

      // First, get the current stage instance details
      const { data: currentStageInstance, error: currentStageError } = await supabase
        .from('job_stage_instances')
        .select('stage_order, job_table_name, status, production_stage_id, category_id')
        .eq('id', currentStageInstanceId)
        .single();

      if (currentStageError || !currentStageInstance) {
        throw new Error(`Could not find stage instance with ID ${currentStageInstanceId}: ${currentStageError?.message}`);
      }

      console.log('🔍 Current stage instance info:', currentStageInstance);

      // Complete the current stage
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentStageInstanceId);

      if (completeError) {
        throw new Error(`Failed to complete current stage: ${completeError.message}`);
      }

      console.log('✅ Current stage completed successfully');

      // Get all pending stages after the current one, ordered by stage_order
      const { data: pendingStages, error: pendingStagesError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          production_stage_id,
          stage_order,
          production_stages!inner(name)
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', currentStageInstance.job_table_name)
        .eq('status', 'pending')
        .gt('stage_order', currentStageInstance.stage_order)
        .order('stage_order', { ascending: true });

      if (pendingStagesError) throw pendingStagesError;

      if (!pendingStages || pendingStages.length === 0) {
        console.log('ℹ️ No pending stages found after current stage');
        toast.success("Stage completed - no more stages to activate");
        return true;
      }

      console.log('🔍 Found pending stages:', pendingStages.map(s => ({ 
        id: s.id, 
        order: s.stage_order, 
        name: s.production_stages?.name 
      })));

      // Find the first non-conditional stage using simple pattern matching
      let nextStageToActivate = null;
      
      for (const stage of pendingStages) {
        const stageName = stage.production_stages?.name || '';
        // Skip stages that appear to be conditional based on naming patterns
        const isConditionalByPattern = stageName.toLowerCase().includes('batch') || 
                                     stageName.toLowerCase().includes('allocation');
        
        console.log(`🔍 Checking stage ${stageName}: conditional by pattern=${isConditionalByPattern}`);
        
        if (!isConditionalByPattern) {
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
          completedStage: currentStageInstanceId,
          activatedStage: nextStageToActivate.id,
          activatedStageName: nextStageToActivate.production_stages?.name,
          stageOrder: nextStageToActivate.stage_order
        });

        toast.success(`Stage completed and advanced to: ${nextStageToActivate.production_stages?.name}`);
      } else {
        console.log('ℹ️ No more stages to activate - workflow may be complete');
        toast.success("Stage completed - workflow finished");
      }

      return true;
    } catch (err) {
      console.error('❌ Error completing stage and advancing:', err);
      toast.error(`Failed to complete stage and advance workflow: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
