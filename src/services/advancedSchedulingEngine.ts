import { supabase } from "@/integrations/supabase/client";
import { stageQueueManager } from "./stageQueueManager";
import { dependencyResolver } from "./dependencyResolver";

interface QueuePosition {
  stageId: string;
  stageName: string;
  position: number;
  totalInQueue: number;
  estimatedStartDate: Date;
  estimatedCompletionDate: Date;
  queueDaysAhead: number;
  isBottleneck: boolean;
}

interface AdvancedScheduleResult {
  jobId: string;
  totalEstimatedDays: number;
  estimatedStartDate: Date;
  estimatedCompletionDate: Date;
  queuePositions: QueuePosition[];
  criticalPath: string[];
  bottleneckStages: string[];
  scheduleConfidence: 'high' | 'medium' | 'low';
  riskFactors: string[];
  alternativeTimelines?: {
    optimistic: { days: number; probability: number };
    realistic: { days: number; probability: number };
    pessimistic: { days: number; probability: number };
  };
}

interface StageWorkloadSnapshot {
  stageId: string;
  currentQueue: Array<{
    jobId: string;
    estimatedDuration: number;
    priority: number;
    insertedPosition?: number;
  }>;
  dailyCapacity: number;
  isBottleneck: boolean;
}

export class AdvancedSchedulingEngine {
  /**
   * Calculate advanced schedule for a job with queue position management
   */
  async calculateAdvancedSchedule(
    jobId: string, 
    jobTableName: string,
    priority: number = 50
  ): Promise<AdvancedScheduleResult> {
    // Get job stage instances
    const { data: stageInstances, error } = await supabase
      .from('job_stage_instances')
      .select(`
        production_stage_id,
        stage_order,
        estimated_duration_minutes,
        quantity,
        production_stages!inner(
          name, 
          running_speed_per_hour, 
          make_ready_time_minutes,
          speed_unit
        )
      `)
      .eq('job_id', jobId)
      .eq('job_table_name', jobTableName)
      .order('stage_order');

    if (error || !stageInstances) {
      throw new Error(`Error fetching job stages: ${error?.message}`);
    }

    // Get current workload snapshots for all stages
    const workloadSnapshots = await this.getStageWorkloadSnapshots(
      stageInstances.map(s => s.production_stage_id)
    );

    // Calculate queue positions for each stage
    const queuePositions = await this.calculateQueuePositions(
      jobId,
      stageInstances,
      workloadSnapshots,
      priority
    );

    // Analyze critical path and dependencies
    const criticalPathAnalysis = await dependencyResolver.analyzeCriticalPath(jobId, jobTableName);

    // Calculate realistic timeline considering dependencies
    const timeline = this.calculateRealisticTimeline(queuePositions, criticalPathAnalysis);

    // Assess schedule confidence and risk factors
    const { confidence, riskFactors } = this.assessScheduleConfidence(queuePositions, criticalPathAnalysis);

    // Generate alternative timeline scenarios
    const alternativeTimelines = this.generateAlternativeTimelines(timeline, riskFactors);

    return {
      jobId,
      totalEstimatedDays: timeline.totalDays,
      estimatedStartDate: timeline.startDate,
      estimatedCompletionDate: timeline.completionDate,
      queuePositions,
      criticalPath: criticalPathAnalysis.path,
      bottleneckStages: criticalPathAnalysis.bottleneckStages,
      scheduleConfidence: confidence,
      riskFactors,
      alternativeTimelines
    };
  }

  /**
   * Calculate optimal insertion position for a new job in stage queues
   */
  async calculateOptimalInsertion(
    stageId: string,
    estimatedDuration: number,
    priority: number,
    dueDate?: Date
  ): Promise<{
    position: number;
    impact: {
      delayedJobs: number;
      averageDelayHours: number;
      capacityUtilization: number;
    };
    recommendation: string;
  }> {
    const workload = await stageQueueManager.getStageWorkload(stageId);
    if (!workload) {
      return {
        position: 1,
        impact: { delayedJobs: 0, averageDelayHours: 0, capacityUtilization: 0 },
        recommendation: 'Stage not found'
      };
    }

    // Get current queue for this stage
    const currentQueue = await this.getStageCurrentQueue(stageId);
    
    // Calculate insertion position based on priority and due date
    let insertPosition = currentQueue.length + 1; // Default to end of queue
    
    if (priority > 70) {
      // High priority jobs go to front of non-expedited jobs
      insertPosition = Math.max(1, currentQueue.findIndex(job => job.priority <= 70) + 1);
    } else if (dueDate) {
      // Insert based on due date urgency
      const urgencyScore = this.calculateUrgencyScore(dueDate);
      insertPosition = currentQueue.findIndex(job => 
        this.calculateUrgencyScore(job.dueDate) < urgencyScore
      ) + 1;
      if (insertPosition === 0) insertPosition = currentQueue.length + 1;
    }

    // Calculate impact of insertion
    const impact = this.calculateInsertionImpact(currentQueue, insertPosition, estimatedDuration);

    return {
      position: insertPosition,
      impact,
      recommendation: this.generateInsertionRecommendation(insertPosition, impact, priority)
    };
  }

