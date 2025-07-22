
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StageSpecificationData {
  stage_name: string;
  sub_specification?: string;
  part_name?: string;
  quantity?: number;
  paper_specifications?: string;
  estimated_duration_minutes?: number;
  started_at?: string;
}

export const useStageSpecifications = (jobId: string, stageId?: string) => {
  const [specifications, setSpecifications] = useState<StageSpecificationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpecifications = async () => {
      if (!jobId || !stageId) {
        setSpecifications(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('job_stage_instances')
          .select(`
            part_name,
            quantity,
            notes,
            estimated_duration_minutes,
            started_at,
            production_stage:production_stages(name),
            stage_specifications:stage_specifications(name, display_name)
          `)
          .eq('job_id', jobId)
          .eq('production_stage_id', stageId)
          .eq('status', 'active')
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          setSpecifications({
            stage_name: data.production_stage?.name || 'Unknown Stage',
            sub_specification: data.stage_specifications?.display_name,
            part_name: data.part_name || undefined,
            quantity: data.quantity || undefined,
            paper_specifications: data.notes || undefined,
            estimated_duration_minutes: data.estimated_duration_minutes || undefined,
            started_at: data.started_at || undefined
          });
        } else {
          setSpecifications(null);
        }
      } catch (err) {
        console.error('Error fetching stage specifications:', err);
        setError(err instanceof Error ? err.message : 'Failed to load specifications');
        setSpecifications(null);
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
