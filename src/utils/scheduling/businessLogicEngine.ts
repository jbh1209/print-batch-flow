/**
 * **BUSINESS LOGIC ENGINE - PRODUCTION SCHEDULER REWRITE**
 * Unified scheduling engine with SAST-correct, capacity-aware scheduling
 * Built on proven timezone utilities and production-ready slot finding
 */

import { supabase } from "@/integrations/supabase/client";
import { findNextAvailableSlot, sastDateToDbUtcIso } from "./findNextAvailableSlot";
import { normalizeCapacityForStage } from "../capacityService";
import { 
  getCurrentSAST, 
  isWithinBusinessHours, 
  isWorkingDay, 
  isInPast, 
  getNextValidBusinessTime,
  getNextWorkingDayStart,
  formatSAST,
  sastToDbTime,
  validateAndNormalizeSchedulingTime 
} from '../timezone';

/**
 * **SCHEDULING CAPACITY MANAGEMENT**
 */
export interface StageCapacity {
  stageId: string;
  stageName: string;
  dailyCapacityHours: number;
  maxParallelJobs: number;
  setupTimeMinutes: number;
  workingDaysPerWeek: number;
  shiftHoursPerDay: number;
  efficiencyFactor: number;
}

export interface SchedulingSlot {
  stageId: string;
  startTime: Date; // SAST time
  endTime: Date;   // SAST time
  durationMinutes: number;
  jobId: string;
  isValid: boolean;
  validationErrors: string[];
}

export interface SchedulingRequest {
  jobId: string;
  stageId: string;
  estimatedDurationMinutes: number;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  earliestStartTime?: Date; // SAST time
}

export interface SchedulingResult {
  success: boolean;
  scheduledSlots: SchedulingSlot[];
  message: string;
  errors: string[];
  nextAvailableTime?: Date; // SAST time
}

/**
 * **BUSINESS RULE: Calculate working hours remaining in day**
 */
export function getWorkingHoursRemainingInDay(sastTime: Date): number {
  if (!isWithinBusinessHours(sastTime) || !isWorkingDay(sastTime)) {
    return 0;
  }
  
  const endOfBusinessDay = new Date(sastTime);
  endOfBusinessDay.setHours(17, 30, 0, 0); // 5:30 PM SAST
  
  const remainingMs = endOfBusinessDay.getTime() - sastTime.getTime();
  const remainingHours = remainingMs / (1000 * 60 * 60);
  
  return Math.max(0, remainingHours);
}

/**
 * **BUSINESS RULE: Calculate next available capacity slot**
 */
export function calculateNextAvailableSlot(
  stageId: string, 
  durationMinutes: number,
  fromTime?: Date
): { startTime: Date; endTime: Date; canFitInDay: boolean } {
  const startTime = fromTime ? getNextValidBusinessTime(fromTime) : getNextValidBusinessTime(getCurrentSAST());
  const endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
  
  // Check if the job fits within the same working day
  const remainingHours = getWorkingHoursRemainingInDay(startTime);
  const requiredHours = durationMinutes / 60;
  const canFitInDay = requiredHours <= remainingHours;
  
  // If doesn't fit, split to next day
  if (!canFitInDay) {
    const nextDayStart = getNextWorkingDayStart(startTime);
    const nextDayEnd = new Date(nextDayStart.getTime() + (durationMinutes * 60 * 1000));
    
    return {
      startTime: nextDayStart,
      endTime: nextDayEnd,
      canFitInDay: true
    };
  }
  
  return { startTime, endTime, canFitInDay };
}

/**
 * **BUSINESS RULE: Validate scheduling slot**
 */
