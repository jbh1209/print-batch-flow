import { supabase } from "@/integrations/supabase/client";
import { AccessibleJobWithMasterQueue } from "@/types/masterQueue";
import { SmartQueueManager, QueuedJob } from "./smartQueueManager";

export interface ProductionChange {
  id: string;
  type: 'job_added' | 'job_cancelled' | 'job_expedited' | 'machine_down' | 'capacity_change' | 'delay_reported';
  job_id?: string;
  stage_id?: string;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  details: any;
  auto_resolved: boolean;
}

export interface RescheduleRecommendation {
  id: string;
  change_id: string;
  type: 'reorder_jobs' | 'redistribute_capacity' | 'create_batch' | 'split_batch' | 'expedite_job';
  affected_jobs: string[];
  estimated_impact_hours: number;
  confidence_score: number;
  reasoning: string[];
  auto_apply: boolean;
}

export interface ScheduleConflict {
  id: string;
  type: 'resource_overallocation' | 'deadline_miss' | 'dependency_violation' | 'capacity_exceeded';
  severity: 'warning' | 'error' | 'critical';
  affected_jobs: string[];
  resolution_suggestions: string[];
  estimated_delay_hours: number;
}

export class DynamicReschedulingEngine {
  private static instance: DynamicReschedulingEngine;
  private monitoringActive = false;
  private changeDetectionInterval: NodeJS.Timeout | null = null;
  private lastCheckTimestamp: string = new Date().toISOString();

  static getInstance(): DynamicReschedulingEngine {
    if (!this.instance) {
      this.instance = new DynamicReschedulingEngine();
    }
    return this.instance;
  }

  /**
   * Start real-time monitoring for production changes
   */
  async startMonitoring(): Promise<void> {
    if (this.monitoringActive) return;

    console.log('🔄 Starting dynamic rescheduling monitoring...');
    this.monitoringActive = true;

    // Set up real-time subscription for job changes
    this.setupRealtimeSubscriptions();

    // Set up periodic change detection
    this.changeDetectionInterval = setInterval(() => {
      this.detectProductionChanges();
    }, 30000); // Check every 30 seconds

    // Perform initial analysis
    await this.detectProductionChanges();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    console.log('⏹️ Stopping dynamic rescheduling monitoring...');
    this.monitoringActive = false;
    
    if (this.changeDetectionInterval) {
      clearInterval(this.changeDetectionInterval);
      this.changeDetectionInterval = null;
    }
  }

  /**
   * Detect recent production changes and trigger rescheduling
   */
  async detectProductionChanges(): Promise<ProductionChange[]> {
    try {
      console.log('🔍 Detecting production changes...');

      const changes: ProductionChange[] = [];

      // Check for new jobs
      const newJobs = await this.detectNewJobs();
      changes.push(...newJobs);

      // Check for expedited jobs
      const expeditedJobs = await this.detectExpeditedJobs();
      changes.push(...expeditedJobs);

      // Check for stage delays
      const delays = await this.detectStageDelays();
      changes.push(...delays);

      // Check for capacity changes
      const capacityChanges = await this.detectCapacityChanges();
      changes.push(...capacityChanges);

      if (changes.length > 0) {
        console.log(`📊 Detected ${changes.length} production changes`);
        
        // Process each change and generate recommendations
        for (const change of changes) {
          await this.processProductionChange(change);
        }
      }

      this.lastCheckTimestamp = new Date().toISOString();
      return changes;

    } catch (error) {
      console.error('❌ Error detecting production changes:', error);
      return [];
    }
  }

  /**
   * Process a production change and generate rescheduling recommendations
   */
  async processProductionChange(change: ProductionChange): Promise<RescheduleRecommendation[]> {
    try {
      console.log('⚡ Processing production change:', change.type);

      const recommendations: RescheduleRecommendation[] = [];

      switch (change.type) {
        case 'job_added':
          recommendations.push(...await this.handleNewJobAdded(change));
          break;
        case 'job_expedited':
          recommendations.push(...await this.handleJobExpedited(change));
          break;
        case 'machine_down':
          recommendations.push(...await this.handleMachineDown(change));
          break;
        case 'delay_reported':
          recommendations.push(...await this.handleDelayReported(change));
          break;
        case 'capacity_change':
          recommendations.push(...await this.handleCapacityChange(change));
          break;
      }

      // Auto-apply low-risk recommendations
      for (const recommendation of recommendations) {
        if (recommendation.auto_apply && recommendation.confidence_score >= 80) {
          await this.applyRecommendation(recommendation);
        }
      }

      return recommendations;

    } catch (error) {
      console.error('❌ Error processing production change:', error);
      return [];
    }
  }

