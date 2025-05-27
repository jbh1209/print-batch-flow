
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useProductionJobOperations = () => {
  const updateJobStatus = async (jobId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) {
        console.error("Error updating job status:", error);
        throw new Error(`Failed to update job status: ${error.message}`);
      }

      return true;
    } catch (err) {
      console.error('Error updating job status:', err);
      toast.error("Failed to update job status");
      return false;
    }
  };

  return {
    updateJobStatus
  };
};
