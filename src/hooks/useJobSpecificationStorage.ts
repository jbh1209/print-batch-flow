
import { supabase } from '@/integrations/supabase/client';

export const useJobSpecificationStorage = () => {
  const saveJobSpecifications = async (
    jobId: string,
    jobTableName: string,
    specifications: Record<string, any>
  ) => {
    try {
      // First, clear existing specifications for this job
      const { error: deleteError } = await supabase
        .from('job_print_specifications')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (deleteError) throw deleteError;

      // Insert new specifications
      const specsToInsert = Object.entries(specifications).map(([category, specData]) => ({
        job_id: jobId,
        job_table_name: jobTableName,
        specification_category: category,
        specification_id: specData.id
      }));

      if (specsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('job_print_specifications')
          .insert(specsToInsert);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Error saving job specifications:', error);
      return false;
    }
  };

  const getJobSpecifications = async (jobId: string, jobTableName: string) => {
    try {
      const { data, error } = await supabase
        .from('job_print_specifications')
        .select(`
          specification_category,
          specification_id,
          print_specifications (
            id,
            name,
            display_name,
            properties
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (error) throw error;

      const specifications: Record<string, any> = {};
      data?.forEach(spec => {
        if (spec.print_specifications) {
          specifications[spec.specification_category] = spec.print_specifications;
        }
      });

      return specifications;
    } catch (error) {
      console.error('Error loading job specifications:', error);
      return {};
    }
  };

  return {
    saveJobSpecifications,
    getJobSpecifications
  };
};