  /**
   * Detect schedule conflicts and generate resolution suggestions
   */
  async detectScheduleConflicts(): Promise<ScheduleConflict[]> {
    try {
      console.log('🔍 Detecting schedule conflicts...');

      const conflicts: ScheduleConflict[] = [];
      const queues = await SmartQueueManager.getSmartQueues();

      // Check for resource overallocation
      const overallocationConflicts = this.detectResourceOverallocation(queues);
      conflicts.push(...overallocationConflicts);

      // Check for potential deadline misses
      const deadlineConflicts = await this.detectDeadlineMisses(queues);
      conflicts.push(...deadlineConflicts);

      // Check for capacity exceeded situations
      const capacityConflicts = this.detectCapacityExceeded(queues);
      conflicts.push(...capacityConflicts);

      console.log(`📊 Detected ${conflicts.length} schedule conflicts`);
      return conflicts;

    } catch (error) {
      console.error('❌ Error detecting schedule conflicts:', error);
      return [];
    }
  }

  /**
   * Generate optimal rescheduling plan based on current conditions
   */
  async generateReschedulingPlan(): Promise<{
    recommendations: RescheduleRecommendation[];
    conflicts: ScheduleConflict[];
    estimated_improvement_hours: number;
    risk_assessment: string;
  }> {
    try {
      console.log('📋 Generating comprehensive rescheduling plan...');

      const [conflicts, queues] = await Promise.all([
        this.detectScheduleConflicts(),
        SmartQueueManager.getSmartQueues()
      ]);

      const recommendations: RescheduleRecommendation[] = [];

      // Generate recommendations for each conflict
      for (const conflict of conflicts) {
        const conflictRecommendations = await this.generateConflictResolution(conflict);
        recommendations.push(...conflictRecommendations);
      }

      // Generate optimization recommendations
      const optimizationRecommendations = await this.generateOptimizationRecommendations(queues);
      recommendations.push(...optimizationRecommendations);

      // Calculate estimated improvement
      const estimated_improvement_hours = recommendations.reduce(
        (sum, rec) => sum + rec.estimated_impact_hours, 0
      );

      // Assess risk
      const risk_assessment = this.assessReschedulingRisk(recommendations, conflicts);

      return {
        recommendations,
        conflicts,
        estimated_improvement_hours,
        risk_assessment
      };

    } catch (error) {
      console.error('❌ Error generating rescheduling plan:', error);
      throw error;
    }
  }

  private setupRealtimeSubscriptions(): void {
    // Subscribe to production job changes
    supabase
      .channel('production-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'production_jobs'
      }, (payload) => {
        this.handleRealtimeChange('job', payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_stage_instances'
      }, (payload) => {
        this.handleRealtimeChange('stage', payload);
      })
      .subscribe();
  }

  private handleRealtimeChange(type: 'job' | 'stage', payload: any): void {
    console.log(`📡 Real-time change detected:`, type, payload.eventType);
    
    // Trigger immediate change detection for real-time updates
    setTimeout(() => {
      this.detectProductionChanges();
    }, 1000);
  }

  private async detectNewJobs(): Promise<ProductionChange[]> {
    const { data: newJobs } = await supabase
      .from('production_jobs')
      .select('id, wo_no, created_at, status')
      .gte('created_at', this.lastCheckTimestamp)
      .neq('status', 'completed');

    return (newJobs || []).map(job => ({
      id: `new_job_${job.id}`,
      type: 'job_added' as const,
      job_id: job.id,
      impact_level: 'medium' as const,
      timestamp: job.created_at,
      details: { wo_no: job.wo_no },
      auto_resolved: false
    }));
  }

  private async detectExpeditedJobs(): Promise<ProductionChange[]> {
    const { data: expeditedJobs } = await supabase
      .from('production_jobs')
      .select('id, wo_no, expedited_at, expedite_reason')
      .gte('expedited_at', this.lastCheckTimestamp)
      .eq('is_expedited', true);

    return (expeditedJobs || []).map(job => ({
      id: `expedited_${job.id}`,
      type: 'job_expedited' as const,
      job_id: job.id,
      impact_level: 'high' as const,
      timestamp: job.expedited_at,
      details: { wo_no: job.wo_no, reason: job.expedite_reason },
      auto_resolved: false
    }));
  }

