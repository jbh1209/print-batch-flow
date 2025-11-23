import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches job_stage_instances for jobs in a specific stage
 * Uses optimized subquery to fetch all stages for jobs that have instances in the selected stage
 * Eliminates query waterfall for better performance
 */
export const useJobStageInstancesMap = (
  jobIds: string[], 
  enabled: boolean = true, 
  cacheKey?: number,
  filterByStageId?: string | null
) => {
  return useQuery({
    queryKey: ['job-stage-instances-map', jobIds, cacheKey, filterByStageId],
    queryFn: async () => {
      let data, error;

      if (filterByStageId) {
        // Optimized: First get job IDs, then fetch all their stages in one query
        const { data: jobIdData, error: jobIdError } = await supabase
          .from('job_stage_instances')
          .select('job_id')
          .eq('production_stage_id', filterByStageId)
          .in('status', ['pending', 'active', 'scheduled', 'held']);

        if (jobIdError) {
          console.error('Error fetching job IDs for stage:', jobIdError);
          throw jobIdError;
        }

        const uniqueJobIds = [...new Set(jobIdData?.map(instance => instance.job_id) || [])];
        
        if (uniqueJobIds.length === 0) {
          return new Map();
        }

        const { data: stageData, error: stageError } = await supabase
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
          .in('job_id', uniqueJobIds)
          .order('stage_order', { ascending: true });
        
        data = stageData;
        error = stageError;
      } else {
        // Original behavior: fetch by explicit job IDs
        if (jobIds.length > 1000 || jobIds.length === 0) {
          return new Map();
        }

        const { data: jobData, error: jobError } = await supabase
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
        
        data = jobData;
        error = jobError;
      }

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
    enabled: enabled && (!!filterByStageId || (jobIds.length > 0 && jobIds.length <= 1000)),
    staleTime: 0, // Force refetch to get fresh data
  });
};
