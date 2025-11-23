import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches job_stage_instances for a specific list of job IDs
 * Only used for visible jobs in specific stage views (not "All Jobs")
 * Includes circuit breaker to prevent performance issues
 */
export const useJobStageInstancesMap = (jobIds: string[], enabled: boolean = true, cacheKey?: number) => {
  return useQuery({
    queryKey: ['job-stage-instances-map', jobIds, cacheKey],
    queryFn: async () => {
      // Circuit breaker: don't fetch if too many jobs
      if (jobIds.length > 1000 || jobIds.length === 0) {
        return new Map();
      }

      const { data, error } = await supabase
        .from('job_stage_instances')
        .select(`
          *,
          production_stage:production_stages(
            id,
            name,
            color,
            order_index,
            stage_group_id,
            supports_parts
          ),
          stage_specification:stage_specifications(
            id,
            name,
            description
          )
        `)
        .in('job_id', jobIds)
        .order('stage_order', { ascending: true });

      if (error) {
        console.error('Error fetching job stage instances:', error);
        throw error;
      }

      // Group by job_id
      const map = new Map<string, any[]>();
      data?.forEach(instance => {
        if (!map.has(instance.job_id)) {
          map.set(instance.job_id, []);
        }
        map.get(instance.job_id)!.push(instance);
      });

      console.log(`[JobStageMap] Fetched stages for ${map.size} jobs, total instances: ${data?.length || 0}`);

      return map;
    },
    enabled: enabled && jobIds.length > 0 && jobIds.length <= 1000,
    staleTime: 0, // Force refetch to get fresh data
  });
};
