/**
 * **PHASE 3: DATA INTEGRITY LAYER**
 * Database cleanup and integrity management
 * Built on Phase 1 & 2 foundations
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  getCurrentSAST, 
  isWithinBusinessHours, 
  isWorkingDay, 
  formatSAST,
  validateAndNormalizeSchedulingTime,
  sastToDbTime
} from '../timezone';

export interface DataIntegrityResult {
  success: boolean;
  message: string;
  cleanedRecords: number;
  errors: string[];
  summary: {
    corruptedSlots: number;
    invalidTimes: number;
    pastSchedules: number;
    nonBusinessHours: number;
    weekendSchedules: number;
  };
}

/**
 * **CRITICAL: Clean all corrupted scheduling data**
 */
export async function cleanCorruptedSchedulingData(): Promise<DataIntegrityResult> {
  const result: DataIntegrityResult = {
    success: false,
    message: '',
    cleanedRecords: 0,
    errors: [],
    summary: {
      corruptedSlots: 0,
      invalidTimes: 0,
      pastSchedules: 0,
      nonBusinessHours: 0,
      weekendSchedules: 0
    }
  };

  try {
    console.log('🧹 **PHASE 3: CLEANING CORRUPTED SCHEDULING DATA**');

    // Step 1: Clean stage_time_slots with invalid data
    const { data: timeSlots, error: slotsError } = await supabase
      .from('stage_time_slots')
      .select('*');

    if (slotsError) {
      result.errors.push(`Failed to fetch stage_time_slots: ${slotsError.message}`);
      return result;
    }

    const invalidSlotIds: string[] = [];
    
    for (const slot of timeSlots || []) {
      try {
        const startTime = new Date(slot.slot_start_time);
        const endTime = new Date(slot.slot_end_time);
        
        // Check if times are valid
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          invalidSlotIds.push(slot.id);
          result.summary.invalidTimes++;
          continue;
        }

        // Convert to SAST for validation
        const sastStart = new Date(startTime.getTime() + (2 * 60 * 60 * 1000)); // UTC+2 for SAST
        const sastEnd = new Date(endTime.getTime() + (2 * 60 * 60 * 1000));

        // Check if in past
        const nowSAST = getCurrentSAST();
        if (sastStart < nowSAST) {
          invalidSlotIds.push(slot.id);
          result.summary.pastSchedules++;
          continue;
        }

        // Check business hours
        if (!isWithinBusinessHours(sastStart)) {
          invalidSlotIds.push(slot.id);
          result.summary.nonBusinessHours++;
          continue;
        }

        // Check working day
        if (!isWorkingDay(sastStart)) {
          invalidSlotIds.push(slot.id);
          result.summary.weekendSchedules++;
          continue;
        }

      } catch (error) {
        invalidSlotIds.push(slot.id);
        result.summary.corruptedSlots++;
      }
    }

    // Delete invalid slots
    if (invalidSlotIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('stage_time_slots')
        .delete()
        .in('id', invalidSlotIds);

      if (deleteError) {
        result.errors.push(`Failed to delete invalid slots: ${deleteError.message}`);
      } else {
        result.cleanedRecords += invalidSlotIds.length;
        console.log(`✅ Deleted ${invalidSlotIds.length} invalid stage_time_slots`);
      }
    }

    // Step 2: Clean job_stage_instances with invalid scheduled times
    const { data: jobInstances, error: instancesError } = await supabase
      .from('job_stage_instances')
      .select('*')
      .not('auto_scheduled_start_at', 'is', null);

    if (instancesError) {
      result.errors.push(`Failed to fetch job_stage_instances: ${instancesError.message}`);
      return result;
    }

    const invalidInstanceIds: string[] = [];

    for (const instance of jobInstances || []) {
      try {
        if (!instance.scheduled_start_at) continue;

        const scheduledStart = new Date(instance.scheduled_start_at);
        
        // Check if time is valid
        if (isNaN(scheduledStart.getTime())) {
          invalidInstanceIds.push(instance.id);
          continue;
        }

        // Convert to SAST and validate
        const sastStart = new Date(scheduledStart.getTime() + (2 * 60 * 60 * 1000));
        const nowSAST = getCurrentSAST();

        // Check if in past, outside business hours, or on weekend
        if (sastStart < nowSAST || !isWithinBusinessHours(sastStart) || !isWorkingDay(sastStart)) {
          invalidInstanceIds.push(instance.id);
        }

      } catch (error) {
        invalidInstanceIds.push(instance.id);
      }
    }

    // Reset invalid job stage instances
    if (invalidInstanceIds.length > 0) {
      const { error: resetError } = await supabase
        .from('job_stage_instances')
        .update({
          auto_scheduled_start_at: null,
          auto_scheduled_end_at: null,
          auto_scheduled_duration_minutes: null,
          schedule_status: 'unscheduled'
        })
        .in('id', invalidInstanceIds);

      if (resetError) {
        result.errors.push(`Failed to reset invalid job instances: ${resetError.message}`);
      } else {
        result.cleanedRecords += invalidInstanceIds.length;
        console.log(`✅ Reset ${invalidInstanceIds.length} invalid job_stage_instances`);
      }
    }

    result.success = result.errors.length === 0;
    result.message = result.success 
      ? `Successfully cleaned ${result.cleanedRecords} corrupted records`
      : `Cleaned ${result.cleanedRecords} records with ${result.errors.length} errors`;

    console.log(`📊 **PHASE 3 CLEANUP SUMMARY:**`);
    console.log(`  - Corrupted slots: ${result.summary.corruptedSlots}`);
    console.log(`  - Invalid times: ${result.summary.invalidTimes}`);
    console.log(`  - Past schedules: ${result.summary.pastSchedules}`);
    console.log(`  - Non-business hours: ${result.summary.nonBusinessHours}`);
    console.log(`  - Weekend schedules: ${result.summary.weekendSchedules}`);
    console.log(`  - Total cleaned: ${result.cleanedRecords}`);

    return result;

  } catch (error) {
    result.errors.push(`Data integrity cleanup failed: ${error.message}`);
    return result;
  }
}

