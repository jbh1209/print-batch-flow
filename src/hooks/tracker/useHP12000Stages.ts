import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HP12000PaperSize {
  id: string;
  name: string;
  dimensions: string;
  sort_order: number;
  is_active: boolean;
}

export interface HP12000StageInstance {
  stage_instance_id: string;
  production_stage_id: string;
  stage_name: string;
  stage_order: number;
  paper_size_id: string | null;
  paper_size_name: string | null;
  is_paper_size_required: boolean;
}

export const useHP12000Stages = (jobId: string) => {
  const [paperSizes, setPaperSizes] = useState<HP12000PaperSize[]>([]);
  const [hp12000Stages, setHP12000Stages] = useState<HP12000StageInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load available paper sizes
  const loadPaperSizes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('hp12000_paper_sizes')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPaperSizes(data || []);
    } catch (error) {
      console.error('Error loading HP12000 paper sizes:', error);
      toast.error('Failed to load paper sizes');
    }
  }, []);

  // Load HP12000 stages for the job
  const loadHP12000Stages = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_job_hp12000_stages', { p_job_id: jobId });

      if (error) throw error;
      setHP12000Stages(data || []);
    } catch (error) {
      console.error('Error loading HP12000 stages:', error);
      toast.error('Failed to load HP12000 stages');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  // Update paper size for a stage instance
  const updateStagePaperSize = useCallback(async (stageInstanceId: string, paperSizeId: string) => {
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          hp12000_paper_size_id: paperSizeId,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId);

      if (error) throw error;

      // Update local state
      setHP12000Stages(prev => prev.map(stage => 
        stage.stage_instance_id === stageInstanceId 
          ? { 
              ...stage, 
              paper_size_id: paperSizeId,
              paper_size_name: paperSizes.find(ps => ps.id === paperSizeId)?.name || null
            }
          : stage
      ));

      toast.success('Paper size updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating paper size:', error);
      toast.error('Failed to update paper size');
      return false;
    }
  }, [paperSizes]);

  // Check if all HP12000 stages have paper sizes assigned
  const areAllPaperSizesAssigned = useCallback(() => {
    return hp12000Stages.every(stage => stage.paper_size_id !== null);
  }, [hp12000Stages]);

  // Get validation message if not all paper sizes are assigned
  const getValidationMessage = useCallback(() => {
    const unassignedStages = hp12000Stages.filter(stage => stage.paper_size_id === null);
    if (unassignedStages.length === 0) return null;

    return `Please assign paper sizes to the following HP12000 stages: ${unassignedStages.map(s => s.stage_name).join(', ')}`;
  }, [hp12000Stages]);

  // Load data when component mounts or jobId changes
  useEffect(() => {
    loadPaperSizes();
    loadHP12000Stages();
  }, [loadPaperSizes, loadHP12000Stages]);

  return {
    paperSizes,
    hp12000Stages,
    isLoading,
    updateStagePaperSize,
    areAllPaperSizesAssigned,
    getValidationMessage,
    refreshStages: loadHP12000Stages
  };
};