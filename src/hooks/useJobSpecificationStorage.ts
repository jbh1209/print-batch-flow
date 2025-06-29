
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useJobSpecificationStorage = () => {
  const [isLoading, setIsLoading] = useState(false);

  const saveJobSpecifications = async (
    jobId: string,
    jobTableName: string,
    specifications: Record<string, { id: string; category: string; printerId?: string }>
  ) => {
    setIsLoading(true);
    
    try {
      // Clear existing specifications for this job
      await supabase
        .from('job_print_specifications')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      // Insert new specifications
      const specificationRecords = Object.entries(specifications).map(([category, spec]) => ({
        job_id: jobId,
        job_table_name: jobTableName,
        specification_category: category,
        specification_id: spec.id,
        printer_id: spec.printerId || null
      }));

      if (specificationRecords.length > 0) {
        const { error } = await supabase
          .from('job_print_specifications')
          .insert(specificationRecords);

        if (error) throw error;
      }

      console.log(`Saved ${specificationRecords.length} specifications for job ${jobId}`);
    } catch (error) {
      console.error('Error saving job specifications:', error);
      toast.error('Failed to save job specifications');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loadJobSpecifications = async (jobId: string, jobTableName: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_job_specifications', {
          p_job_id: jobId,
          p_job_table_name: jobTableName
        });

      if (error) throw error;
      
      // Convert to the format expected by the form
      const specifications: Record<string, any> = {};
      data?.forEach((spec: any) => {
        specifications[spec.category] = {
          id: spec.specification_id,
          name: spec.name,
          display_name: spec.display_name,
          properties: spec.properties,
          printerId: spec.printer_id
        };
      });

      return specifications;
    } catch (error) {
      console.error('Error loading job specifications:', error);
      return {};
    }
  };

  return {
    saveJobSpecifications,
    loadJobSpecifications,
    isLoading
  };
};
