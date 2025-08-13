import { supabase } from "@/integrations/supabase/client";
import { calculateWorkingDays } from '@/utils/tracker/workingDayCalculations';

interface StageWorkload {
  stageId: string;
  stageName: string;
  totalPendingHours: number;
  totalActiveHours: number;
  pendingJobsCount: number;
  activeJobsCount: number;
  dailyCapacityHours: number;
  maxParallelJobs: number;
  isBottleneck: boolean;
  earliestAvailableSlot: Date;
  queueDaysToProcess: number;
}

interface JobFlowDependency {
  jobId: string;
  currentStageId: string;
  predecessorStageId?: string;
  successorStageId?: string;
  dependencyType: 'sequential' | 'parallel' | 'merge';
  estimatedStartDate?: Date;
  estimatedCompletionDate?: Date;
}

export class StageQueueManager {
  /**
   * Get current workload for all production stages
   */
  async getAllStageWorkloads(): Promise<StageWorkload[]> {
    const { data: stageCapacities, error: capacityError } = await supabase
      .from('stage_capacity_profiles')
      .select(`
        production_stage_id,
        daily_capacity_hours,
        max_parallel_jobs,
        is_bottleneck,
        efficiency_factor,
        production_stages!inner(id, name, is_active)
      `)
      .eq('production_stages.is_active', true);

    if (capacityError) {
      console.error('Error fetching stage capacities:', capacityError);
      throw capacityError;
    }

    const workloads: StageWorkload[] = [];

    for (const capacity of stageCapacities || []) {
      // Use the database function to calculate workload
      const { data: workloadData, error: workloadError } = await supabase
        .rpc('calculate_stage_queue_workload', {
          p_production_stage_id: capacity.production_stage_id
        });

      if (workloadError) {
        console.error(`Error calculating workload for stage ${capacity.production_stage_id}:`, workloadError);
        continue;
      }

      const workload = workloadData?.[0];
      if (workload) {
        const dailyCapacity = capacity.daily_capacity_hours * (capacity.efficiency_factor || 0.85);
        const queueDaysToProcess = workload.total_pending_hours / dailyCapacity;

        workloads.push({
          stageId: capacity.production_stage_id,
          stageName: (capacity as any).production_stages.name,
          totalPendingHours: parseFloat(String(workload.total_pending_hours || '0')),
          totalActiveHours: parseFloat(String(workload.total_active_hours || '0')),
          pendingJobsCount: workload.pending_jobs_count || 0,
          activeJobsCount: workload.active_jobs_count || 0,
          dailyCapacityHours: dailyCapacity,
          maxParallelJobs: capacity.max_parallel_jobs,
          isBottleneck: capacity.is_bottleneck,
          earliestAvailableSlot: new Date(workload.earliest_available_slot),
          queueDaysToProcess: Math.ceil(queueDaysToProcess)
        });
      }
    }

    return workloads.sort((a, b) => b.queueDaysToProcess - a.queueDaysToProcess);
  }

  /**
   * Get workload for a specific stage
   */
  async getStageWorkload(stageId: string): Promise<StageWorkload | null> {
    const workloads = await this.getAllStageWorkloads();
    return workloads.find(w => w.stageId === stageId) || null;
  }

  /**
   * Calculate when a new job would be able to start in a specific stage using queue status
   */
  async calculateJobStartTime(stageId: string, estimatedDurationHours: number): Promise<{
    earliestStartDate: Date;
    estimatedCompletionDate: Date;
    queuePosition: number;
  }> {
    try {
      // Get current queue end time for this stage
      const { data, error } = await supabase.rpc('get_stage_queue_end_time', {
        p_stage_id: stageId,
        p_date: new Date().toISOString().split('T')[0]
      });
      
      if (error || !data) {
        console.error('Error getting queue end time:', error);
        // Fallback to immediate start
        const startDate = new Date();
        const completionDate = new Date(startDate.getTime() + (estimatedDurationHours * 60 * 60 * 1000));
        return {
          earliestStartDate: startDate,
          estimatedCompletionDate: completionDate,
          queuePosition: 1
        };
      }

      const queueEndTime = new Date(data);
      const estimatedDurationMs = estimatedDurationHours * 60 * 60 * 1000;
      const completionTime = new Date(queueEndTime.getTime() + estimatedDurationMs);

      return {
        earliestStartDate: queueEndTime,
        estimatedCompletionDate: completionTime,
        queuePosition: 1 // Position calculation simplified since we have direct queue end time
      };
    } catch (error) {
      console.error('Error calculating job start time:', error);
      const startDate = new Date();
      const completionDate = new Date(startDate.getTime() + (estimatedDurationHours * 60 * 60 * 1000));
      return {
        earliestStartDate: startDate,
        estimatedCompletionDate: completionDate,
        queuePosition: 1
      };
    }
  }

