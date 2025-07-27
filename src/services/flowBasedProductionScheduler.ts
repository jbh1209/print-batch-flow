import { supabase } from "@/integrations/supabase/client";
import { stageQueueManager } from "./stageQueueManager";

interface JobSchedulingRequest {
  jobId: string;
  jobTableName: string;
  priority?: number; // 1-100, higher = more urgent
  requestedDueDate?: Date;
}

interface SchedulingResult {
  jobId: string;
  success: boolean;
  estimatedStartDate: Date;
  estimatedCompletionDate: Date;
  totalEstimatedDays: number;
  stageTimeline: Array<{
    stageId: string;
    stageName: string;
    estimatedStartDate: Date;
    estimatedCompletionDate: Date;
    queuePosition: number;
    isBottleneck: boolean;
  }>;
  bottleneckStages: string[];
  criticalPath: string[];
  message?: string;
}

interface BatchSchedulingResult {
  successful: number;
  failed: number;
  results: SchedulingResult[];
  capacityImpact: {
    stageImpacts: Array<{
      stageId: string;
      stageName: string;
      currentQueueDays: number;
      additionalDays: number;
      newQueueDays: number;
    }>;
    totalImpactDays: number;
  };
}

export class FlowBasedProductionScheduler {
  /**
   * Schedule a single job using flow-based production planning
   */
  async scheduleJob(request: JobSchedulingRequest): Promise<SchedulingResult> {
    try {
      // Get job's workflow stages
      const { data: stageInstances, error: stageError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          production_stage_id,
          stage_order,
          estimated_duration_minutes,
          status,
          quantity,
          production_stages!inner(name, running_speed_per_hour, make_ready_time_minutes, speed_unit)
        `)
        .eq('job_id', request.jobId)
        .eq('job_table_name', request.jobTableName)
        .order('stage_order');

      if (stageError) {
        throw stageError;
      }

      if (!stageInstances || stageInstances.length === 0) {
        throw new Error('No workflow stages found for job');
      }

      // Calculate timeline through production flow
      const timeline = await stageQueueManager.calculateJobTimeline(request.jobId, request.jobTableName);

      // Create flow dependencies in database
      await this.createJobFlowDependencies(request.jobId, request.jobTableName, stageInstances);

      // Update job with realistic due date
      const finalCompletionDate = timeline.stages.length > 0 
        ? timeline.stages[timeline.stages.length - 1].estimatedCompletionDate
        : new Date();

      await this.updateJobSchedule(request.jobId, request.jobTableName, {
        estimatedStartDate: timeline.stages[0]?.estimatedStartDate || new Date(),
        estimatedCompletionDate: finalCompletionDate,
        totalEstimatedDays: timeline.totalEstimatedDays
      });

      return {
        jobId: request.jobId,
        success: true,
        estimatedStartDate: timeline.stages[0]?.estimatedStartDate || new Date(),
        estimatedCompletionDate: finalCompletionDate,
        totalEstimatedDays: timeline.totalEstimatedDays,
        stageTimeline: timeline.stages,
        bottleneckStages: timeline.bottleneckStage ? [timeline.bottleneckStage] : [],
        criticalPath: timeline.criticalPath,
        message: `Job scheduled through ${timeline.stages.length} stages, estimated completion in ${timeline.totalEstimatedDays} days`
      };

    } catch (error) {
      console.error(`Error scheduling job ${request.jobId}:`, error);
      
      return {
        jobId: request.jobId,
        success: false,
        estimatedStartDate: new Date(),
        estimatedCompletionDate: new Date(),
        totalEstimatedDays: 0,
        stageTimeline: [],
        bottleneckStages: [],
        criticalPath: [],
        message: `Scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Schedule multiple jobs in batch with capacity impact analysis
   */
  async batchScheduleJobs(requests: JobSchedulingRequest[]): Promise<BatchSchedulingResult> {
    const results: SchedulingResult[] = [];
    let successful = 0;
    let failed = 0;

    // Calculate capacity impact before scheduling
    const jobStageMapping = await this.buildJobStageMapping(requests);
    const capacityImpact = await stageQueueManager.calculateCapacityImpact(jobStageMapping);

    // Schedule jobs in priority order
    const sortedRequests = requests.sort((a, b) => (b.priority || 50) - (a.priority || 50));

    for (const request of sortedRequests) {
      const result = await this.scheduleJob(request);
      results.push(result);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      successful,
      failed,
      results,
      capacityImpact
    };
  }

  /**
   * Calculate realistic due date based on current production workload
   */
  async calculateRealisticDueDate(
    jobId: string, 
    jobTableName: string,
    priority: number = 50
  ): Promise<{
    earliestPossibleDate: Date;
    recommendedDueDate: Date;
    confidence: 'high' | 'medium' | 'low';
    factors: string[];
  }> {
    const timeline = await stageQueueManager.calculateJobTimeline(jobId, jobTableName);
    const bottlenecks = await stageQueueManager.getBottleneckStages();
    
    const earliestDate = timeline.stages.length > 0 
      ? timeline.stages[timeline.stages.length - 1].estimatedCompletionDate
      : new Date();

    // Add buffer based on priority and bottlenecks
    const bufferDays = this.calculateSchedulingBuffer(priority, bottlenecks.length, timeline.criticalPath.length);
    const recommendedDate = new Date(earliestDate.getTime() + (bufferDays * 24 * 60 * 60 * 1000));

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' = 'high';
    const factors: string[] = [];

    if (bottlenecks.length > 2) {
      confidence = 'low';
      factors.push(`${bottlenecks.length} production bottlenecks detected`);
    } else if (bottlenecks.length > 0) {
      confidence = 'medium';
      factors.push(`${bottlenecks.length} bottleneck stage(s)`);
    }

    if (timeline.totalEstimatedDays > 14) {
      confidence = confidence === 'high' ? 'medium' : 'low';
      factors.push('Long production timeline');
    }

    if (timeline.criticalPath.length > 3) {
      factors.push('Complex workflow with multiple critical stages');
    }

    return {
      earliestPossibleDate: earliestDate,
      recommendedDueDate: recommendedDate,
      confidence,
      factors
    };
  }

  /**
   * Get production workload summary for import preview
   */
  async getWorkloadSummary(): Promise<{
    totalPendingJobs: number;
    totalPendingHours: number;
    bottleneckStages: Array<{
      stageName: string;
      queueDays: number;
      pendingJobs: number;
    }>;
    averageLeadTime: number;
    capacityUtilization: number;
  }> {
    const workloads = await stageQueueManager.getAllStageWorkloads();
    const bottlenecks = await stageQueueManager.getBottleneckStages();

    const totalPendingJobs = workloads.reduce((sum, w) => sum + w.pendingJobsCount, 0);
    const totalPendingHours = workloads.reduce((sum, w) => sum + w.totalPendingHours, 0);
    const averageLeadTime = workloads.length > 0 
      ? workloads.reduce((sum, w) => sum + w.queueDaysToProcess, 0) / workloads.length 
      : 0;

    // Calculate overall capacity utilization
    const totalCapacityHours = workloads.reduce((sum, w) => sum + (w.dailyCapacityHours * 7), 0); // Weekly
    const totalWorkloadHours = workloads.reduce((sum, w) => sum + w.totalPendingHours + w.totalActiveHours, 0);
    const capacityUtilization = totalCapacityHours > 0 ? (totalWorkloadHours / totalCapacityHours) * 100 : 0;

    return {
      totalPendingJobs,
      totalPendingHours,
      bottleneckStages: bottlenecks.map(b => ({
        stageName: b.stageName,
        queueDays: b.queueDaysToProcess,
        pendingJobs: b.pendingJobsCount
      })),
      averageLeadTime,
      capacityUtilization
    };
  }

  /**
   * Private helper methods
   */
  private async createJobFlowDependencies(
    jobId: string, 
    jobTableName: string, 
    stageInstances: any[]
  ): Promise<void> {
    const dependencies = [];

    for (let i = 0; i < stageInstances.length; i++) {
      const currentStage = stageInstances[i];
      const predecessorStage = i > 0 ? stageInstances[i - 1] : null;
      const successorStage = i < stageInstances.length - 1 ? stageInstances[i + 1] : null;

      dependencies.push({
        job_id: jobId,
        job_table_name: jobTableName,
        current_stage_id: currentStage.production_stage_id,
        predecessor_stage_id: predecessorStage?.production_stage_id || null,
        successor_stage_id: successorStage?.production_stage_id || null,
        dependency_type: 'sequential',
        is_critical_path: true // Mark all as critical for now
      });
    }

    // Insert dependencies
    const { error } = await supabase
      .from('job_flow_dependencies')
      .upsert(dependencies, {
        onConflict: 'job_id,job_table_name,current_stage_id'
      });

    if (error) {
      console.error('Error creating job flow dependencies:', error);
    }
  }

  private async updateJobSchedule(
    jobId: string,
    jobTableName: string,
    schedule: {
      estimatedStartDate: Date;
      estimatedCompletionDate: Date;
      totalEstimatedDays: number;
    }
  ): Promise<void> {
    // Update the job's due date to be realistic (only for production_jobs table for now)
    if (jobTableName === 'production_jobs') {
      const { error } = await supabase
        .from('production_jobs')
        .update({
          due_date: schedule.estimatedCompletionDate.toISOString().split('T')[0], // Date only
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error(`Error updating job ${jobId} schedule:`, error);
      }
    }
  }

  private async buildJobStageMapping(requests: JobSchedulingRequest[]): Promise<Array<{
    stageId: string;
    estimatedHours: number;
  }>> {
    const stageMapping: Record<string, number> = {};

    for (const request of requests) {
      const { data: stageInstances } = await supabase
        .from('job_stage_instances')
        .select('production_stage_id, estimated_duration_minutes')
        .eq('job_id', request.jobId)
        .eq('job_table_name', request.jobTableName);

      if (stageInstances) {
        for (const stage of stageInstances) {
          const hours = (stage.estimated_duration_minutes || 60) / 60;
          if (!stageMapping[stage.production_stage_id]) {
            stageMapping[stage.production_stage_id] = 0;
          }
          stageMapping[stage.production_stage_id] += hours;
        }
      }
    }

    return Object.entries(stageMapping).map(([stageId, hours]) => ({
      stageId,
      estimatedHours: hours
    }));
  }

  private calculateSchedulingBuffer(
    priority: number,
    bottleneckCount: number,
    criticalPathLength: number
  ): number {
    let bufferDays = 2; // Base buffer

    // Priority adjustment (higher priority = less buffer)
    if (priority > 80) bufferDays *= 0.5;
    else if (priority > 60) bufferDays *= 0.75;
    else if (priority < 30) bufferDays *= 1.5;

    // Bottleneck adjustment
    bufferDays += bottleneckCount * 0.5;

    // Complexity adjustment
    if (criticalPathLength > 5) bufferDays += 1;

    return Math.max(0.5, Math.min(7, bufferDays)); // 0.5 to 7 days
  }
}

export const flowBasedScheduler = new FlowBasedProductionScheduler();