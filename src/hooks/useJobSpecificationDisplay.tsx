
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { specificationUnificationService } from '@/services/SpecificationUnificationService';

interface JobSpecification {
  category: string;
  specification_id: string;
  name: string;
  display_name: string;
  properties: any;
}

export const useJobSpecificationDisplay = (jobId?: string, jobTableName?: string) => {
  const [specifications, setSpecifications] = useState<JobSpecification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unifiedResult, setUnifiedResult] = useState<any>(null);

  useEffect(() => {
    const fetchSpecifications = async () => {
      if (!jobId || !jobTableName) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Use the unification service
        const result = await specificationUnificationService.getUnifiedSpecifications(jobId, jobTableName);
        
        setSpecifications(result.specifications);
        setUnifiedResult(result);
        setError(result.error || null);

      } catch (err) {
        console.error('Error fetching job specifications:', err);
        setError(err instanceof Error ? err.message : 'Failed to load specifications');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpecifications();
  }, [jobId, jobTableName]);

  // Helper function to get specifications for a job
  const getJobSpecifications = async (jobId: string, jobTableName: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_job_specifications', {
          p_job_id: jobId,
          p_job_table_name: jobTableName
        });

      if (fetchError) throw fetchError;

      // Convert to key-value pairs for backward compatibility
      const specs: Record<string, string> = {};
      (data || []).forEach((spec: JobSpecification) => {
        specs[spec.category] = spec.display_name;
      });

      return specs;
    } catch (err) {
      console.error('Error fetching job specifications:', err);
      return {};
    }
  };

  // Helper functions to get specific specification values with unified parsing
  const getSpecificationValue = (category: string, defaultValue: string = 'N/A') => {
    if (!unifiedResult) return defaultValue;
    return specificationUnificationService.getSpecificationValue(unifiedResult, category, defaultValue);
  };

  const getSize = () => getSpecificationValue('size');
  const getPaperType = () => getSpecificationValue('paper_type');
  const getPaperWeight = () => getSpecificationValue('paper_weight');
  const getLamination = () => getSpecificationValue('lamination_type', 'None');

  // Get formatted paper display (combines weight and type)
  const getPaperDisplay = (): string => {
    return unifiedResult?.paperDisplay || 'N/A';
  };

  return {
    specifications,
    isLoading,
    error,
    getSize,
    getPaperType,
    getPaperWeight,
    getLamination,
    getPaperDisplay,
    getSpecificationValue,
    getJobSpecifications
  };
};
