
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface JobSpecification {
  category: string;
  specification_id: string;
  name: string;
  display_name: string;
  properties: any;
}

export const useJobSpecificationDisplay = (jobId: string, jobTableName: string) => {
  const [specifications, setSpecifications] = useState<JobSpecification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpecifications = async () => {
      if (!jobId || !jobTableName) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .rpc('get_job_specifications', {
            p_job_id: jobId,
            p_job_table_name: jobTableName
          });

        if (fetchError) throw fetchError;

        setSpecifications(data || []);
      } catch (err) {
        console.error('Error fetching job specifications:', err);
        setError(err instanceof Error ? err.message : 'Failed to load specifications');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpecifications();
  }, [jobId, jobTableName]);

  // Helper functions to get specific specification values
  const getSpecificationValue = (category: string, defaultValue: string = 'N/A') => {
    const spec = specifications.find(s => s.category === category);
    return spec?.display_name || defaultValue;
  };

  const getSize = () => getSpecificationValue('size');
  const getPaperType = () => getSpecificationValue('paper_type');
  const getPaperWeight = () => getSpecificationValue('paper_weight');
  const getLamination = () => getSpecificationValue('lamination_type', 'None');

  return {
    specifications,
    isLoading,
    error,
    getSize,
    getPaperType,
    getPaperWeight,
    getLamination,
    getSpecificationValue
  };
};
