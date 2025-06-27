
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CustomWorkflowStatus {
  [jobId: string]: boolean;
}

export const useCustomWorkflowStatus = (jobIds: string[]) => {
  const [customWorkflowStatus, setCustomWorkflowStatus] = useState<CustomWorkflowStatus>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCustomWorkflowStatus = async () => {
      if (jobIds.length === 0) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('production_jobs')
          .select('id, has_custom_workflow')
          .in('id', jobIds);

        if (error) {
          console.error('Error fetching custom workflow status:', error);
          return;
        }

        const statusMap: CustomWorkflowStatus = {};
        data?.forEach(job => {
          statusMap[job.id] = job.has_custom_workflow || false;
        });

        setCustomWorkflowStatus(statusMap);
      } catch (error) {
        console.error('Error in fetchCustomWorkflowStatus:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomWorkflowStatus();
  }, [jobIds.join(',')]);

  return { customWorkflowStatus, isLoading };
};
