import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches job_stage_instances for a specific list of job IDs
 * Only used for visible jobs in specific stage views (not "All Jobs")
 * Includes circuit breaker to prevent performance issues
 */
export const useJobStageInstancesMap = (jobIds: string[], enabled: boolean = true) => {
  return useQuery({
    queryKey: ['job-stage-instances-map', jobIds],
    queryFn: async () => {
      // Circuit breaker: don't fetch if too many jobs
      if (jobIds.length > 100 || jobIds.length === 0) {
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
            value
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

      // Debug: Check if D428201's job_id is in the map
      const d428201JobId = 'fa7a131c-0acf-4f81-a6e1-b438f002119f';
      console.log('[JobStageMap] D428201 job_id in map:', map.has(d428201JobId));
      console.log('[JobStageMap] D428201 stage count:', map.get(d428201JobId)?.length || 0);
      if (map.has(d428201JobId)) {
        console.log('[JobStageMap] D428201 stages:', map.get(d428201JobId)!.map(s => ({
          name: s.production_stage?.name,
          order: s.stage_order,
          part: s.part_assignment,
          supports_parts: s.production_stage?.supports_parts,
          status: s.status
        })));
      }

      return map;
    },
    enabled: enabled && jobIds.length > 0 && jobIds.length <= 100,
    staleTime: 30000, // 30 seconds
  });
};
