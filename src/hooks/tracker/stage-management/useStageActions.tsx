
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
      
      // Get stage info before completing to check if it's a proof stage
      const { data: stageInfo, error: stageInfoError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          job_table_name,
          production_stage:production_stages(name)
        `)
        .eq('id', stageId)
        .maybeSingle();

      if (stageInfoError || !stageInfo) throw (stageInfoError || new Error('Stage not found'));

      const isProofStage = stageInfo?.production_stage?.name?.toLowerCase().includes('proof');
      
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

      console.log('✅ Stage completed successfully');

      // If this was a proof stage completion, trigger queue-based due date calculation
      if (isProofStage && stageInfo?.job_id) {
        console.log('🎯 Proof stage completed, triggering queue-based due date calculation...');
        
        try {
          const { data: calcData, error: calcError } = await supabase.functions.invoke('calculate-due-dates', {
            body: {
              jobIds: [stageInfo.job_id],
              tableName: stageInfo.job_table_name || 'production_jobs',
              priority: 'high',
              triggerReason: 'proof_approval'
            }
          });

          if (calcError) {
            console.error('❌ Error triggering queue-based calculation:', calcError);
            toast.error('Failed to update due date after proof approval');
          } else {
            console.log('✅ Queue-based calculation triggered:', calcData);
            toast.success('Due date updated based on current production queue');
          }
        } catch (calcErr) {
          console.error('❌ Error in queue calculation:', calcErr);
          toast.error('Failed to update due date');
        }
      }

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

      // First, get the current stage instance details including production stage name
      const { data: currentStageInstance, error: currentStageError } = await supabase
        .from('job_stage_instances')
        .select(`
          stage_order, 
          job_table_name, 
          status, 
          production_stage_id, 
          category_id,
          job_id,
          production_stage:production_stages(name)
        `)
        .eq('id', currentStageInstanceId)
        .maybeSingle();

      if (currentStageError || !currentStageInstance) {
        throw new Error(`Could not find stage instance with ID ${currentStageInstanceId}: ${currentStageError?.message}`);
      }

      console.log('🔍 Current stage instance info:', currentStageInstance);

      const isProofStage = currentStageInstance?.production_stage?.name?.toLowerCase().includes('proof');

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

      // If this was a proof stage completion, trigger queue-based due date calculation
      if (isProofStage && currentStageInstance?.job_id) {
        console.log('🎯 Proof stage completed, triggering queue-based due date calculation...');
        
        try {
          const { data: calcData, error: calcError } = await supabase.functions.invoke('calculate-due-dates', {
            body: {
              jobIds: [currentStageInstance.job_id],
              tableName: currentStageInstance.job_table_name || 'production_jobs',
              priority: 'high',
              triggerReason: 'proof_approval'
            }
          });

          if (calcError) {
            console.error('❌ Error triggering queue-based calculation:', calcError);
            toast.error('Failed to update due date after proof approval');
          } else {
            console.log('✅ Queue-based calculation triggered:', calcData);
            toast.success('Due date updated based on current production queue');
          }
        } catch (calcErr) {
          console.error('❌ Error in queue calculation:', calcErr);
          toast.error('Failed to update due date');
        }
      }

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

      // Find all non-conditional stages at the lowest stage_order level
      const nonConditionalStages = [];
      let lowestStageOrder = null;
      
      // First pass: find the lowest stage_order with non-conditional stages
      for (const stage of pendingStages) {
        const stageName = stage.production_stages?.name || '';
        const isConditionalByPattern = stageName.toLowerCase().includes('batch') || 
                                     stageName.toLowerCase().includes('allocation');
        
        if (!isConditionalByPattern) {
          if (lowestStageOrder === null || stage.stage_order < lowestStageOrder) {
            lowestStageOrder = stage.stage_order;
          }
        }
      }

      // Second pass: collect all non-conditional stages at the lowest order level
      if (lowestStageOrder !== null) {
        for (const stage of pendingStages) {
          const stageName = stage.production_stages?.name || '';
          const isConditionalByPattern = stageName.toLowerCase().includes('batch') || 
                                       stageName.toLowerCase().includes('allocation');
          
          if (!isConditionalByPattern && stage.stage_order === lowestStageOrder) {
            nonConditionalStages.push(stage);
          }
        }
      }

      // If no non-conditional stages found, use the first pending stage as fallback
      const stagesToActivate = nonConditionalStages.length > 0 ? nonConditionalStages : [pendingStages[0]];

      console.log(`🔍 Found ${stagesToActivate.length} stages to activate at order ${lowestStageOrder}:`, 
        stagesToActivate.map(s => s.production_stages?.name));

      if (stagesToActivate.length > 0) {
        // Activate all stages at the same order level (for parallel processing)
        const stageIds = stagesToActivate.map(s => s.id);
        
        const { error: activateError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .in('id', stageIds);

        if (activateError) throw activateError;

        const stageNames = stagesToActivate.map(s => s.production_stages?.name).join(', ');
        
        console.log('✅ Stage completed and next stages activated:', {
          completedStage: currentStageInstanceId,
          activatedStages: stageIds,
          activatedStageNames: stageNames,
          stageOrder: lowestStageOrder,
          parallelStages: stagesToActivate.length > 1
        });

        if (stagesToActivate.length > 1) {
          toast.success(`Stage completed and advanced to parallel stages: ${stageNames}`);
        } else {
          toast.success(`Stage completed and advanced to: ${stageNames}`);
        }
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
