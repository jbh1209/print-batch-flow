/**
 * **PHASE 5: PRODUCTION FEATURES**
 * Production-ready scheduling features with comprehensive error handling
 * Built on validated Phase 1-4 foundations
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  getCurrentSAST, 
  getNextValidBusinessTime,
  formatSAST,
  sastToDbTime,
  validateAndNormalizeSchedulingTime 
} from '../timezone';

export interface ProductionSchedulerConfig {
  maxJobsPerStage: number;
  defaultJobDurationMinutes: number;
  bufferTimeMinutes: number;
  autoRescheduleOnConflict: boolean;
  enablePriorityQueue: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface SchedulerStatus {
  isRunning: boolean;
  isPaused: boolean;
  lastRunTime: Date | null;
  totalJobsScheduled: number;
  totalErrors: number;
  currentQueue: number;
}

export interface ProductionJobRequest {
  jobId: string;
  jobTableName: string;
  stageId: string;
  estimatedDurationMinutes: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  earliestStartTime?: Date;
}

export interface SchedulingConflict {
  type: 'time_overlap' | 'capacity_exceeded' | 'dependency_violation';
  message: string;
  conflictingJobId?: string;
  suggestedResolution: string;
}

export interface ProductionSchedulingResult {
  success: boolean;
  jobId: string;
  scheduledStartTime: Date | null;
  scheduledEndTime: Date | null;
  conflicts: SchedulingConflict[];
  errors: string[];
  nextAvailableSlot?: Date;
}

/**
 * **PRODUCTION SCHEDULER ENGINE**
 */
export class ProductionScheduler {
  private config: ProductionSchedulerConfig;
  private status: SchedulerStatus;
  private isInitialized = false;

  constructor(config?: Partial<ProductionSchedulerConfig>) {
    this.config = {
      maxJobsPerStage: 10,
      defaultJobDurationMinutes: 60,
      bufferTimeMinutes: 15,
      autoRescheduleOnConflict: true,
      enablePriorityQueue: true,
      logLevel: 'info',
      ...config
    };

    this.status = {
      isRunning: false,
      isPaused: false,
      lastRunTime: null,
      totalJobsScheduled: 0,
      totalErrors: 0,
      currentQueue: 0
    };
  }

  /**
   * **INITIALIZE SCHEDULER**
   */
  async initialize(): Promise<boolean> {
    try {
      this.log('info', 'Initializing Production Scheduler...');
      
      // Verify database connection
      const { error } = await supabase.from('production_stages').select('id').limit(1);
      if (error) {
        this.log('error', `Database connection failed: ${error.message}`);
        return false;
      }

      this.isInitialized = true;
      this.log('info', 'Production Scheduler initialized successfully');
      return true;
    } catch (error) {
      this.log('error', `Scheduler initialization failed: ${error.message}`);
      return false;
    }
  }

  /**
   * **SCHEDULE SINGLE JOB**
   */
  async scheduleJob(request: ProductionJobRequest): Promise<ProductionSchedulingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result: ProductionSchedulingResult = {
      success: false,
      jobId: request.jobId,
      scheduledStartTime: null,
      scheduledEndTime: null,
      conflicts: [],
      errors: [],
      nextAvailableSlot: undefined
    };

