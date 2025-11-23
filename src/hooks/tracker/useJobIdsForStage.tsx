import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches job IDs that have instances in a specific production stage
 * Used to limit the scope of detailed stage data fetching
 */
export const useJobIdsForStage = (stageId: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['job-ids-for-stage', stageId],
    queryFn: async () => {
      if (!stageId) {
        return [];
      }

      const { data, error } = await supabase
        .from('job_stage_instances')
        .select('job_id')
        .eq('production_stage_id', stageId)
        .in('status', ['pending', 'active', 'scheduled', 'held']);

      if (error) {
        console.error('Error fetching job IDs for stage:', error);
        throw error;
      }

      // Return unique job IDs
      const uniqueJobIds = [...new Set(data?.map(instance => instance.job_id) || [])];
      console.log(`[JobIdsForStage] Stage ${stageId}: ${uniqueJobIds.length} jobs`);
      return uniqueJobIds;
    },
    enabled: enabled && !!stageId,
    staleTime: 30000, // Cache for 30 seconds
  });
};
