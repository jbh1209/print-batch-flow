import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EnhancedStageSpecificationData {
  stage_name: string;
  sub_specification?: string;
  part_name?: string;
  quantity?: number;
  stage_id: string;
  specification_details?: any;
}

export const useEnhancedStageSpecifications = (jobId: string, stageId?: string | null) => {
  const [specifications, setSpecifications] = useState<EnhancedStageSpecificationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpecifications = async () => {
      if (!jobId) {
        setSpecifications([]);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Build query to get stage instances with specifications
        let query = supabase
          .from('job_stage_instances')
          .select(`
            production_stage_id,
            part_name,
            quantity,
            notes,
            stage_specification_id,
            production_stages(name),
            stage_specifications(
              id,
              name,
              description,
              properties
            )
          `)
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs');

        // If specific stage requested, filter to that stage
        if (stageId) {
          query = query.eq('production_stage_id', stageId);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        if (data) {
          const specs: EnhancedStageSpecificationData[] = data.map(item => ({
            stage_id: item.production_stage_id,
            stage_name: item.production_stages?.name || 'Unknown Stage',
            sub_specification: item.stage_specifications?.description || 
                              item.stage_specifications?.name ||
                              (item.notes ? `Custom: ${item.notes}` : undefined),
            part_name: item.part_name || undefined,
            quantity: item.quantity || undefined,
            specification_details: item.stage_specifications?.properties
          }));

          setSpecifications(specs);
        } else {
          setSpecifications([]);
        }
      } catch (err) {
        console.error('Error fetching enhanced stage specifications:', err);
        setError(err instanceof Error ? err.message : 'Failed to load specifications');
        setSpecifications([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpecifications();
  }, [jobId, stageId]);

  return {
    specifications,
    isLoading,
    error
  };
};