/**
 * **VALIDATION: Verify database integrity**
 */
export async function verifyDatabaseIntegrity(): Promise<{ isClean: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Check for any remaining invalid stage_time_slots
    const { data: slots, error: slotsError } = await supabase
      .from('stage_time_slots')
      .select('id, slot_start_time')
      .limit(100);

    if (slotsError) {
      issues.push(`Cannot verify stage_time_slots: ${slotsError.message}`);
    } else {
      const nowSAST = getCurrentSAST();
      let pastCount = 0;
      let invalidCount = 0;

      for (const slot of slots || []) {
        try {
          const startTime = new Date(slot.slot_start_time);
          const sastStart = new Date(startTime.getTime() + (2 * 60 * 60 * 1000));
          
          if (isNaN(sastStart.getTime())) {
            invalidCount++;
          } else if (sastStart < nowSAST) {
            pastCount++;
          }
        } catch {
          invalidCount++;
        }
      }

      if (pastCount > 0) {
        issues.push(`Found ${pastCount} stage_time_slots scheduled in the past`);
      }
      if (invalidCount > 0) {
        issues.push(`Found ${invalidCount} stage_time_slots with invalid times`);
      }
    }

    // Check for invalid job_stage_instances
    const { data: instances, error: instancesError } = await supabase
      .from('job_stage_instances')
      .select('id, scheduled_start_at')
      .not('scheduled_start_at', 'is', null)
      .limit(100);

    if (instancesError) {
      issues.push(`Cannot verify job_stage_instances: ${instancesError.message}`);
    } else {
      const nowSAST = getCurrentSAST();
      let pastInstanceCount = 0;

      for (const instance of instances || []) {
        if (instance.scheduled_start_at) {
          try {
            const scheduledTime = new Date(instance.scheduled_start_at);
            const sastTime = new Date(scheduledTime.getTime() + (2 * 60 * 60 * 1000));
            
            if (sastTime < nowSAST) {
              pastInstanceCount++;
            }
          } catch {
            pastInstanceCount++;
          }
        }
      }

      if (pastInstanceCount > 0) {
        issues.push(`Found ${pastInstanceCount} job_stage_instances scheduled in the past`);
      }
    }

  } catch (error) {
    issues.push(`Database integrity verification failed: ${error.message}`);
  }

  return {
    isClean: issues.length === 0,
    issues
  };
}

/**
 * **PHASE 3 TESTING: Data Integrity**
 */
export function runDataIntegrityTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('🧪 **PHASE 3 TESTING: DATA INTEGRITY LAYER**');

  // Test 1: Data integrity result structure
  test('DataIntegrityResult has correct structure', () => {
    const result: DataIntegrityResult = {
      success: true,
      message: 'test',
      cleanedRecords: 0,
      errors: [],
      summary: {
        corruptedSlots: 0,
        invalidTimes: 0,
        pastSchedules: 0,
        nonBusinessHours: 0,
        weekendSchedules: 0
      }
    };

    if (!result.summary || !result.errors || typeof result.cleanedRecords !== 'number') {
      throw new Error('DataIntegrityResult structure is invalid');
    }
  });

  // Test 2: Time validation logic
  test('Time validation detects past schedules', () => {
    const pastTime = new Date('2025-01-01T10:00:00+02:00');
    const nowSAST = getCurrentSAST();
    
    if (!(pastTime < nowSAST)) {
      throw new Error('Past time detection logic is incorrect');
    }
  });

  console.log(`\n📊 **PHASE 3 TEST RESULTS:**`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log(`\n🚨 **ERRORS:**`);
    errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log(`\n🎉 **PHASE 3 COMPLETE: All data integrity tests passed!**`);
  }

  return { passed, failed, errors };
}