  /**
   * Update job priorities across all stages to optimize flow
   */
  async optimizeJobFlow(departmentId?: string): Promise<{
    optimizationsApplied: number;
    estimatedTimeSaved: number;
    bottlenecksResolved: string[];
  }> {
    const bottlenecks = await stageQueueManager.getBottleneckStages();
    let optimizationsApplied = 0;
    let estimatedTimeSaved = 0;
    const bottlenecksResolved: string[] = [];

    for (const bottleneck of bottlenecks) {
      // Get jobs in bottleneck stage
      const { data: bottleneckJobs, error } = await supabase
        .from('job_stage_instances')
        .select(`
          job_id,
          job_table_name,
          estimated_duration_minutes,
          job_order_in_stage,
          production_jobs!inner(due_date, is_expedited)
        `)
        .eq('production_stage_id', bottleneck.stageId)
        .eq('status', 'pending')
        .order('job_order_in_stage');

      if (error || !bottleneckJobs) continue;

      // Optimize job order based on due dates and dependencies
      const optimizedOrder = this.optimizeStageJobOrder(bottleneckJobs);
      
      // Update job orders if improvements found
      if (optimizedOrder.improved) {
        await this.updateStageJobOrders(bottleneck.stageId, optimizedOrder.newOrder);
        optimizationsApplied += optimizedOrder.jobsReordered;
        estimatedTimeSaved += optimizedOrder.timeSaved;
        
        if (optimizedOrder.timeSaved > 4) { // 4+ hours saved
          bottlenecksResolved.push(bottleneck.stageName);
        }
      }
    }

    return {
      optimizationsApplied,
      estimatedTimeSaved,
      bottlenecksResolved
    };
  }

  /**
   * Get real-time queue status for a stage
   */
  async getStageQueueStatus(stageId: string): Promise<{
    currentPosition: number;
    totalInQueue: number;
    averageWaitTime: number;
    nextAvailableSlot: Date;
    capacity: {
      daily: number;
      utilized: number;
      available: number;
    };
    trends: {
      queueGrowing: boolean;
      averageJobDuration: number;
      throughputPerDay: number;
    };
  }> {
    const workload = await stageQueueManager.getStageWorkload(stageId);
    if (!workload) {
      throw new Error('Stage not found');
    }

    // Calculate queue metrics
    const averageWaitTime = workload.queueDaysToProcess * 24; // Convert to hours
    const utilized = (workload.totalActiveHours + workload.totalPendingHours) / (workload.dailyCapacityHours * 7) * 100;
    const available = Math.max(0, workload.dailyCapacityHours - (workload.totalActiveHours / 24));

    // Get historical data for trends
    const trends = await this.calculateStageTrends(stageId);

    return {
      currentPosition: 1, // Will be calculated based on specific job
      totalInQueue: workload.pendingJobsCount,
      averageWaitTime,
      nextAvailableSlot: workload.earliestAvailableSlot,
      capacity: {
        daily: workload.dailyCapacityHours,
        utilized,
        available
      },
      trends
    };
  }

  /**
   * Private helper methods
   */
  private async getStageWorkloadSnapshots(stageIds: string[]): Promise<Map<string, StageWorkloadSnapshot>> {
    const snapshots = new Map<string, StageWorkloadSnapshot>();

    for (const stageId of stageIds) {
      const workload = await stageQueueManager.getStageWorkload(stageId);
      if (!workload) continue;

      const currentQueue = await this.getStageCurrentQueue(stageId);
      
      snapshots.set(stageId, {
        stageId,
        currentQueue,
        dailyCapacity: workload.dailyCapacityHours,
        isBottleneck: workload.isBottleneck
      });
    }

    return snapshots;
  }

