import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TimingCalculationService } from "@/services/timingCalculationService";

export const useBulkTimingRecalculation = () => {
  const [isRecalculating, setIsRecalculating] = useState(false);

  const recalculateAllStageTiming = async () => {
    setIsRecalculating(true);
    
    try {
      // Get all active job stage instances that need timing recalculation
      const { data: stageInstances, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          stage_specification_id,
          quantity,
          estimated_duration_minutes,
          job_table_name,
          production_stages(id, name, running_speed_per_hour, make_ready_time_minutes, speed_unit)
        `)
        .neq('status', 'cancelled');

      if (fetchError) throw fetchError;

      if (!stageInstances || stageInstances.length === 0) {
        toast.info("No active stage instances found to recalculate");
        return;
      }

      let updateCount = 0;

      // Process each stage instance
      for (const instance of stageInstances) {
        try {
          // Get job details for quantity if not available on stage instance
          let quantity = instance.quantity;
          
          if (!quantity || quantity <= 0) {
            // Only support production_jobs table for now
            if (instance.job_table_name === 'production_jobs' || !instance.job_table_name) {
              const { data: jobData } = await supabase
                .from('production_jobs')
                .select('qty')
                .eq('id', instance.job_id)
                .single();
              
              quantity = jobData?.qty || 1;
            } else {
              quantity = 1;
            }
          }

          // Recalculate timing using the service
          const timingEstimate = await TimingCalculationService.calculateStageTimingWithInheritance({
            quantity,
            stageId: instance.production_stage_id,
            specificationId: instance.stage_specification_id
          });

          const oldDuration = instance.estimated_duration_minutes;
          const newDuration = timingEstimate.estimatedDurationMinutes;

          // Only update if timing has changed
          if (oldDuration !== newDuration) {
            const { error: updateError } = await supabase
              .from('job_stage_instances')
              .update({
                estimated_duration_minutes: newDuration,
                updated_at: new Date().toISOString()
              })
              .eq('id', instance.id);

            if (!updateError) {
              updateCount++;
            }
          }
        } catch (error) {
          console.warn(`Failed to recalculate timing for stage instance ${instance.id}:`, error);
        }
      }

      if (updateCount > 0) {
        toast.success(`Successfully recalculated timing for ${updateCount} stage instances`);
      } else {
        toast.info("No stage timings needed to be updated");
      }
      
      return updateCount;
    } catch (error) {
      console.error('Error during bulk timing recalculation:', error);
      toast.error("An error occurred during bulk timing recalculation");
      return 0;
    } finally {
      setIsRecalculating(false);
    }
  };

  return {
    recalculateAllStageTiming,
    isRecalculating
  };
};
