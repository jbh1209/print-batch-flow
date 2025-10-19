
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { useAuth } from "@/hooks/useAuth";

export const useStageActions = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  const { isAdmin, isManager } = useUserRole();
  const { canUserWorkOnStage } = useUserStagePermissions(user?.id);

  const startStage = useCallback(async (stageId: string, qrData?: any) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Starting stage manually...', { stageId, qrData });
      
      // Get stage info to check permissions
      const { data: stageData, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select('production_stage_id')
        .eq('id', stageId)
        .single();

      if (fetchError) throw fetchError;

      // Check permissions - admins and managers can bypass
      if (!isAdmin && !isManager) {
        const hasPermission = canUserWorkOnStage(stageData.production_stage_id);
        if (!hasPermission) {
          toast.error("Access Denied", {
            description: "You don't have permission to work on this stage"
          });
          setIsProcessing(false);
          return false;
        }
      }
      
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
  }, [user?.id, isAdmin, isManager, canUserWorkOnStage]);

  const completeStage = useCallback(async (stageId: string, notes?: string) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Completing stage...', { stageId, notes });
      
      // Get stage info before completing to check permissions AND if it's a proof stage
      const { data: stageInfo, error: stageInfoError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          job_table_name,
          production_stage_id,
          production_stage:production_stages(name)
        `)
        .eq('id', stageId)
        .single();

      if (stageInfoError) throw stageInfoError;

      // Check permissions - admins and managers can bypass
      if (!isAdmin && !isManager) {
        const hasPermission = canUserWorkOnStage(stageInfo.production_stage_id);
        if (!hasPermission) {
          toast.error("Access Denied", {
            description: "You don't have permission to work on this stage"
          });
          setIsProcessing(false);
          return false;
        }
      }

      const isProofStage = stageInfo?.production_stage?.name?.toLowerCase().includes('proof');
      
      // Build update object - include proof_approved_manually_at if this is a proof stage
      const updateData = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user?.id,
        notes: notes || null,
        updated_at: new Date().toISOString(),
        ...(isProofStage && { proof_approved_manually_at: new Date().toISOString() })
      };

      const { error } = await supabase
        .from('job_stage_instances')
        .update(updateData)
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
  }, [user?.id, isAdmin, isManager, canUserWorkOnStage]);

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
        .single();

      if (currentStageError || !currentStageInstance) {
        throw new Error(`Could not find stage instance with ID ${currentStageInstanceId}: ${currentStageError?.message}`);
      }

      console.log('🔍 Current stage instance info:', currentStageInstance);

      const isProofStage = currentStageInstance?.production_stage?.name?.toLowerCase().includes('proof');

      // Complete the current stage - include proof_approved_manually_at if this is a proof stage
      const updateData = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user?.id,
        notes: notes || null,
        updated_at: new Date().toISOString(),
        ...(isProofStage && { proof_approved_manually_at: new Date().toISOString() })
      };

      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update(updateData)
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

      // CRITICAL: Do not auto-activate next stage if current stage was a proof stage
      if (nextStageToActivate && !isProofStage) {
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

        console.log('✅ Non-proof stage completed and next stage activated:', {
          completedStage: currentStageInstanceId,
          activatedStage: nextStageToActivate.id,
          activatedStageName: nextStageToActivate.production_stages?.name,
          stageOrder: nextStageToActivate.stage_order
        });

        toast.success(`Stage completed and advanced to: ${nextStageToActivate.production_stages?.name}`);
      } else if (nextStageToActivate && isProofStage) {
        console.log('✅ Proof stage completed - next stage remains pending for manual factory floor activation:', {
          completedProofStage: currentStageInstanceId,
          nextStagePending: nextStageToActivate.id,
          nextStageName: nextStageToActivate.production_stages?.name
        });

        toast.success(`Proof stage completed - ${nextStageToActivate.production_stages?.name} awaits manual activation`);
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

  const holdStage = useCallback(async (
    stageId: string, 
    completionPercentage: number, 
    holdReason: string
  ) => {
    setIsProcessing(true);
    try {
      console.log('⏸️ Holding stage...', { stageId, completionPercentage, holdReason });
      
      // Get stage info to check permissions
      const { data: stageData, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select('production_stage_id, scheduled_minutes')
        .eq('id', stageId)
        .single();

      if (fetchError) throw fetchError;

      // Check permissions - admins and managers can bypass
      if (!isAdmin && !isManager) {
        const hasPermission = canUserWorkOnStage(stageData.production_stage_id);
        if (!hasPermission) {
          toast.error("Access Denied", {
            description: "You don't have permission to work on this stage"
          });
          setIsProcessing(false);
          return false;
        }
      }
      
      const scheduledMinutes = stageData?.scheduled_minutes || 0;
      const remainingMinutes = Math.round(scheduledMinutes * (1 - completionPercentage / 100));

      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'on_hold',
          completion_percentage: completionPercentage,
          remaining_minutes: remainingMinutes,
          hold_reason: holdReason,
          held_at: new Date().toISOString(),
          held_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId)
        .eq('status', 'active');

      if (error) throw error;

      console.log('✅ Stage held successfully', { 
        completionPercentage, 
        remainingMinutes,
        scheduledMinutes 
      });
      toast.success(`Stage held at ${completionPercentage}% completion`);
      return true;
    } catch (err) {
      console.error('❌ Error holding stage:', err);
      toast.error("Failed to hold stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id, isAdmin, isManager, canUserWorkOnStage]);

  const resumeStage = useCallback(async (stageId: string) => {
    setIsProcessing(true);
    try {
      console.log('▶️ Resuming stage...', { stageId });
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId)
        .eq('status', 'on_hold');

      if (error) throw error;

      console.log('✅ Stage resumed successfully');
      toast.success("Stage resumed");
      return true;
    } catch (err) {
      console.error('❌ Error resuming stage:', err);
      toast.error("Failed to resume stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    startStage,
    completeStage,
    completeStageAndSkipConditional,
    holdStage,
    resumeStage,
    isProcessing
  };
};
