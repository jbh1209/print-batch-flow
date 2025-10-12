
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReworkHistoryItem {
  stage_name: string;
  rework_count: number;
  last_rework_reason: string;
  total_reworks: number;
}

export const useStageRework = () => {
  const [isReworking, setIsReworking] = useState(false);
  const [reworkHistory, setReworkHistory] = useState<ReworkHistoryItem[]>([]);

  const reworkStage = async (
    jobId: string,
    jobTableName: string,
    currentStageId: string,
    targetStageId: string,
    reworkReason?: string
  ) => {
    setIsReworking(true);
    try {
      console.log('🔄 Reworking stage...', { 
        jobId, 
        currentStageId, 
        targetStageId, 
        reworkReason 
      });

      const { data, error } = await supabase.rpc('rework_job_stage', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_current_stage_instance_id: currentStageId,
        p_target_stage_id: targetStageId,
        p_rework_reason: reworkReason || null
      });

      if (error) {
        console.error('❌ Stage rework error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Stage rework failed - invalid stage transition');
      }

      console.log('✅ Stage reworked successfully');
      toast.success(`Stage sent back for rework${reworkReason ? ': ' + reworkReason : ''}`);
      return true;
    } catch (err) {
      console.error('❌ Error reworking stage:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to rework stage";
      toast.error(errorMessage);
      return false;
    } finally {
      setIsReworking(false);
    }
  };

  const fetchReworkHistory = async (jobId: string, jobTableName: string) => {
    try {
      console.log('🔄 Fetching rework history...');

      const { data, error } = await supabase.rpc('get_job_rework_history', {
        p_job_id: jobId,
        p_job_table_name: jobTableName
      });

      if (error) {
        console.error('❌ Rework history fetch error:', error);
        throw error;
      }

      console.log('✅ Rework history fetched:', data?.length || 0);
      setReworkHistory(data || []);
      return data || [];
    } catch (err) {
      console.error('❌ Error fetching rework history:', err);
      toast.error("Failed to load rework history");
      return [];
    }
  };

  return {
    reworkStage,
    fetchReworkHistory,
    reworkHistory,
    isReworking
  };
};