  private async getStageCurrentQueue(stageId: string): Promise<Array<{
    jobId: string;
    estimatedDuration: number;
    priority: number;
    dueDate?: Date;
    insertedPosition?: number;
  }>> {
    const { data: queueJobs, error } = await supabase
      .from('job_stage_instances')
      .select(`
        job_id,
        estimated_duration_minutes,
        job_order_in_stage,
        production_jobs!inner(due_date, is_expedited)
      `)
      .eq('production_stage_id', stageId)
      .eq('status', 'pending')
      .order('job_order_in_stage');

    if (error || !queueJobs) return [];

    return queueJobs.map(job => ({
      jobId: job.job_id,
      estimatedDuration: job.estimated_duration_minutes || 60,
      priority: (job as any).production_jobs.is_expedited ? 100 : 50,
      dueDate: (job as any).production_jobs.due_date ? new Date((job as any).production_jobs.due_date) : undefined,
      insertedPosition: job.job_order_in_stage
    }));
  }

  private async calculateQueuePositions(
    jobId: string,
    stageInstances: any[],
    workloadSnapshots: Map<string, StageWorkloadSnapshot>,
    priority: number
  ): Promise<QueuePosition[]> {
    const positions: QueuePosition[] = [];
    let cumulativeStartDate = new Date();

    for (const stage of stageInstances) {
      const snapshot = workloadSnapshots.get(stage.production_stage_id);
      if (!snapshot) continue;

      const estimatedDuration = stage.estimated_duration_minutes || 60;
      
      // Calculate optimal insertion position
      const insertion = await this.calculateOptimalInsertion(
        stage.production_stage_id,
        estimatedDuration,
        priority
      );

      // Calculate start date based on queue position
      const hoursAhead = snapshot.currentQueue
        .slice(0, insertion.position - 1)
        .reduce((sum, job) => sum + job.estimatedDuration, 0) / 60;

      const queueDaysAhead = hoursAhead / snapshot.dailyCapacity;
      const stageStartDate = new Date(cumulativeStartDate.getTime() + (queueDaysAhead * 24 * 60 * 60 * 1000));
      const stageCompletionDate = new Date(stageStartDate.getTime() + (estimatedDuration * 60 * 1000));

      positions.push({
        stageId: stage.production_stage_id,
        stageName: (stage as any).production_stages.name,
        position: insertion.position,
        totalInQueue: snapshot.currentQueue.length + 1,
        estimatedStartDate: stageStartDate,
        estimatedCompletionDate: stageCompletionDate,
        queueDaysAhead,
        isBottleneck: snapshot.isBottleneck
      });

      cumulativeStartDate = stageCompletionDate;
    }

    return positions;
  }