  private async detectStageDelays(): Promise<ProductionChange[]> {
    // Check for jobs that are overdue at current stage
    const { data: delayedJobs } = await supabase
      .from('job_stage_instances')
      .select(`
        id, job_id, production_stage_id, started_at,
        estimated_duration_minutes, actual_duration_minutes
      `)
      .eq('status', 'active')
      .not('started_at', 'is', null);

    const delays: ProductionChange[] = [];
    const now = new Date();

    for (const stage of delayedJobs || []) {
      if (stage.started_at && stage.estimated_duration_minutes) {
        const startTime = new Date(stage.started_at);
        const expectedFinish = new Date(startTime.getTime() + stage.estimated_duration_minutes * 60000);
        
        if (now > expectedFinish) {
          const delayMinutes = Math.floor((now.getTime() - expectedFinish.getTime()) / 60000);
          
          delays.push({
            id: `delay_${stage.id}`,
            type: 'delay_reported',
            job_id: stage.job_id,
            stage_id: stage.production_stage_id,
            impact_level: delayMinutes > 120 ? 'high' : 'medium',
            timestamp: now.toISOString(),
            details: { delay_minutes: delayMinutes },
            auto_resolved: false
          });
        }
      }
    }

    return delays;
  }

  private async detectCapacityChanges(): Promise<ProductionChange[]> {
    // This would typically connect to machine monitoring systems
    // For now, we'll simulate capacity change detection
    return [];
  }

  private async handleNewJobAdded(change: ProductionChange): Promise<RescheduleRecommendation[]> {
    return [{
      id: `rec_${change.id}`,
      change_id: change.id,
      type: 'reorder_jobs',
      affected_jobs: [change.job_id!],
      estimated_impact_hours: -0.5,
      confidence_score: 75,
      reasoning: [
        'New job added to production queue',
        'Recommend prioritizing based on due date',
        'Consider batching opportunities'
      ],
      auto_apply: false
    }];
  }

  private async handleJobExpedited(change: ProductionChange): Promise<RescheduleRecommendation[]> {
    return [{
      id: `rec_${change.id}`,
      change_id: change.id,
      type: 'expedite_job',
      affected_jobs: [change.job_id!],
      estimated_impact_hours: -2,
      confidence_score: 90,
      reasoning: [
        'Job marked as expedited',
        'Move to front of all relevant queues',
        'Notify operators of priority change'
      ],
      auto_apply: true
    }];
  }

  private async handleMachineDown(change: ProductionChange): Promise<RescheduleRecommendation[]> {
    return [{
      id: `rec_${change.id}`,
      change_id: change.id,
      type: 'redistribute_capacity',
      affected_jobs: [],
      estimated_impact_hours: 4,
      confidence_score: 85,
      reasoning: [
        'Machine downtime detected',
        'Redistribute jobs to available machines',
        'Consider overtime if critical deadlines at risk'
      ],
      auto_apply: false
    }];
  }

  private async handleDelayReported(change: ProductionChange): Promise<RescheduleRecommendation[]> {
    return [{
      id: `rec_${change.id}`,
      change_id: change.id,
      type: 'reorder_jobs',
      affected_jobs: [change.job_id!],
      estimated_impact_hours: 1,
      confidence_score: 70,
      reasoning: [
        `Stage delay of ${change.details.delay_minutes} minutes detected`,
        'Adjust downstream scheduling',
        'Consider parallel processing where possible'
      ],
      auto_apply: false
    }];
  }

  private async handleCapacityChange(change: ProductionChange): Promise<RescheduleRecommendation[]> {
    return [{
      id: `rec_${change.id}`,
      change_id: change.id,
      type: 'redistribute_capacity',
      affected_jobs: [],
      estimated_impact_hours: -1,
      confidence_score: 80,
      reasoning: [
        'Capacity change detected',
        'Optimize job distribution across available resources',
        'Update scheduling algorithms'
      ],
      auto_apply: true
    }];
  }

  private detectResourceOverallocation(queues: any[]): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = [];

    for (const queue of queues) {
      if (queue.current_load > queue.total_capacity * 1.2) {
        conflicts.push({
          id: `overalloc_${queue.id}`,
          type: 'resource_overallocation',
          severity: 'error',
          affected_jobs: queue.jobs.map((job: any) => job.job_id),
          resolution_suggestions: [
            'Move jobs to less loaded stages',
            'Consider overtime scheduling',
            'Implement parallel processing'
          ],
          estimated_delay_hours: Math.ceil((queue.current_load - queue.total_capacity) / 8)
        });
      }
    }