  /**
   * Calculate complete job timeline through all stages using working days
   */
  async calculateJobTimeline(jobId: string, jobTableName: string = 'production_jobs'): Promise<{
    stages: Array<{
      stageId: string;
      stageName: string;
      estimatedStartDate: Date;
      estimatedCompletionDate: Date;
      estimatedDurationHours: number;
      queuePosition: number;
      isBottleneck: boolean;
    }>;
    totalEstimatedWorkingDays: number;
    totalEstimatedCalendarDays: number;
    bottleneckStage?: string;
    criticalPath: string[];
  }> {
    // Get job's stage instances
    const { data: stageInstances, error } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        production_stage_id,
        stage_order,
        estimated_duration_minutes,
        status,
        production_stages!inner(name)
      `)
      .eq('job_id', jobId)
      .eq('job_table_name', jobTableName)
      .order('stage_order');

    if (error) {
      console.error(`Error fetching job stage instances for job ${jobId}:`, error);
      throw error;
    }

    if (!stageInstances || stageInstances.length === 0) {
      return {
        stages: [],
        totalEstimatedWorkingDays: 0,
        totalEstimatedCalendarDays: 0,
        criticalPath: []
      };
    }
    
    const timeline = [];
    let currentDate = new Date();
    let maxCompletionDate = new Date();
    let bottleneckStage: string | undefined;
    let maxQueueDays = 0;
    
    try {
      for (const stage of stageInstances || []) {
        if (stage.status === 'completed') {
          continue;
        }
        
        const estimatedHours = (stage.estimated_duration_minutes || 60) / 60;
        
        try {
          const timing = await this.calculateJobStartTime(stage.production_stage_id, estimatedHours);
          const workload = await this.getStageWorkload(stage.production_stage_id);

          // Stage starts after both the previous stage completes AND the queue allows
          const stageStartDate = new Date(Math.max(currentDate.getTime(), timing.earliestStartDate.getTime()));
          // Update the completion date to account for when the stage actually starts
          const actualStartDelay = Math.max(0, stageStartDate.getTime() - timing.earliestStartDate.getTime());
          const stageCompletionDate = new Date(timing.estimatedCompletionDate.getTime() + actualStartDelay);

          timeline.push({
            stageId: stage.production_stage_id,
            stageName: (stage as any).production_stages.name,
            estimatedStartDate: stageStartDate,
            estimatedCompletionDate: stageCompletionDate,
            estimatedDurationHours: estimatedHours,
            queuePosition: timing.queuePosition,
            isBottleneck: workload?.isBottleneck || false
          });

          // Track bottleneck (stage with longest queue)
          if (workload && workload.queueDaysToProcess > maxQueueDays) {
            maxQueueDays = workload.queueDaysToProcess;
            bottleneckStage = stage.production_stage_id;
          }

          currentDate = stageCompletionDate;
          maxCompletionDate = new Date(Math.max(maxCompletionDate.getTime(), stageCompletionDate.getTime()));
          
        } catch (error) {
          console.error(`Error processing stage ${(stage as any).production_stages.name}:`, error);
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error processing stages for job ${jobId}:`, error);
      throw error;
    }

    // Calculate working days using the working day calculation utility
    const totalMinutes = timeline.reduce((total, stage) => total + (stage.estimatedDurationHours * 60), 0);
    const workingDayBreakdown = calculateWorkingDays(totalMinutes);
    const totalCalendarDays = Math.ceil((maxCompletionDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const criticalPath = timeline
      .filter(stage => stage.isBottleneck)
      .map(stage => stage.stageName);

    return {
      stages: timeline,
      totalEstimatedWorkingDays: workingDayBreakdown.workingDays,
      totalEstimatedCalendarDays: totalCalendarDays,
      bottleneckStage,
      criticalPath
    };
  }

  /**
   * Update stage workload tracking for all stages
   */
  async updateAllStageWorkloads(): Promise<number> {
    const { data, error } = await supabase.rpc('update_stage_workload_tracking');
    
    if (error) {
      console.error('Error updating stage workload tracking:', error);
      throw error;
    }
    
    return data || 0;
  }

  /**
   * Get bottleneck stages (stages with highest queue-to-capacity ratio)
   */
  async getBottleneckStages(limit: number = 5): Promise<StageWorkload[]> {
    const workloads = await this.getAllStageWorkloads();
    return workloads
      .filter(w => w.queueDaysToProcess > 1) // Only stages with more than 1 day queue
      .sort((a, b) => b.queueDaysToProcess - a.queueDaysToProcess)
      .slice(0, limit);
  }

  /**
   * Calculate production capacity impact of adding new jobs
   */
  async calculateCapacityImpact(newJobs: Array<{
    stageId: string;
    estimatedHours: number;
  }>): Promise<{
    stageImpacts: Array<{
      stageId: string;
      stageName: string;
      currentQueueDays: number;
      additionalDays: number;
      newQueueDays: number;
      capacityUtilization: number;
    }>;
    totalImpactDays: number;
  }> {
    const stageImpacts = [];
    let maxImpactDays = 0;

    // Group jobs by stage
    const jobsByStage = newJobs.reduce((acc, job) => {
      if (!acc[job.stageId]) acc[job.stageId] = 0;
      acc[job.stageId] += job.estimatedHours;
      return acc;
    }, {} as Record<string, number>);

    for (const [stageId, totalHours] of Object.entries(jobsByStage)) {
      const workload = await this.getStageWorkload(stageId);
      
      if (workload) {
        const additionalDays = totalHours / workload.dailyCapacityHours;
        const newQueueDays = workload.queueDaysToProcess + additionalDays;
        const utilizationIncrease = (totalHours / (workload.dailyCapacityHours * 7)) * 100; // Weekly utilization

        stageImpacts.push({
          stageId,
          stageName: workload.stageName,
          currentQueueDays: workload.queueDaysToProcess,
          additionalDays,
          newQueueDays,
          capacityUtilization: utilizationIncrease
        });

        maxImpactDays = Math.max(maxImpactDays, newQueueDays);
      }
    }

    return {
      stageImpacts: stageImpacts.sort((a, b) => b.newQueueDays - a.newQueueDays),
      totalImpactDays: Math.ceil(maxImpactDays)
    };
  }
}

export const stageQueueManager = new StageQueueManager();