    try {
      this.log('debug', `Scheduling job ${request.jobId} for stage ${request.stageId}`);

      // Step 1: Validate request
      const validation = this.validateJobRequest(request);
      if (!validation.isValid) {
        result.errors.push(...validation.errors);
        return result;
      }

      // Step 2: Find optimal time slot
      const timeSlot = await this.findOptimalTimeSlot(request);
      if (!timeSlot.success) {
        result.errors.push(...timeSlot.errors);
        result.conflicts.push(...timeSlot.conflicts);
        result.nextAvailableSlot = timeSlot.nextAvailableSlot;
        return result;
      }

      // Step 3: Reserve the time slot
      const reservation = await this.reserveTimeSlot(request, timeSlot.startTime!, timeSlot.endTime!);
      if (!reservation.success) {
        result.errors.push(...reservation.errors);
        return result;
      }

      // Step 4: Update job stage instance
      const update = await this.updateJobStageInstance(request, timeSlot.startTime!, timeSlot.endTime!);
      if (!update.success) {
        result.errors.push(...update.errors);
        // Try to rollback the reservation
        await this.rollbackTimeSlot(reservation.reservationId!);
        return result;
      }

      // Success!
      result.success = true;
      result.scheduledStartTime = timeSlot.startTime!;
      result.scheduledEndTime = timeSlot.endTime!;
      
      this.status.totalJobsScheduled++;
      this.status.lastRunTime = getCurrentSAST();
      
      this.log('info', `Successfully scheduled job ${request.jobId} from ${formatSAST(timeSlot.startTime!)} to ${formatSAST(timeSlot.endTime!)}`);

      return result;

    } catch (error) {
      this.status.totalErrors++;
      result.errors.push(`Scheduling failed: ${error.message}`);
      this.log('error', `Job scheduling failed for ${request.jobId}: ${error.message}`);
      return result;
    }
  }

  /**
   * **BATCH SCHEDULE MULTIPLE JOBS**
   */
  async scheduleMultipleJobs(requests: ProductionJobRequest[]): Promise<ProductionSchedulingResult[]> {
    this.log('info', `Batch scheduling ${requests.length} jobs`);
    
    // Sort by priority
    const sortedRequests = this.config.enablePriorityQueue 
      ? this.sortByPriority(requests) 
      : requests;

    const results: ProductionSchedulingResult[] = [];
    
    for (const request of sortedRequests) {
      const result = await this.scheduleJob(request);
      results.push(result);
      
      // If scheduling failed and auto-reschedule is enabled, try to find alternative
      if (!result.success && this.config.autoRescheduleOnConflict && result.nextAvailableSlot) {
        this.log('debug', `Attempting auto-reschedule for job ${request.jobId}`);
        
        const rescheduledRequest = {
          ...request,
          earliestStartTime: result.nextAvailableSlot
        };
        
        const rescheduleResult = await this.scheduleJob(rescheduledRequest);
        if (rescheduleResult.success) {
          results[results.length - 1] = rescheduleResult;
          this.log('info', `Auto-rescheduled job ${request.jobId} successfully`);
        }
      }
    }

    return results;
  }

  /**
   * **PAUSE/RESUME SCHEDULER**
   */
  pauseScheduler(): void {
    this.status.isPaused = true;
    this.log('info', 'Scheduler paused');
  }

  resumeScheduler(): void {
    this.status.isPaused = false;
    this.log('info', 'Scheduler resumed');
  }

  /**
   * **GET SCHEDULER STATUS**
   */
  getStatus(): SchedulerStatus {
    return { ...this.status };
  }

  /**
   * **PRIVATE METHODS**
   */

  private validateJobRequest(request: ProductionJobRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.jobId) errors.push('Job ID is required');
    if (!request.stageId) errors.push('Stage ID is required');
    if (request.estimatedDurationMinutes <= 0) errors.push('Duration must be positive');
    if (request.earliestStartTime && isNaN(request.earliestStartTime.getTime())) {
      errors.push('Invalid earliest start time');
    }

    return { isValid: errors.length === 0, errors };
  }

  private async findOptimalTimeSlot(request: ProductionJobRequest): Promise<{
    success: boolean;
    startTime?: Date;
    endTime?: Date;
    errors: string[];
    conflicts: SchedulingConflict[];
    nextAvailableSlot?: Date;
  }> {
    try {
      // Find the earliest valid start time
      const earliestStart = request.earliestStartTime 
        ? getNextValidBusinessTime(request.earliestStartTime)
        : getNextValidBusinessTime(getCurrentSAST());

      // Check for conflicts in this time slot
      const proposedEnd = new Date(earliestStart.getTime() + (request.estimatedDurationMinutes * 60 * 1000));
      
      const conflicts = await this.checkTimeSlotConflicts(request.stageId, earliestStart, proposedEnd);
      
      if (conflicts.length > 0) {
        // Find next available slot
        const nextSlot = await this.findNextAvailableSlot(request.stageId, request.estimatedDurationMinutes, earliestStart);
        
        return {
          success: false,
          errors: [],
          conflicts: conflicts.map(c => ({
            type: 'time_overlap' as const,
            message: `Time conflict with existing booking`,
            conflictingJobId: c.job_id,
            suggestedResolution: `Reschedule to ${formatSAST(nextSlot)}`
          })),
          nextAvailableSlot: nextSlot
        };
      }

      return {
        success: true,
        startTime: earliestStart,
        endTime: proposedEnd,
        errors: [],
        conflicts: []
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Failed to find time slot: ${error.message}`],
        conflicts: []
      };
    }
  }

  private async checkTimeSlotConflicts(stageId: string, startTime: Date, endTime: Date): Promise<any[]> {
    const startUTC = sastToDbTime(startTime);
    const endUTC = sastToDbTime(endTime);

    const { data, error } = await supabase
      .from('stage_time_slots')
      .select('*')
      .eq('production_stage_id', stageId)
      .or(`and(slot_start_time.lt.${endUTC},slot_end_time.gt.${startUTC})`);

    if (error) {
      throw new Error(`Failed to check conflicts: ${error.message}`);
    }

    return data || [];
  }

  private async findNextAvailableSlot(stageId: string, durationMinutes: number, fromTime: Date): Promise<Date> {
    // Simple implementation - in production this would be more sophisticated
    let currentTime = new Date(fromTime);
    
    while (true) {
      currentTime = getNextValidBusinessTime(currentTime);
      const endTime = new Date(currentTime.getTime() + (durationMinutes * 60 * 1000));
      
      const conflicts = await this.checkTimeSlotConflicts(stageId, currentTime, endTime);
      if (conflicts.length === 0) {
        return currentTime;
      }
      
      // Move to next hour and try again
      currentTime = new Date(currentTime.getTime() + (60 * 60 * 1000));
    }
  }

  private async reserveTimeSlot(request: ProductionJobRequest, startTime: Date, endTime: Date): Promise<{
    success: boolean;
    errors: string[];
    reservationId?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('stage_time_slots')
        .insert({
          production_stage_id: request.stageId,
          slot_start_time: sastToDbTime(startTime),
          slot_end_time: sastToDbTime(endTime),
          duration_minutes: request.estimatedDurationMinutes,
          date: formatSAST(startTime, 'yyyy-MM-dd')
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, errors: [`Failed to reserve time slot: ${error.message}`] };
      }

      return { success: true, errors: [], reservationId: data.id };

    } catch (error) {
      return { success: false, errors: [`Time slot reservation failed: ${error.message}`] };
    }
  }

  private async updateJobStageInstance(request: ProductionJobRequest, startTime: Date, endTime: Date): Promise<{
    success: boolean;
    errors: string[];
  }> {
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          auto_scheduled_start_at: sastToDbTime(startTime),
          auto_scheduled_end_at: sastToDbTime(endTime),
          auto_scheduled_duration_minutes: request.estimatedDurationMinutes,
          schedule_status: 'scheduled'
        })
        .eq('job_id', request.jobId)
        .eq('production_stage_id', request.stageId);

      if (error) {
        return { success: false, errors: [`Failed to update job stage instance: ${error.message}`] };
      }

      return { success: true, errors: [] };

    } catch (error) {
      return { success: false, errors: [`Job stage update failed: ${error.message}`] };
    }
  }

  private async rollbackTimeSlot(reservationId: string): Promise<void> {
    try {
      await supabase.from('stage_time_slots').delete().eq('id', reservationId);
      this.log('debug', `Rolled back time slot reservation ${reservationId}`);
    } catch (error) {
      this.log('error', `Failed to rollback time slot ${reservationId}: ${error.message}`);
    }
  }

  private sortByPriority(requests: ProductionJobRequest[]): ProductionJobRequest[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return [...requests].sort((a, b) => {
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      return aPriority - bPriority;
    });
  }

  private log(level: string, message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];
    
    if (messageLevel >= configLevel) {
      const timestamp = formatSAST(getCurrentSAST(), 'yyyy-MM-dd HH:mm:ss');
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }
}

/**
 * **PRODUCTION SCHEDULER SINGLETON**
 */
export const productionScheduler = new ProductionScheduler();

/**
 * **PHASE 5 TESTING: Production Features**
 */
export function runProductionFeaturesTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function test(name: string, testFn: () => void) {
    try {
      testFn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name}: ${error.message}`);
      errors.push(`${name}: ${error.message}`);
      failed++;
    }
  }

  console.log('🧪 **PHASE 5 TESTING: PRODUCTION FEATURES**');

  // Test 1: Scheduler initialization
  test('ProductionScheduler initializes correctly', () => {
    const scheduler = new ProductionScheduler();
    const status = scheduler.getStatus();
    
    if (status.isRunning !== false) {
      throw new Error('Scheduler should not be running initially');
    }
    
    if (status.totalJobsScheduled !== 0) {
      throw new Error('Initial job count should be zero');
    }
  });

  // Test 2: Job request validation
  test('Job request validation works correctly', () => {
    const scheduler = new ProductionScheduler();
    
    const invalidRequest: ProductionJobRequest = {
      jobId: '',
      jobTableName: 'production_jobs',
      stageId: '',
      estimatedDurationMinutes: -1,
      priority: 'medium',
      dependencies: []
    };
    
    const validation = (scheduler as any).validateJobRequest(invalidRequest);
    
    if (validation.isValid) {
      throw new Error('Should detect invalid job request');
    }
    
    if (validation.errors.length === 0) {
      throw new Error('Should provide validation errors');
    }
  });

  // Test 3: Priority sorting
  test('Priority sorting works correctly', () => {
    const scheduler = new ProductionScheduler();
    
    const requests: ProductionJobRequest[] = [
      { jobId: 'job1', jobTableName: 'production_jobs', stageId: 'stage1', estimatedDurationMinutes: 60, priority: 'low', dependencies: [] },
      { jobId: 'job2', jobTableName: 'production_jobs', stageId: 'stage1', estimatedDurationMinutes: 60, priority: 'critical', dependencies: [] },
      { jobId: 'job3', jobTableName: 'production_jobs', stageId: 'stage1', estimatedDurationMinutes: 60, priority: 'high', dependencies: [] }
    ];
    
    const sorted = (scheduler as any).sortByPriority(requests);
    
    if (sorted[0].priority !== 'critical') {
      throw new Error('Critical jobs should be first');
    }
    
    if (sorted[1].priority !== 'high') {
      throw new Error('High priority jobs should be second');
    }
    
    if (sorted[2].priority !== 'low') {
      throw new Error('Low priority jobs should be last');
    }
  });

  // Test 4: Scheduler pause/resume
  test('Scheduler pause/resume works correctly', () => {
    const scheduler = new ProductionScheduler();
    
    scheduler.pauseScheduler();
    if (!scheduler.getStatus().isPaused) {
      throw new Error('Scheduler should be paused');
    }
    
    scheduler.resumeScheduler();
    if (scheduler.getStatus().isPaused) {
      throw new Error('Scheduler should be resumed');
    }
  });

  console.log(`\n📊 **PHASE 5 TEST RESULTS:**`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log(`\n🚨 **ERRORS:**`);
    errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log(`\n🎉 **PHASE 5 COMPLETE: All production features tests passed!**`);
  }

  return { passed, failed, errors };
}