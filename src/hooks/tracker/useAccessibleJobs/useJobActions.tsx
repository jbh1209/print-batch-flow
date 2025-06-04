
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const useJobActions = (refreshJobs: () => Promise<void>) => {
  const { user } = useAuth();

  const startJob = useCallback(async (jobId: string, stageId: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      console.log('🚀 Starting job stage:', { jobId, stageId, userId: user.id });
      
      // Find the first pending stage for this job and set it to active
      const { data: firstPendingStage, error: findError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_order')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'pending')
        .order('stage_order', { ascending: true })
        .limit(1)
        .single();

      if (findError || !firstPendingStage) {
        console.error("❌ No pending stage found:", findError);
        toast.error("No pending stage found to start");
        return false;
      }

      // Start the first pending stage
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', firstPendingStage.id);

      if (error) {
        console.error("❌ Error starting job stage:", error);
        throw error;
      }

      console.log("✅ Job stage started successfully");
      toast.success("Job started successfully");
      await refreshJobs();
      return true;
    } catch (err) {
      console.error('❌ Error starting job:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start job";
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id, refreshJobs]);

  const completeJob = useCallback(async (jobId: string, stageId: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      console.log('✅ Completing job stage:', { jobId, stageId, userId: user.id });
      
      // Find the active stage for this job
      const { data: activeStage, error: findError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_order')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active')
        .single();

      if (findError || !activeStage) {
        console.error("❌ No active stage found:", findError);
        toast.error("No active stage found to complete");
        return false;
      }

      // Complete the current stage
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeStage.id);

      if (completeError) {
        console.error("❌ Error completing stage:", completeError);
        throw completeError;
      }

      // Check if there's a next stage to activate
      const { data: nextStage, error: nextError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'pending')
        .gt('stage_order', activeStage.stage_order)
        .order('stage_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextError) {
        console.error("❌ Error finding next stage:", nextError);
        // Don't fail the completion, just log the error
      } else if (nextStage) {
        // Activate the next stage
        const { error: activateError } = await supabase
          .from('job_stage_instances')
          .update({ 
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', nextStage.id);

        if (activateError) {
          console.error("❌ Error activating next stage:", activateError);
          // Don't fail the completion, just log the error
        }
      }

      console.log("✅ Job stage completed successfully");
      toast.success("Job stage completed successfully");
      await refreshJobs();
      return true;
    } catch (err) {
      console.error('❌ Error completing job:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to complete job";
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id, refreshJobs]);

  return { startJob, completeJob };
};
