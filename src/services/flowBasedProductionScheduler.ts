import { supabase } from "@/integrations/supabase/client";
import { stageQueueManager } from "./stageQueueManager";
import { dependencyResolver } from "./dependencyResolver";
import { advancedSchedulingEngine } from "./advancedSchedulingEngine";
import { dynamicDueDateService } from "./dynamicDueDateService";

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

      // Create flow dependencies in database first
      await dependencyResolver.createJobFlowDependencies(request.jobId, request.jobTableName);

      // Calculate advanced schedule with queue positions
      const advancedSchedule = await advancedSchedulingEngine.calculateAdvancedSchedule(
        request.jobId, 
        request.jobTableName, 
        request.priority
      );
      
      // Calculate timeline through production flow with dependency awareness
      const timeline = await stageQueueManager.calculateJobTimeline(request.jobId, request.jobTableName);

      // Update job with realistic due date based on advanced scheduling
      const finalCompletionDate = advancedSchedule.estimatedCompletionDate;

      await this.updateJobSchedule(request.jobId, request.jobTableName, {
        estimatedStartDate: advancedSchedule.estimatedStartDate,
        estimatedCompletionDate: finalCompletionDate,
        totalEstimatedDays: timeline.totalEstimatedWorkingDays
      });

      return {
        jobId: request.jobId,
        success: true,
        estimatedStartDate: advancedSchedule.estimatedStartDate,
        estimatedCompletionDate: finalCompletionDate,
        totalEstimatedDays: advancedSchedule.totalEstimatedDays,
        stageTimeline: advancedSchedule.queuePositions.map(pos => ({
          stageId: pos.stageId,
          stageName: pos.stageName,
          estimatedStartDate: pos.estimatedStartDate,
          estimatedCompletionDate: pos.estimatedCompletionDate,
          queuePosition: pos.position,
          isBottleneck: pos.isBottleneck
        })),
        bottleneckStages: advancedSchedule.bottleneckStages,
        criticalPath: advancedSchedule.criticalPath,
        message: `Job scheduled with ${advancedSchedule.scheduleConfidence} confidence, estimated completion in ${advancedSchedule.totalEstimatedDays} days`
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
   * Calculate realistic due date with 1-day buffer for client communication
   */
  async calculateRealisticDueDate(
    jobId: string, 
    jobTableName: string,
    priority: number = 50
  ): Promise<{
    internalCompletionDate: Date;
    dueDateWithBuffer: Date;
    bufferDays: number;
    totalWorkingDays: number;
    confidence: 'high' | 'medium' | 'low';
    factors: string[];
  }> {
    // Use the new dynamic due date service for initial calculation
    const dueDateInfo = await dynamicDueDateService.calculateInitialDueDate(jobId, jobTableName);
    const bottlenecks = await stageQueueManager.getBottleneckStages();
    
    // Determine confidence level based on production conditions
    let confidence: 'high' | 'medium' | 'low' = 'high';
    const factors: string[] = [];

    if (bottlenecks.length > 2) {
      confidence = 'low';
      factors.push(`${bottlenecks.length} production bottlenecks detected`);
    } else if (bottlenecks.length > 0) {
      confidence = 'medium';
      factors.push(`${bottlenecks.length} bottleneck stage(s)`);
    }

    if (dueDateInfo.totalWorkingDays > 10) {
      confidence = confidence === 'high' ? 'medium' : 'low';
      factors.push('Long production timeline (>10 working days)');
    }

    if (dueDateInfo.totalWorkingDays > 5) {
      factors.push('Complex workflow requiring multiple stages');
    }

    // Add working day calculation info to factors
    factors.push(`Calculated using 8-hour shifts at 85% efficiency`);
    factors.push(`${dueDateInfo.bufferDays} working day buffer added for safety`);

    return {
      internalCompletionDate: dueDateInfo.internalCompletionDate,
      dueDateWithBuffer: dueDateInfo.dueDateWithBuffer,
      bufferDays: dueDateInfo.bufferDays,
      totalWorkingDays: dueDateInfo.totalWorkingDays,
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
   * Get stages that can be started based on dependencies
   */
  async getAvailableStages(jobId: string, jobTableName: string): Promise<Array<{
    stageId: string;
    stageName: string;
    canStart: boolean;
    blockedBy: string[];
    reason: string;
  }>> {
    return await dependencyResolver.getNextAvailableStages(jobId, jobTableName);
  }

  /**
   * Check if a specific stage can start
   */
  async canStageStart(jobId: string, jobTableName: string, stageId: string): Promise<{
    canStart: boolean;
    blockedBy: string[];
    reason: string;
  }> {
    return await dependencyResolver.canStageStart(jobId, jobTableName, stageId);
  }

  /**
   * Private helper methods
   */

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