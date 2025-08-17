/**
 * Stage processing logic for production scheduling
 */

import { ScheduledStage, WorkingDayContainer } from './types';
import { DEFAULT_CAPACITY, calculateDayTimeSlots, calculateStageTimeSlot } from './timeCalculator';

/**
 * Schedule a single stage into available working days
 */
export function scheduleStageIntoWorkingDays(
  stage: Omit<ScheduledStage, 'scheduled_start_at' | 'scheduled_end_at'>,
  workingDays: WorkingDayContainer[]
): ScheduledStage | null {
  for (const day of workingDays) {
    // Calculate available time slots for this day
    const dayDate = new Date(day.date);
    const timeSlots = calculateDayTimeSlots(dayDate, DEFAULT_CAPACITY);
    
    // Try to fit the stage in this day
    const stageTimeSlot = calculateStageTimeSlot(
      timeSlots,
      day.used_minutes,
      stage.estimated_duration_minutes
    );
    
    if (stageTimeSlot) {
      // Stage fits entirely in this day
      const scheduledStage: ScheduledStage = {
        ...stage,
        scheduled_start_at: stageTimeSlot.start,
        scheduled_end_at: stageTimeSlot.end
      };
      
      // Update day capacity
      day.used_minutes += stage.estimated_duration_minutes;
      day.remaining_minutes -= stage.estimated_duration_minutes;
      day.scheduled_stages.push(scheduledStage);
      
      return scheduledStage;
    }
    
    // If stage doesn't fit entirely, check if we can split it
    if (day.remaining_minutes > 0) {
      // Split the stage: schedule partial duration in this day
      const partialDuration = day.remaining_minutes;
      const remainingDuration = stage.estimated_duration_minutes - partialDuration;
      
      const partialTimeSlot = calculateStageTimeSlot(
        timeSlots,
        day.used_minutes,
        partialDuration
      );
      
      if (partialTimeSlot) {
        // Schedule first part in this day
        const partialStage: ScheduledStage = {
          ...stage,
          id: `${stage.id}_part1`,
          estimated_duration_minutes: partialDuration,
          scheduled_start_at: partialTimeSlot.start,
          scheduled_end_at: partialTimeSlot.end
        };
        
        day.used_minutes += partialDuration;
        day.remaining_minutes = 0;
        day.scheduled_stages.push(partialStage);
        
        // Schedule remaining part in next available day
        const remainingStage = {
          ...stage,
          id: `${stage.id}_part2`,
          estimated_duration_minutes: remainingDuration
        };
        
        const nextDayIndex = workingDays.indexOf(day) + 1;
        if (nextDayIndex < workingDays.length) {
          const remainingScheduled = scheduleStageIntoWorkingDays(
            remainingStage,
            workingDays.slice(nextDayIndex)
          );
          
          if (remainingScheduled) {
            return partialStage; // Return the first part as primary reference
          }
        }
      }
    }
  }
  
  return null; // Could not schedule the stage
}

/**
 * Process all stages in FIFO order
 */
export function processStagesSequentially(
  stages: Omit<ScheduledStage, 'scheduled_start_at' | 'scheduled_end_at'>[],
  workingDays: WorkingDayContainer[]
): ScheduledStage[] {
  const scheduledStages: ScheduledStage[] = [];
  
  // Sort stages by proof approval timestamp (FIFO)
  const sortedStages = [...stages].sort((a, b) => 
    a.proof_approved_at.getTime() - b.proof_approved_at.getTime()
  );
  
  for (const stage of sortedStages) {
    const scheduled = scheduleStageIntoWorkingDays(stage, workingDays);
    if (scheduled) {
      scheduledStages.push(scheduled);
    }
  }
  
  return scheduledStages;
}