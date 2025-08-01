
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseUnifiedSpecifications, type LegacySpecifications, type NormalizedSpecification } from '@/utils/specificationParser';

interface JobSpecification {
  category: string;
  specification_id: string;
  name: string;
  display_name: string;
  properties: any;
}

export const useJobSpecificationDisplay = (jobId?: string, jobTableName?: string) => {
  const [specifications, setSpecifications] = useState<JobSpecification[]>([]);
  const [legacySpecs, setLegacySpecs] = useState<LegacySpecifications | null>(null);
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

        // Fetch normalized specifications
        const { data, error: fetchError } = await supabase
          .rpc('get_job_specifications', {
            p_job_id: jobId,
            p_job_table_name: jobTableName
          });

        if (fetchError) throw fetchError;

        setSpecifications(data || []);

        // Fetch legacy specifications if using production_jobs table
        if (jobTableName === 'production_jobs') {
          const { data: legacyData, error: legacyError } = await supabase
            .from('production_jobs')
            .select('paper_specifications, printing_specifications, finishing_specifications, delivery_specifications')
            .eq('id', jobId)
            .single();

          if (legacyError && legacyError.code !== 'PGRST116') {
            console.warn('Error fetching legacy specifications:', legacyError);
          } else if (legacyData) {
            setLegacySpecs({
              paper_specifications: legacyData.paper_specifications as Record<string, any> || {},
              printing_specifications: legacyData.printing_specifications as Record<string, any> || {},
              finishing_specifications: legacyData.finishing_specifications as Record<string, any> || {},
              delivery_specifications: legacyData.delivery_specifications as Record<string, any> || {}
            });
          }
        }

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
    // Try normalized specifications first
    const spec = specifications.find(s => s.category === category);
    if (spec?.display_name) {
      return spec.display_name;
    }

    // Fallback to unified parser for legacy data
    if (legacySpecs) {
      const normalizedSpecs: NormalizedSpecification[] = specifications.map(s => ({
        category: s.category,
        specification_id: s.specification_id,
        name: s.name,
        display_name: s.display_name,
        properties: s.properties
      }));

      const unifiedSpecs = parseUnifiedSpecifications(legacySpecs, normalizedSpecs);
      
      switch (category) {
        case 'paper_type':
          return unifiedSpecs.paperType || defaultValue;
        case 'paper_weight':
          return unifiedSpecs.paperWeight || defaultValue;
        case 'size':
          return unifiedSpecs.paperSize || defaultValue;
        case 'lamination_type':
          return unifiedSpecs.finishingSpec || defaultValue;
        default:
          return defaultValue;
      }
    }

    return defaultValue;
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
    getSpecificationValue,
    getJobSpecifications
  };
};
