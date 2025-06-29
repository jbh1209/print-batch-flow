
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface JobPrintSpecification {
  id: string;
  job_id: string;
  job_table_name: string;
  specification_category: string;
  specification_id: string;
  printer_id?: string;
  created_at: string;
}

export interface JobSpecificationData {
  category: string;
  specification_id: string;
  name: string;
  display_name: string;
  properties: Record<string, any>;
  printer_id?: string;
  printer_name?: string;
}

export const useJobPrintSpecifications = (jobId?: string, jobTableName?: string) => {
  const [specifications, setSpecifications] = useState<JobSpecificationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchJobSpecifications = async () => {
    if (!jobId || !jobTableName) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .rpc('get_job_specifications', {
          p_job_id: jobId,
          p_job_table_name: jobTableName
        });

      if (error) throw error;
      setSpecifications(data || []);
    } catch (error) {
      console.error('Error fetching job specifications:', error);
      toast.error('Failed to load job specifications');
    } finally {
      setIsLoading(false);
    }
  };

  const saveJobSpecification = async (
    category: string,
    specificationId: string,
    printerId?: string
  ) => {
    if (!jobId || !jobTableName) return;

    try {
      const { error } = await supabase
        .from('job_print_specifications')
        .upsert({
          job_id: jobId,
          job_table_name: jobTableName,
          specification_category: category,
          specification_id: specificationId,
          printer_id: printerId
        }, {
          onConflict: 'job_id,job_table_name,specification_category'
        });

      if (error) throw error;
      
      await fetchJobSpecifications();
      toast.success('Specification saved successfully');
    } catch (error) {
      console.error('Error saving job specification:', error);
      toast.error('Failed to save specification');
      throw error;
    }
  };

  const removeJobSpecification = async (category: string) => {
    if (!jobId || !jobTableName) return;

    try {
      const { error } = await supabase
        .from('job_print_specifications')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .eq('specification_category', category);

      if (error) throw error;
      
      await fetchJobSpecifications();
      toast.success('Specification removed successfully');
    } catch (error) {
      console.error('Error removing job specification:', error);
      toast.error('Failed to remove specification');
    }
  };

  useEffect(() => {
    if (jobId && jobTableName) {
      fetchJobSpecifications();
    }
  }, [jobId, jobTableName]);

  return {
    specifications,
    isLoading,
    saveJobSpecification,
    removeJobSpecification,
    refetch: fetchJobSpecifications
  };
};
