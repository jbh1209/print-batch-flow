import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StageInstanceConfiguration {
  stageId: string;
  quantity: number | null;
  estimatedDurationMinutes: number | null;
  partAssignment: 'cover' | 'text' | 'both' | null;
  stageSpecificationId: string | null;
}

interface StageInstanceDataHook {
  isLoading: boolean;
  saveStageInstanceConfiguration: (
    jobId: string,
    stageId: string,
    config: StageInstanceConfiguration
  ) => Promise<boolean>;
  bulkUpdateStageConfigurations: (
    jobId: string,
    configurations: Record<string, StageInstanceConfiguration>
  ) => Promise<boolean>;
  inheritQuantityFromJob: (jobQuantity: number) => StageInstanceConfiguration;
  calculateDurationFromSpecification: (
    quantity: number,
    specificationId: string,
    specifications: any[]
  ) => number | null;
}

export const useStageInstanceData = (): StageInstanceDataHook => {
  const [isLoading, setIsLoading] = useState(false);

  const saveStageInstanceConfiguration = useCallback(async (
    jobId: string,
    stageId: string,
    config: StageInstanceConfiguration
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('💾 Saving stage instance configuration:', { jobId, stageId, config });

      // Update existing job_stage_instance or create if doesn't exist
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          quantity: config.quantity,
          estimated_duration_minutes: config.estimatedDurationMinutes,
          part_assignment: config.partAssignment,
          stage_specification_id: config.stageSpecificationId,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId)
        .eq('job_table_name', 'production_jobs');

      if (error) {
        console.error('❌ Error saving stage configuration:', error);
        throw error;
      }

      console.log('✅ Stage configuration saved successfully');
      return true;
    } catch (err) {
      console.error('❌ Failed to save stage configuration:', err);
      toast.error('Failed to save stage configuration');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const bulkUpdateStageConfigurations = useCallback(async (
    jobId: string,
    configurations: Record<string, StageInstanceConfiguration>
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('🔄 Bulk updating stage configurations:', { jobId, count: Object.keys(configurations).length });

      const updates = Object.entries(configurations).map(([stageId, config]) => 
        supabase
          .from('job_stage_instances')
          .update({
            quantity: config.quantity,
            estimated_duration_minutes: config.estimatedDurationMinutes,
            part_assignment: config.partAssignment,
            stage_specification_id: config.stageSpecificationId,
            updated_at: new Date().toISOString()
          })
          .eq('job_id', jobId)
          .eq('production_stage_id', stageId)
          .eq('job_table_name', 'production_jobs')
      );

      const results = await Promise.all(updates);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('❌ Some bulk updates failed:', errors);
        throw new Error(`${errors.length} updates failed`);
      }

      console.log('✅ All stage configurations updated successfully');
      return true;
    } catch (err) {
      console.error('❌ Failed to bulk update stage configurations:', err);
      toast.error('Failed to update stage configurations');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const inheritQuantityFromJob = useCallback((jobQuantity: number): StageInstanceConfiguration => {
    return {
      stageId: '',
      quantity: jobQuantity,
      estimatedDurationMinutes: null,
      partAssignment: null,
      stageSpecificationId: null
    };
  }, []);

  const calculateDurationFromSpecification = useCallback((
    quantity: number,
    specificationId: string,
    specifications: any[]
  ): number | null => {
    const spec = specifications.find(s => s.id === specificationId);
    if (!spec || !spec.running_speed_per_hour) {
      return null;
    }

    const hours = quantity / spec.running_speed_per_hour;
    const productionMinutes = Math.ceil(hours * 60);
    const setupMinutes = spec.make_ready_time_minutes || 0;
    
    return productionMinutes + setupMinutes;
  }, []);

  return {
    isLoading,
    saveStageInstanceConfiguration,
    bulkUpdateStageConfigurations,
    inheritQuantityFromJob,
    calculateDurationFromSpecification
  };
};