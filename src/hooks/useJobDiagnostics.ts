/**
 * Hook for job scheduling diagnostics - "Why is this job scheduled here?"
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface JobDiagnostics {
  jobId: string;
  woNo: string;
  stageName: string;
  stageOrder: number;
  partAssignment: string | null;
  
  // Timing analysis
  scheduledStart: string;
  scheduledEnd: string;
  estimatedDuration: number;
  
  // Barrier analysis
  eligibleTime: string | null;
  resourceAvailableTime: string | null;
  jobBarrier: string | null;
  partBarriers: {
    cover?: string;
    text?: string;
    both?: string;
  };
  
  // Context
  isHoliday: boolean;
  workingHoursContext: string;
  upstreamDependencies: string[];
  
  // FIFO analysis
  fifoPosition: number;
  competingJobs: string[];
}

export function useJobDiagnostics() {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<JobDiagnostics | null>(null);

  const getDiagnostics = useCallback(async (stageInstanceId: string): Promise<JobDiagnostics | null> => {
    setIsLoading(true);
    try {
      // Get basic stage information
      const { data: stageData, error: stageError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          stage_order,
          part_assignment,
          scheduled_start_at,
          scheduled_end_at,
          estimated_duration_minutes,
          production_stages!inner(name),
          production_jobs!inner(wo_no, proof_approved_at)
        `)
        .eq('id', stageInstanceId)
        .single();

      if (stageError || !stageData) {
        console.error('Failed to get stage data:', stageError);
        return null;
      }

      // Get time slot information to understand resource timing
      const { data: slotsData } = await supabase
        .from('stage_time_slots')
        .select('slot_start_time, slot_end_time, production_stage_id')
        .eq('stage_instance_id', stageInstanceId)
        .order('slot_start_time', { ascending: true });

      // Get other jobs scheduled around the same time for FIFO analysis
      const scheduledStart = new Date(stageData.scheduled_start_at);
      const dayStart = new Date(scheduledStart);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(scheduledStart);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: competingData } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          scheduled_start_at,
          production_jobs!inner(wo_no, proof_approved_at)
        `)
        .eq('production_stage_id', stageData.production_stage_id)
        .gte('scheduled_start_at', dayStart.toISOString())
        .lte('scheduled_start_at', dayEnd.toISOString())
        .neq('id', stageInstanceId)
        .order('scheduled_start_at');

      // Check if scheduled date is a holiday (simple check - can be enhanced)
      const isWeekend = scheduledStart.getDay() === 0 || scheduledStart.getDay() === 6;
      const isHoliday = isWeekend; // Can be expanded with actual holiday logic

      // Determine working hours context
      const hour = scheduledStart.getHours();
      const workingHoursContext = hour < 8 ? 'Before work hours' : 
                                  hour > 16 ? 'After work hours' : 
                                  'Normal work hours (8:00-16:00)';

      // Get upstream dependencies (stages with lower stage_order in same job)
      const { data: upstreamData } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stages!inner(name),
          stage_order,
          status,
          completed_at
        `)
        .eq('job_id', stageData.job_id)
        .lt('stage_order', stageData.stage_order)
        .order('stage_order');

      const upstreamDependencies = upstreamData?.map(stage => 
        `${stage.production_stages.name} (Order ${stage.stage_order}) - ${stage.status}`
      ) || [];

      // Calculate FIFO position
      const competingJobs = competingData?.map(job => 
        `${job.production_jobs.wo_no} (${new Date(job.scheduled_start_at).toLocaleTimeString()})`
      ) || [];

      const fifoPosition = competingData?.filter(job => 
        new Date(job.production_jobs.proof_approved_at || 0) <= new Date(stageData.production_jobs.proof_approved_at || 0)
      ).length || 0;

      const result: JobDiagnostics = {
        jobId: stageData.job_id,
        woNo: stageData.production_jobs.wo_no,
        stageName: stageData.production_stages.name,
        stageOrder: stageData.stage_order,
        partAssignment: stageData.part_assignment,
        scheduledStart: stageData.scheduled_start_at,
        scheduledEnd: stageData.scheduled_end_at,
        estimatedDuration: stageData.estimated_duration_minutes || 0,
        eligibleTime: stageData.production_jobs.proof_approved_at,
        resourceAvailableTime: slotsData?.[0]?.slot_start_time || null,
        jobBarrier: stageData.production_jobs.proof_approved_at,
        partBarriers: {}, // This would need more complex analysis
        isHoliday,
        workingHoursContext,
        upstreamDependencies,
        fifoPosition: fifoPosition + 1,
        competingJobs
      };

      setDiagnostics(result);
      return result;
    } catch (error) {
      console.error('Failed to get job diagnostics:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    diagnostics,
    getDiagnostics
  };
}