    return conflicts;
  }

  private async detectDeadlineMisses(queues: any[]): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];
    const now = new Date();

    for (const queue of queues) {
      for (const job of queue.jobs) {
        const dueDate = new Date(job.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const estimatedDaysToComplete = Math.ceil(queue.estimated_completion_hours / 8);

        if (estimatedDaysToComplete > daysUntilDue) {
          conflicts.push({
            id: `deadline_${job.job_id}`,
            type: 'deadline_miss',
            severity: daysUntilDue < 0 ? 'critical' : 'warning',
            affected_jobs: [job.job_id],
            resolution_suggestions: [
              'Expedite this job',
              'Allocate additional resources',
              'Negotiate deadline extension'
            ],
            estimated_delay_hours: (estimatedDaysToComplete - daysUntilDue) * 8
          });
        }
      }
    }

    return conflicts;
  }

  private detectCapacityExceeded(queues: any[]): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = [];

    for (const queue of queues) {
      if (queue.bottleneck_risk === 'high') {
        conflicts.push({
          id: `capacity_${queue.id}`,
          type: 'capacity_exceeded',
          severity: 'warning',
          affected_jobs: queue.jobs.map((job: any) => job.job_id),
          resolution_suggestions: [
            'Implement batch processing',
            'Optimize job sequences',
            'Consider additional shifts'
          ],
          estimated_delay_hours: Math.ceil(queue.current_load * 0.2)
        });
      }
    }

    return conflicts;
  }

  private async generateConflictResolution(conflict: ScheduleConflict): Promise<RescheduleRecommendation[]> {
    return [{
      id: `conflict_res_${conflict.id}`,
      change_id: conflict.id,
      type: 'reorder_jobs',
      affected_jobs: conflict.affected_jobs,
      estimated_impact_hours: -conflict.estimated_delay_hours * 0.7,
      confidence_score: 75,
      reasoning: [
        `Resolving ${conflict.type}`,
        ...conflict.resolution_suggestions
      ],
      auto_apply: false
    }];
  }

  private async generateOptimizationRecommendations(queues: any[]): Promise<RescheduleRecommendation[]> {
    const recommendations: RescheduleRecommendation[] = [];

    // Look for batching opportunities
    for (const queue of queues) {
      if (queue.jobs.length >= 4) {
        const batchSuggestions = await SmartQueueManager.getBatchSuggestions(queue.id, 6);
        
        for (const suggestion of batchSuggestions.slice(0, 2)) {
          recommendations.push({
            id: `batch_opt_${queue.id}_${Date.now()}`,
            change_id: 'optimization',
            type: 'create_batch',
            affected_jobs: suggestion.suggested_jobs.map(job => job.job_id),
            estimated_impact_hours: -suggestion.time_savings_hours,
            confidence_score: suggestion.efficiency_score,
            reasoning: suggestion.reasoning,
            auto_apply: suggestion.efficiency_score >= 85
          });
        }
      }
    }

    return recommendations;
  }

  private assessReschedulingRisk(
    recommendations: RescheduleRecommendation[], 
    conflicts: ScheduleConflict[]
  ): string {
    const criticalConflicts = conflicts.filter(c => c.severity === 'critical').length;
    const highConfidenceRecs = recommendations.filter(r => r.confidence_score >= 80).length;
    const totalImpact = Math.abs(recommendations.reduce((sum, r) => sum + r.estimated_impact_hours, 0));

    if (criticalConflicts > 0) return 'High Risk - Critical conflicts detected';
    if (totalImpact > 10) return 'Medium Risk - Significant schedule changes required';
    if (highConfidenceRecs / recommendations.length > 0.8) return 'Low Risk - High confidence recommendations';
    
    return 'Medium Risk - Mixed confidence levels';
  }

  private async applyRecommendation(recommendation: RescheduleRecommendation): Promise<void> {
    console.log('🤖 Auto-applying recommendation:', recommendation.type);
    
    try {
      switch (recommendation.type) {
        case 'expedite_job':
          // Auto-expedite the job
          if (recommendation.affected_jobs.length > 0) {
            await supabase
              .from('production_jobs')
              .update({ 
                is_expedited: true,
                expedited_at: new Date().toISOString(),
                expedite_reason: 'Auto-expedited by dynamic rescheduling'
              })
              .in('id', recommendation.affected_jobs);
          }
          break;
          
        case 'reorder_jobs':
          // This would integrate with the existing job ordering system
          console.log('Auto-reordering jobs:', recommendation.affected_jobs);
          break;
          
        default:
          console.log('Auto-apply not implemented for:', recommendation.type);
      }
    } catch (error) {
      console.error('❌ Error auto-applying recommendation:', error);
    }
  }
}