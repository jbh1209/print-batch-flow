
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PrintingStage {
  id: string;
  name: string;
  color: string;
  part_name?: string;
}

export const useJobPrintingStages = (jobId: string) => {
  const [printingStages, setPrintingStages] = useState<PrintingStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const loadJobPrintingStages = async () => {
      setIsLoading(true);
      try {
        console.log('🔍 Loading existing printing stages for job:', jobId);
        
        // Get all stage instances for this job that are printing stages
        const { data: stageInstances, error } = await supabase
          .from('job_stage_instances')
          .select(`
            production_stage_id,
            part_name,
            production_stages!inner(
              id,
              name,
              color
            )
          `)
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs')
          .in('status', ['pending', 'active']);

        if (error) throw error;

        console.log('📊 Raw job stage instances:', stageInstances);

        // Filter to only printing stages and format the data
        const printingStageData = (stageInstances || [])
          .filter(instance => {
            const stageName = instance.production_stages?.name?.toLowerCase() || '';
            return stageName.includes('printing') || stageName.includes('print');
          })
          .map(instance => ({
            id: instance.production_stages.id,
            name: instance.production_stages.name,
            color: instance.production_stages.color,
            part_name: instance.part_name
          }));

        console.log('🖨️ Found printing stages for job:', printingStageData);
        setPrintingStages(printingStageData);
      } catch (error) {
        console.error('❌ Error loading job printing stages:', error);
        setPrintingStages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadJobPrintingStages();
  }, [jobId]);

  return {
    printingStages,
    isLoading
  };
};
