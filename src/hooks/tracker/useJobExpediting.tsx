
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useJobExpediting = () => {
  const [isExpediting, setIsExpediting] = useState(false);
  const [isRemovingExpedite, setIsRemovingExpedite] = useState(false);

  const expediteJob = async (jobId: string, reason: string): Promise<boolean> => {
    setIsExpediting(true);
    try {
      console.log('🚨 Expediting job factory-wide:', { jobId, reason });
      
      const { data, error } = await supabase.rpc('expedite_job_factory_wide', {
        p_job_id: jobId,
        p_expedite_reason: reason
      });

      if (error) {
        console.error('❌ Error expediting job:', error);
        toast.error('Failed to expedite job');
        return false;
      }

      console.log('✅ Job expedited successfully');
      toast.success('Job expedited - will be prioritized in all stages');
      return true;
    } catch (err) {
      console.error('❌ Error expediting job:', err);
      toast.error('Failed to expedite job');
      return false;
    } finally {
      setIsExpediting(false);
    }
  };

  const removeExpediteStatus = async (jobId: string): Promise<boolean> => {
    setIsRemovingExpedite(true);
    try {
      console.log('🔄 Removing expedite status:', jobId);
      
      const { data, error } = await supabase.rpc('remove_job_expedite_status', {
        p_job_id: jobId
      });

      if (error) {
        console.error('❌ Error removing expedite status:', error);
        toast.error('Failed to remove expedite status');
        return false;
      }

      console.log('✅ Expedite status removed successfully');
      toast.success('Expedite status removed');
      return true;
    } catch (err) {
      console.error('❌ Error removing expedite status:', err);
      toast.error('Failed to remove expedite status');
      return false;
    } finally {
      setIsRemovingExpedite(false);
    }
  };

  return {
    expediteJob,
    removeExpediteStatus,
    isExpediting,
    isRemovingExpedite
  };
};
