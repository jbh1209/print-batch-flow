
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
      console.log('🚀 Starting job:', { jobId, stageId, userId: user.id });
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user.id
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId)
        .eq('status', 'pending');

      if (error) {
        console.error("❌ Error starting job:", error);
        throw error;
      }

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
      console.log('✅ Completing job:', { jobId, stageId, userId: user.id });
      
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageId
      });

      if (error) {
        console.error("❌ Error completing job:", error);
        throw error;
      }

      toast.success("Job completed successfully");
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