  private calculateRealisticTimeline(
    queuePositions: QueuePosition[], 
    criticalPathAnalysis: any
  ): { totalDays: number; startDate: Date; completionDate: Date } {
    if (queuePositions.length === 0) {
      return {
        totalDays: 0,
        startDate: new Date(),
        completionDate: new Date()
      };
    }

    const startDate = queuePositions[0].estimatedStartDate;
    const completionDate = queuePositions[queuePositions.length - 1].estimatedCompletionDate;
    const totalDays = Math.ceil((completionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    return { totalDays, startDate, completionDate };
  }

  private assessScheduleConfidence(
    queuePositions: QueuePosition[], 
    criticalPathAnalysis: any
  ): { confidence: 'high' | 'medium' | 'low'; riskFactors: string[] } {
    const riskFactors: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'high';

    // Check for bottlenecks
    const bottleneckStages = queuePositions.filter(pos => pos.isBottleneck);
    if (bottleneckStages.length > 2) {
      confidence = 'low';
      riskFactors.push(`${bottleneckStages.length} bottleneck stages in workflow`);
    } else if (bottleneckStages.length > 0) {
      confidence = confidence === 'high' ? 'medium' : 'low';
      riskFactors.push(`${bottleneckStages.length} bottleneck stage(s)`);
    }

    // Check for long queues
    const longQueues = queuePositions.filter(pos => pos.queueDaysAhead > 7);
    if (longQueues.length > 0) {
      confidence = confidence === 'high' ? 'medium' : 'low';
      riskFactors.push(`Stages with 7+ day queues: ${longQueues.map(q => q.stageName).join(', ')}`);
    }

    // Check timeline length
    const maxPosition = Math.max(...queuePositions.map(pos => pos.position));
    if (maxPosition > 50) {
      confidence = 'low';
      riskFactors.push('High queue positions may cause delays');
    }

    return { confidence, riskFactors };
  }

  private generateAlternativeTimelines(
    timeline: { totalDays: number },
    riskFactors: string[]
  ) {
    const baseDays = timeline.totalDays;
    const riskMultiplier = 1 + (riskFactors.length * 0.1);

    return {
      optimistic: { 
        days: Math.max(1, Math.round(baseDays * 0.8)), 
        probability: riskFactors.length === 0 ? 80 : Math.max(20, 60 - riskFactors.length * 10)
      },
      realistic: { 
        days: baseDays, 
        probability: 70 
      },
      pessimistic: { 
        days: Math.round(baseDays * riskMultiplier), 
        probability: Math.min(90, 50 + riskFactors.length * 5)
      }
    };
  }

  private calculateUrgencyScore(dueDate?: Date): number {
    if (!dueDate) return 0;
    const daysUntilDue = (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 100 - daysUntilDue * 2); // Higher score = more urgent
  }

  private calculateInsertionImpact(
    currentQueue: any[], 
    insertPosition: number, 
    estimatedDuration: number
  ) {
    const delayedJobs = Math.max(0, currentQueue.length - insertPosition + 1);
    const averageDelayHours = delayedJobs > 0 ? estimatedDuration / 60 : 0;
    const capacityUtilization = (currentQueue.length + 1) * 2; // Simplified calculation

    return {
      delayedJobs,
      averageDelayHours,
      capacityUtilization
    };
  }

  private generateInsertionRecommendation(
    position: number, 
    impact: any, 
    priority: number
  ): string {
    if (priority > 80) {
      return `High priority job - inserting at position ${position}`;
    }
    if (impact.delayedJobs > 10) {
      return `Will delay ${impact.delayedJobs} jobs by ~${Math.round(impact.averageDelayHours)}h`;
    }
    return `Optimal insertion at position ${position} with minimal impact`;
  }

  private optimizeStageJobOrder(jobs: any[]): {
    improved: boolean;
    newOrder: Array<{ jobId: string; newPosition: number }>;
    jobsReordered: number;
    timeSaved: number;
  } {
    // Simplified optimization - can be enhanced with more sophisticated algorithms
    const optimized = jobs
      .sort((a, b) => {
        // Prioritize expedited jobs
        if ((a as any).production_jobs.is_expedited !== (b as any).production_jobs.is_expedited) {
          return (b as any).production_jobs.is_expedited ? 1 : -1;
        }
        
        // Then by due date
        const aDate = new Date((a as any).production_jobs.due_date || '9999-12-31');
        const bDate = new Date((b as any).production_jobs.due_date || '9999-12-31');
        return aDate.getTime() - bDate.getTime();
      });

    const newOrder = optimized.map((job, index) => ({
      jobId: job.job_id,
      newPosition: index + 1
    }));

    const jobsReordered = newOrder.filter((job, index) => 
      job.newPosition !== jobs[index].job_order_in_stage
    ).length;

    return {
      improved: jobsReordered > 0,
      newOrder,
      jobsReordered,
      timeSaved: jobsReordered * 0.5 // Estimate 30 minutes saved per reorder
    };
  }

  private async updateStageJobOrders(
    stageId: string, 
    newOrder: Array<{ jobId: string; newPosition: number }>
  ): Promise<void> {
    for (const order of newOrder) {
      await supabase
        .from('job_stage_instances')
        .update({ job_order_in_stage: order.newPosition })
        .eq('production_stage_id', stageId)
        .eq('job_id', order.jobId);
    }
  }

  private async calculateStageTrends(stageId: string) {
    // Simplified trend calculation - can be enhanced with historical data
    const workload = await stageQueueManager.getStageWorkload(stageId);
    if (!workload) {
      return {
        queueGrowing: false,
        averageJobDuration: 60,
        throughputPerDay: 8
      };
    }

    return {
      queueGrowing: workload.pendingJobsCount > 10,
      averageJobDuration: workload.totalPendingHours / Math.max(1, workload.pendingJobsCount),
      throughputPerDay: workload.dailyCapacityHours
    };
  }
}

export const advancedSchedulingEngine = new AdvancedSchedulingEngine();