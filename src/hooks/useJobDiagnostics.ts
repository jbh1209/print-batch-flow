/**
 * Hook for job scheduling diagnostics - "Why is this job scheduled here?"
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface JobDiagnostics {
  // Job overview
  jobId: string;
  workOrder: string;
  stageName: string;
  stageOrder: number;
  partAssignment?: string;
  
  // Timing analysis - WHY THIS TIME?
  scheduledStart: string;
  scheduledEnd: string;
  duration: number;
  
  // Barriers and context - THE MATH
  eligibleTime: string;           // When this stage became eligible (part barriers)
  resourceAvailableTime: string;  // When the machine/stage was free
  actualStartTime: string;        // MAX(eligibleTime, resourceAvailableTime)
  
  // Part-specific barriers for parallel processing
  partBarriers: {
    coverBarrier?: string;        // When cover part was ready
    textBarrier?: string;         // When text part was ready  
    convergencePoint?: string;    // For 'both' stages waiting for cover+text
  };
  
  // Working hours context
  workingHoursContext: {
    isWorkingDay: boolean;
    shiftStart: string;
    shiftEnd: string;
    hasLunchBreak: boolean;
    lunchStart?: string;
    lunchEnd?: string;
  };
  
  // Dependencies - WHAT WAS WAITING?
  upstreamDependencies: Array<{
    stageName: string;
    partAssignment?: string;
    completedAt?: string;
    isBlocking: boolean;
    reason: string;
  }>;
  
  // FIFO analysis - QUEUE POSITION
  fifoPosition: {
    position: number;
    totalInQueue: number;
    approvalTime: string;
    queuedBehind: string[];  // Job WO numbers ahead in queue
  };
  
  // Competing jobs - WHO ELSE WANTED THIS TIME?
  competingJobs: Array<{
    workOrder: string;
    stageName: string;
    wouldHaveStarted: string;
    fifoRank: number;
  }>;
}

export function useJobDiagnostics() {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<JobDiagnostics | null>(null);

  const getDiagnostics = useCallback(async (stageInstanceId: string): Promise<JobDiagnostics | null> => {
    setIsLoading(true);
    try {
      // Get enhanced stage instance data with part barrier analysis
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
          scheduled_minutes,
          estimated_duration_minutes,
          production_jobs!inner (
            wo_no,
            proof_approved_at
          ),
          production_stages!inner (
            name
          )
        `)
        .eq('id', stageInstanceId)
        .single();

      if (stageError || !stageData) {
        console.error('Failed to fetch stage data:', stageError);
        return null;
      }

      // Get working hours context
      const scheduleDate = stageData.scheduled_start_at 
        ? new Date(stageData.scheduled_start_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const { data: shiftData } = await supabase.rpc('shift_window_enhanced', {
        p_date: scheduleDate
      });

      const shift = shiftData?.[0] || {};

      // Get ALL stages for this job for part barrier analysis
      const { data: jobStages } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stages!inner (name),
          completed_at,
          scheduled_end_at,
          stage_order,
          part_assignment,
          status
        `)
        .eq('job_id', stageData.job_id)
        .order('stage_order');

      // Calculate part barriers - when each part was ready
      const partBarriers: any = {};
      let eligibleTime = stageData.production_jobs.proof_approved_at || '';
      const currentStageOrder = stageData.stage_order;
      const currentPartAssignment = stageData.part_assignment;
      
      if (jobStages) {
        // For this specific stage, calculate what it was waiting for
        
        if (currentPartAssignment === 'cover') {
          // Cover stages wait for previous cover work
          const lastCoverStage = jobStages
            .filter(s => s.part_assignment === 'cover' && s.stage_order < currentStageOrder)
            .sort((a, b) => b.stage_order - a.stage_order)[0];
          partBarriers.coverBarrier = lastCoverStage?.scheduled_end_at || eligibleTime;
          eligibleTime = partBarriers.coverBarrier;
        } else if (currentPartAssignment === 'text') {
          // Text stages wait for previous text work  
          const lastTextStage = jobStages
            .filter(s => s.part_assignment === 'text' && s.stage_order < currentStageOrder)
            .sort((a, b) => b.stage_order - a.stage_order)[0];
          partBarriers.textBarrier = lastTextStage?.scheduled_end_at || eligibleTime;
          eligibleTime = partBarriers.textBarrier;
        } else if (currentPartAssignment === 'both') {
          // 'Both' stages wait for ALL parts to be ready (convergence point)
          const lastCoverStage = jobStages
            .filter(s => s.part_assignment === 'cover' && s.stage_order < currentStageOrder)
            .sort((a, b) => b.stage_order - a.stage_order)[0];
          const lastTextStage = jobStages
            .filter(s => s.part_assignment === 'text' && s.stage_order < currentStageOrder)
            .sort((a, b) => b.stage_order - a.stage_order)[0];
          
          partBarriers.coverBarrier = lastCoverStage?.scheduled_end_at || eligibleTime;
          partBarriers.textBarrier = lastTextStage?.scheduled_end_at || eligibleTime;
          
          // Convergence point is the LATER of the two
          partBarriers.convergencePoint = partBarriers.coverBarrier > partBarriers.textBarrier 
            ? partBarriers.coverBarrier 
            : partBarriers.textBarrier;
          eligibleTime = partBarriers.convergencePoint;
        }
      }

      // Get resource availability for this stage at scheduling time
      const { data: resourceData } = await supabase
        .from('stage_time_slots')
        .select('slot_end_time')
        .eq('production_stage_id', stageData.production_stage_id)
        .lt('slot_end_time', stageData.scheduled_start_at || new Date().toISOString())
        .order('slot_end_time', { ascending: false })
        .limit(1);
      
      const resourceAvailableTime = resourceData?.[0]?.slot_end_time || eligibleTime;

      // Calculate upstream dependencies with WHY blocking
      const upstreamDependencies = jobStages
        ?.filter(s => s.stage_order < stageData.stage_order)
        ?.map(dep => ({
          stageName: dep.production_stages.name,
          partAssignment: dep.part_assignment,
          completedAt: dep.completed_at,
          isBlocking: !dep.completed_at && 
                     ((currentPartAssignment === 'both') || 
                      (currentPartAssignment === dep.part_assignment) ||
                      (!currentPartAssignment && !dep.part_assignment)),
          reason: dep.completed_at 
            ? `Completed at ${dep.completed_at}` 
            : `BLOCKING: ${dep.part_assignment || 'main'} part not finished`
        })) || [];

      // Enhanced FIFO analysis with queue context
      const approvalTime = stageData.production_jobs.proof_approved_at;
      const { data: fifoData } = await supabase
        .from('production_jobs')
        .select('wo_no, proof_approved_at')
        .not('proof_approved_at', 'is', null)
        .lte('proof_approved_at', approvalTime)
        .order('proof_approved_at');

      const queuedBehind = fifoData
        ?.filter(job => job.proof_approved_at < approvalTime)
        ?.map(job => job.wo_no) || [];

      // Get competing jobs (other jobs that wanted same resource around same time)
      const timeWindow = stageData.scheduled_start_at;
      const { data: competingData } = await supabase
        .from('stage_time_slots')
        .select(`
          job_id,
          stage_instance_id
        `)
        .eq('production_stage_id', stageData.production_stage_id)
        .gte('slot_start_time', new Date(new Date(timeWindow).getTime() - 4 * 60 * 60 * 1000).toISOString())
        .lte('slot_start_time', new Date(new Date(timeWindow).getTime() + 4 * 60 * 60 * 1000).toISOString())
        .neq('job_id', stageData.job_id);

      // Get the job info for competing jobs
      const competingJobIds = competingData?.map(c => c.job_id).filter(Boolean) || [];
      const { data: competingJobsData } = competingJobIds.length > 0 
        ? await supabase
            .from('production_jobs')
            .select('id, wo_no')
            .in('id', competingJobIds)
        : { data: [] };

      const result: JobDiagnostics = {
        jobId: stageData.job_id,
        workOrder: stageData.production_jobs.wo_no,
        stageName: stageData.production_stages.name,
        stageOrder: stageData.stage_order,
        partAssignment: stageData.part_assignment,
        scheduledStart: stageData.scheduled_start_at || '',
        scheduledEnd: stageData.scheduled_end_at || '',
        duration: stageData.scheduled_minutes || stageData.estimated_duration_minutes || 0,
        eligibleTime,
        resourceAvailableTime,
        actualStartTime: stageData.scheduled_start_at || '',
        partBarriers,
        workingHoursContext: {
          isWorkingDay: true,
          shiftStart: (shift as any)?.win_start || '08:00',
          shiftEnd: (shift as any)?.win_end || '16:00',
          hasLunchBreak: (shift as any)?.has_lunch_break || false,
          lunchStart: (shift as any)?.lunch_start,
          lunchEnd: (shift as any)?.lunch_end,
        },
        upstreamDependencies,
        fifoPosition: {
          position: fifoData?.findIndex(j => j.wo_no === stageData.production_jobs.wo_no) + 1 || 1,
          totalInQueue: fifoData?.length || 1,
          approvalTime: approvalTime || '',
          queuedBehind,
        },
        competingJobs: competingJobsData?.map(job => ({
          workOrder: job.wo_no,
          stageName: stageData.production_stages.name, // Same stage
          wouldHaveStarted: 'same time window',
          fifoRank: 0 // Could enhance this with actual FIFO calculation
        })) || [],
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