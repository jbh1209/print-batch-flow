
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

      // First, get the current stage details and job category
      const { data: currentStageInfo, error: currentStageInfoError } = await supabase
        .from('job_stage_instances')
        .select('stage_order, job_table_name, status, production_stage_id, category_id')
        .eq('id', currentStageId)
        .single();

      if (currentStageInfoError || !currentStageInfo) {
        throw new Error(`Could not find stage with ID ${currentStageId}: ${currentStageInfoError?.message}`);
      }

      console.log('🔍 Current stage info:', currentStageInfo);

      // Check if job has a category (for conditional logic)
      const hasCategory = currentStageInfo.category_id !== null;
      console.log('🔍 Job has category:', hasCategory, 'Category ID:', currentStageInfo.category_id);

      // Complete the current stage regardless of its current status
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentStageId);

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
        .eq('job_table_name', currentStageInfo.job_table_name)
        .eq('status', 'pending')
        .gt('stage_order', currentStageInfo.stage_order)
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

      // Find the first non-conditional stage
      let nextStageToActivate = null;
      
      if (hasCategory) {
        // Use category-based conditional logic
        console.log('🔍 Using category-based conditional logic');
        
        const stageIds = pendingStages.map(stage => stage.production_stage_id);
        const { data: stageDetails, error: stageDetailsError } = await supabase
          .from('category_production_stages')
          .select(`
            production_stage_id,
            is_conditional
          `)
          .in('production_stage_id', stageIds);

        if (stageDetailsError) {
          console.warn('⚠️ Could not get stage conditional info, using fallback logic');
        } else {
          // Find the first non-conditional stage using category data
          for (const stage of pendingStages) {
            const stageDetail = stageDetails?.find(detail => detail.production_stage_id === stage.production_stage_id);
            const isConditional = stageDetail?.is_conditional || false;
            
            console.log(`🔍 Checking stage ${stage.production_stages?.name}: conditional=${isConditional}`);
            
            if (!isConditional) {
              nextStageToActivate = stage;
              break;
            }
          }
        }
      } else {
        // Use pattern-matching fallback for jobs without categories
        console.log('🔍 Using pattern-matching fallback (no category)');
        
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
