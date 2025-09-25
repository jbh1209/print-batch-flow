import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStageTimingCalculations } from "./useStageTimingCalculations";

export const useCustomWorkflowTiming = () => {
  const { calculateStageTimingWithInheritance } = useStageTimingCalculations();

  // Calculate duration for a stage when creating custom workflows
  const calculateFallbackDuration = useCallback(async (
    stageId: string,
    quantity: number = 1000
  ): Promise<number> => {
    try {
      console.log('🔄 Calculating fallback duration for stage:', stageId, 'quantity:', quantity);
      
      // Try to get stage specifications first
      const { data: specs } = await supabase
        .from('stage_specifications')
        .select('*')
        .eq('production_stage_id', stageId)
        .eq('is_active', true)
        .limit(1);

      // Try timing calculation with inheritance
      const timingResult = await calculateStageTimingWithInheritance({
        quantity,
        stageId,
        specificationId: specs?.[0]?.id || null
      });

      if (timingResult.estimatedDurationMinutes > 0) {
        console.log('✅ Calculated duration:', timingResult.estimatedDurationMinutes, 'minutes');
        return timingResult.estimatedDurationMinutes;
      }

      // Fallback to production stage defaults
      const { data: stage } = await supabase
        .from('production_stages')
        .select('running_speed_per_hour, make_ready_time_minutes, speed_unit')
        .eq('id', stageId)
        .single();

      if (stage?.running_speed_per_hour) {
        const makeReady = stage.make_ready_time_minutes || 30;
        const speedPerHour = stage.running_speed_per_hour;
        const runningTime = stage.speed_unit === 'items_per_hour' 
          ? Math.ceil((quantity / speedPerHour) * 60)
          : 60; // Default
        
        const totalDuration = makeReady + runningTime;
        console.log('✅ Fallback calculation:', totalDuration, 'minutes');
        return totalDuration;
      }

      // Final fallback
      console.warn('⚠️ Using final fallback duration: 60 minutes');
      return 60;
    } catch (error) {
      console.error('❌ Error calculating fallback duration:', error);
      return 60; // Safe fallback
    }
  }, [calculateStageTimingWithInheritance]);

  // Ensure all stages in a workflow have valid durations
  const validateWorkflowTiming = useCallback(async (
    stages: Array<{ id: string; estimatedDurationMinutes?: number | null }>,
    jobQuantity: number = 1000
  ) => {
    const updatedStages = [];
    
    for (const stage of stages) {
      if (!stage.estimatedDurationMinutes || stage.estimatedDurationMinutes <= 0) {
        const calculatedDuration = await calculateFallbackDuration(stage.id, jobQuantity);
        updatedStages.push({
          ...stage,
          estimatedDurationMinutes: calculatedDuration
        });
      } else {
        updatedStages.push(stage);
      }
    }
    
    return updatedStages;
  }, [calculateFallbackDuration]);

  return {
    calculateFallbackDuration,
    validateWorkflowTiming
  };
};