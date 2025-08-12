import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WorkflowSchedulingResult {
  success: boolean;
  jobId: string;
  scheduledCompletionDate: string;
  pathResults: {
    coverPathEnd?: string;
    textPathEnd?: string;
    convergenceEnd?: string;
  };
  error?: string;
}

export const useWorkflowFirstScheduling = () => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const scheduleJob = async (jobId: string, jobTableName: string = 'production_jobs'): Promise<WorkflowSchedulingResult | null> => {
    setIsScheduling(true);
    
    try {
      // Try new scheduler first, fallback to legacy
      const { data: v2, error: v2Err } = await supabase.functions.invoke('schedule-v2', {
        body: {
          job_id: jobId,
          job_table_name: jobTableName
        }
      });

      let ok = false;
      let payload: any = v2;

      if (!v2Err && v2?.ok) {
        ok = true;
      } else {
        const { data, error } = await supabase.functions.invoke('schedule-on-approval', {
          body: {
            job_id: jobId,
            job_table_name: jobTableName,
            forceRecalculation: false
          }
        });
        if (error) {
          throw new Error(error.message);
        }
        payload = data;
        ok = Boolean((data as any)?.success || (data as any)?.ok);
      }

      if (!ok) {
        throw new Error((payload as any)?.error || 'Scheduling failed');
      }

      toast.success(`Job scheduled successfully`);
      return (payload as any) as WorkflowSchedulingResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown scheduling error';
      console.error('Workflow scheduling error:', errorMessage);
      toast.error(`Scheduling failed: ${errorMessage}`);
      return null;
    } finally {
      setIsScheduling(false);
    }
  };

  const recalculateAllJobs = async (): Promise<{
    successful: number;
    failed: number;
    processed: number;
  } | null> => {
    setIsRecalculating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('recalc-tentative-due-dates', {
        body: {}
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success && data?.errors?.length > 0) {
        console.warn('Some jobs failed to recalculate:', data.errors);
        toast.warning(`Recalculation completed with ${data.failed} errors`);
      } else {
        toast.success(`Successfully recalculated ${data.successful} jobs`);
      }

      return {
        successful: data.successful || 0,
        failed: data.failed || 0,
        processed: data.processed || 0
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown recalculation error';
      console.error('Workflow recalculation error:', errorMessage);
      toast.error(`Recalculation failed: ${errorMessage}`);
      return null;
    } finally {
      setIsRecalculating(false);
    }
  };

  const validateJobWorkflow = async (jobId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    pathAnalysis: {
      coverStages: number;
      textStages: number;
      convergenceStages: number;
    };
  }> => {
    try {
      const { data: stages, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          part_assignment,
          stage_order,
          estimated_duration_minutes,
          status,
          production_stages(name)
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .order('stage_order');

      if (error) {
        throw new Error(error.message);
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!stages || stages.length === 0) {
        errors.push('No stages found for job');
        return {
          isValid: false,
          errors,
          warnings,
          pathAnalysis: { coverStages: 0, textStages: 0, convergenceStages: 0 }
        };
      }

      // Analyze workflow paths
      const coverStages = stages.filter(s => s.part_assignment === 'cover');
      const textStages = stages.filter(s => s.part_assignment === 'text');
      const convergenceStages = stages.filter(s => s.part_assignment === 'both' || s.part_assignment === null);

      // Validate stage durations
      for (const stage of stages) {
        if (!stage.estimated_duration_minutes || stage.estimated_duration_minutes <= 0) {
          errors.push(`Stage ${stage.production_stages?.name} has invalid duration: ${stage.estimated_duration_minutes}`);
        }
      }

      // Validate workflow structure
      if (coverStages.length === 0 && textStages.length === 0) {
        warnings.push('No cover or text stages found - job will only have convergence stages');
      }

      if (convergenceStages.length === 0) {
        warnings.push('No convergence stages found - parallel paths will not merge');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        pathAnalysis: {
          coverStages: coverStages.length,
          textStages: textStages.length,
          convergenceStages: convergenceStages.length
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      return {
        isValid: false,
        errors: [errorMessage],
        warnings: [],
        pathAnalysis: { coverStages: 0, textStages: 0, convergenceStages: 0 }
      };
    }
  };

  return {
    isScheduling,
    isRecalculating,
    scheduleJob,
    recalculateAllJobs,
    validateJobWorkflow
  };
};