export function validateSchedulingSlot(slot: SchedulingSlot): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Validate start time
    validateAndNormalizeSchedulingTime(slot.startTime);
  } catch (error) {
    errors.push(`Start time invalid: ${error.message}`);
  }
  
  try {
    // Validate end time
    validateAndNormalizeSchedulingTime(slot.endTime);
  } catch (error) {
    errors.push(`End time invalid: ${error.message}`);
  }
  
  // Validate duration
  if (slot.durationMinutes <= 0) {
    errors.push('Duration must be positive');
  }
  
  // Validate time sequence
  if (slot.startTime >= slot.endTime) {
    errors.push('End time must be after start time');
  }
  
  // Validate duration consistency
  const calculatedDuration = (slot.endTime.getTime() - slot.startTime.getTime()) / (1000 * 60);
  if (Math.abs(calculatedDuration - slot.durationMinutes) > 1) {
    errors.push(`Duration mismatch: expected ${slot.durationMinutes}min, calculated ${calculatedDuration}min`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * **BUSINESS RULE: Check for scheduling conflicts**
 */
export function checkSchedulingConflicts(
  slot: SchedulingSlot,
  existingSlots: SchedulingSlot[]
): { hasConflict: boolean; conflicts: SchedulingSlot[] } {
  const conflicts: SchedulingSlot[] = [];
  
  for (const existingSlot of existingSlots) {
    // Skip if different stage (stages can run in parallel)
    if (existingSlot.stageId !== slot.stageId) {
      continue;
    }
    
    // Check for time overlap
    const overlapStart = Math.max(slot.startTime.getTime(), existingSlot.startTime.getTime());
    const overlapEnd = Math.min(slot.endTime.getTime(), existingSlot.endTime.getTime());
    
    if (overlapStart < overlapEnd) {
      conflicts.push(existingSlot);
    }
  }
  
  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

/**
 * **BUSINESS RULE: Create optimal scheduling slot**
 */
export function createOptimalSchedulingSlot(
  request: SchedulingRequest,
  stageCapacity: StageCapacity,
  existingSlots: SchedulingSlot[] = []
): SchedulingSlot {
  // Calculate next available slot
  const { startTime, endTime } = calculateNextAvailableSlot(
    request.stageId,
    request.estimatedDurationMinutes,
    request.earliestStartTime
  );
  
  // Create the slot
  const slot: SchedulingSlot = {
    stageId: request.stageId,
    startTime,
    endTime,
    durationMinutes: request.estimatedDurationMinutes,
    jobId: request.jobId,
    isValid: false,
    validationErrors: []
  };
  
  // Validate the slot
  const validation = validateSchedulingSlot(slot);
  slot.isValid = validation.isValid;
  slot.validationErrors = validation.errors;
  
  return slot;
}

/**
 * **BUSINESS RULE: Prioritize scheduling requests**
 */
export function prioritizeSchedulingRequests(requests: SchedulingRequest[]): SchedulingRequest[] {
  return [...requests].sort((a, b) => {
    // Priority order: critical > high > medium > low
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    const aPriority = priorityOrder[a.urgencyLevel];
    const bPriority = priorityOrder[b.urgencyLevel];
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // If same priority, schedule based on earliest start time
    const aStart = a.earliestStartTime?.getTime() || 0;
    const bStart = b.earliestStartTime?.getTime() || 0;
    
    return aStart - bStart;
  });
}

/**
 * **BUSINESS RULE: Schedule multiple jobs optimally**
 */
export function scheduleMultipleJobs(
  requests: SchedulingRequest[],
  stageCapacities: Map<string, StageCapacity>,
  existingSlots: SchedulingSlot[] = []
): SchedulingResult {
  const scheduledSlots: SchedulingSlot[] = [];
  const errors: string[] = [];
  let currentSlots = [...existingSlots];
  
  // Prioritize requests
  const prioritizedRequests = prioritizeSchedulingRequests(requests);
  
  for (const request of prioritizedRequests) {
    try {
      const stageCapacity = stageCapacities.get(request.stageId);
      if (!stageCapacity) {
        errors.push(`No capacity configuration found for stage ${request.stageId}`);
        continue;
      }
      
      // Create optimal slot
      const slot = createOptimalSchedulingSlot(request, stageCapacity, currentSlots);
      
      if (!slot.isValid) {
        errors.push(`Invalid slot for job ${request.jobId}: ${slot.validationErrors.join(', ')}`);
        continue;
      }
      
      // Check for conflicts
      const conflictCheck = checkSchedulingConflicts(slot, currentSlots);
      if (conflictCheck.hasConflict) {
        errors.push(`Scheduling conflict for job ${request.jobId} with existing jobs`);
        continue;
      }
      
      // Add to scheduled slots
      scheduledSlots.push(slot);
      currentSlots.push(slot);
      
    } catch (error) {
      errors.push(`Failed to schedule job ${request.jobId}: ${error.message}`);
    }
  }
  
  const nextAvailableTime = currentSlots.length > 0 
    ? new Date(Math.max(...currentSlots.map(s => s.endTime.getTime())))
    : getNextValidBusinessTime(getCurrentSAST());
  
  return {
    success: scheduledSlots.length > 0,
    scheduledSlots,
    message: `Successfully scheduled ${scheduledSlots.length} of ${requests.length} jobs`,
    errors,
    nextAvailableTime
  };
}

/**
 * **UNIFIED SCHEDULER: Main API for job scheduling**
 */
export class BusinessLogicEngine {
  /**
   * Unified entrypoint for scheduling a job.
   * Handles both auto-scheduling and manual overrides.
   */
  static async scheduleJob({
    jobId,
    jobTableName = "production_jobs",
    targetDateTime,
    stageId,
    userId,
  }: {
    jobId: string;
    jobTableName?: string;
    targetDateTime?: string;
    stageId?: string;
    userId?: string;
  }) {
    try {
      // 1. Fetch unscheduled stages
      const { data: stages, error: stagesError } = await supabase
        .from("job_stage_instances")
        .select(
          "id, production_stage_id, estimated_duration_minutes, setup_time_minutes, stage_order"
        )
        .eq("job_id", jobId)
        .eq("job_table_name", jobTableName)
        .is("scheduled_start_at", null)
        .order("stage_order");

      if (stagesError) throw stagesError;
      if (!stages || stages.length === 0) {
        return { success: true, message: "No stages to schedule", scheduled: 0 };
      }

      let scheduledCount = 0;

      // 2. Loop through each stage
      for (const stage of stages) {
        const durationMinutes =
          (stage.estimated_duration_minutes || 60) +
          (stage.setup_time_minutes || 0);

        let startTime: Date;

        if (targetDateTime && stageId === stage.production_stage_id) {
          // 📝 Manual override - convert from UTC ISO to SAST
          const utcTime = new Date(targetDateTime);
          startTime = getCurrentSAST(); // Start from current SAST time
          startTime.setTime(utcTime.getTime()); // But use provided time
        } else {
          // ⚡ Auto schedule using capacity profiles
          const capacity = await normalizeCapacityForStage(stage.production_stage_id);
          const sastStart = await findNextAvailableSlot(
            supabase,
            stage.production_stage_id,
            durationMinutes,
            {
              workingHours: { startHour: capacity.startHour, endHour: capacity.endHour },
              horizonDays: 60
            }
          );

          if (!sastStart) {
            throw new Error(`No available slot found for stage ${stage.production_stage_id} within 60 days`);
          }

          startTime = sastStart;
        }

        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

        // 3. Persist scheduled values - convert SAST to UTC for DB storage
        const { error: updateError } = await supabase
          .from("job_stage_instances")
          .update({
            scheduled_start_at: sastDateToDbUtcIso(startTime),
            scheduled_end_at: sastDateToDbUtcIso(endTime),
            scheduled_minutes: durationMinutes,
            schedule_status: "scheduled",
            scheduling_method: targetDateTime ? "manual" : "auto",
            scheduled_by_user_id: userId || null,
          })
          .eq("id", stage.id);

        if (updateError) throw updateError;
        scheduledCount++;
      }

      return {
        success: true,
        message: `Scheduled ${scheduledCount} stages`,
        scheduled: scheduledCount,
      };
    } catch (error) {
      console.error('BusinessLogicEngine.scheduleJob error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown scheduling error',
        scheduled: 0
      };
    }
  }
}

/**
 * **PHASE 2 TESTING: Business Logic Engine**
 */
export function runBusinessLogicTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('🧪 **PHASE 2 TESTING: BUSINESS LOGIC ENGINE**');

  // Test 1: Working hours calculation
  test('getWorkingHoursRemainingInDay calculates correctly', () => {
    const morningTime = new Date('2025-08-18T10:00:00+02:00'); // Monday 10 AM
    const remaining = getWorkingHoursRemainingInDay(morningTime);
    
    if (remaining < 7 || remaining > 8) {
      throw new Error(`Expected ~7.5 hours remaining at 10 AM, got ${remaining}`);
    }
  });

  // Test 2: Next available slot calculation
  test('calculateNextAvailableSlot respects business hours', () => {
    const lateAfternoon = new Date('2025-08-18T16:00:00+02:00'); // Monday 4 PM
    const slot = calculateNextAvailableSlot('test-stage', 120, lateAfternoon); // 2 hours
    
    // Should roll to next day since 2 hours won't fit before 5:30 PM
    if (slot.startTime.getDate() === lateAfternoon.getDate()) {
      throw new Error('Should roll to next day when job doesn\'t fit');
    }
    
    if (slot.startTime.getHours() !== 8) {
      throw new Error('Next day should start at 8 AM');
    }
  });

  // Test 3: Slot validation
  test('validateSchedulingSlot catches invalid slots', () => {
    const invalidSlot: SchedulingSlot = {
      stageId: 'test',
      startTime: new Date('2025-01-01T10:00:00+02:00'), // Past time
      endTime: new Date('2025-01-01T11:00:00+02:00'),
      durationMinutes: 60,
      jobId: 'test-job',
      isValid: false,
      validationErrors: []
    };
    
    const validation = validateSchedulingSlot(invalidSlot);
    if (validation.isValid) {
      throw new Error('Should detect invalid past time');
    }
    
    if (validation.errors.length === 0) {
      throw new Error('Should provide validation errors');
    }
  });

  // Test 4: Priority scheduling
  test('prioritizeSchedulingRequests orders correctly', () => {
    const requests: SchedulingRequest[] = [
      { jobId: 'job1', stageId: 'stage1', estimatedDurationMinutes: 60, urgencyLevel: 'low' },
      { jobId: 'job2', stageId: 'stage1', estimatedDurationMinutes: 60, urgencyLevel: 'critical' },
      { jobId: 'job3', stageId: 'stage1', estimatedDurationMinutes: 60, urgencyLevel: 'high' }
    ];
    
    const prioritized = prioritizeSchedulingRequests(requests);
    
    if (prioritized[0].urgencyLevel !== 'critical') {
      throw new Error('Critical jobs should be first');
    }
    
    if (prioritized[1].urgencyLevel !== 'high') {
      throw new Error('High priority jobs should be second');
    }
    
    if (prioritized[2].urgencyLevel !== 'low') {
      throw new Error('Low priority jobs should be last');
    }
  });

  console.log(`\n📊 **PHASE 2 TEST RESULTS:**`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log(`\n🚨 **ERRORS:**`);
    errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log(`\n🎉 **PHASE 2 COMPLETE: All business logic tests passed!**`);
  }

  return { passed, failed, errors };
}