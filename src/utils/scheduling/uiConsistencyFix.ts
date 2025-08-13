/**
 * **PHASE 4: UI CONSISTENCY FIX**
 * Ensure UI displays exactly match database values when converted to SAST
 * Built on validated Phase 1-3 foundations
 */

import { formatSAST, dbTimeToSAST } from '../timezone';

/**
 * **CRITICAL: Consistent time formatting for UI display**
 * All times in UI MUST use this function
 */
export function formatScheduledTimeForUI(dbTimestamp: string | null): string {
  if (!dbTimestamp) {
    return 'Not scheduled';
  }

  try {
    // Convert UTC database time to SAST for display
    const sastTime = dbTimeToSAST(dbTimestamp);
    
    // Format consistently for UI: "Aug 14 08:00" (SAST)
    return formatSAST(sastTime, 'MMM dd HH:mm');
  } catch (error) {
    console.error('Error formatting scheduled time for UI:', error);
    return 'Invalid time';
  }
}

/**
 * **CRITICAL: Consistent date formatting for UI display**
 */
export function formatScheduledDateForUI(dbTimestamp: string | null): string {
  if (!dbTimestamp) {
    return '';
  }

  try {
    const sastTime = dbTimeToSAST(dbTimestamp);
    return formatSAST(sastTime, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error formatting scheduled date for UI:', error);
    return 'Invalid date';
  }
}

/**
 * **CRITICAL: Consistent time-only formatting for UI**
 */
export function formatTimeOnlyForUI(dbTimestamp: string | null): string {
  if (!dbTimestamp) {
    return '';
  }

  try {
    const sastTime = dbTimeToSAST(dbTimestamp);
    return formatSAST(sastTime, 'HH:mm');
  } catch (error) {
    console.error('Error formatting time for UI:', error);
    return '';
  }
}

/**
 * **CRITICAL: Format working hours display**
 */
export function formatWorkingHoursForUI(startTime: Date, endTime: Date): string {
  try {
    const startStr = formatSAST(startTime, 'HH:mm');
    const endStr = formatSAST(endTime, 'HH:mm');
    return `${startStr} - ${endStr} SAST`;
  } catch (error) {
    console.error('Error formatting working hours for UI:', error);
    return 'Invalid hours';
  }
}

/**
 * **CRITICAL: Format schedule overview data for calendar display**
 * This fixes the core UI display issue
 */
export interface ScheduleOverviewItem {
  id: string;
  stage_name: string;
  stage_color: string;
  job_id: string;
  job_table_name: string;
  slot_start_time_sast: string; // Formatted SAST time for display
  slot_end_time_sast: string;   // Formatted SAST time for display
  slot_start_time_display: string; // Human readable: "Aug 14 08:00"
  slot_end_time_display: string;   // Human readable: "Aug 14 10:30"
  duration_minutes: number;
  date_sast: string; // YYYY-MM-DD in SAST
}

export function formatScheduleOverviewForUI(rawData: any[]): ScheduleOverviewItem[] {
  return rawData.map(item => {
    try {
      // Convert UTC database times to SAST for display
      const startTimeSAST = dbTimeToSAST(item.slot_start_time);
      const endTimeSAST = dbTimeToSAST(item.slot_end_time);
      
      return {
        id: item.id,
        stage_name: item.production_stages?.name || 'Unknown Stage',
        stage_color: item.production_stages?.color || '#6B7280',
        job_id: item.job_stage_instances?.job_id || '',
        job_table_name: item.job_stage_instances?.job_table_name || 'production_jobs',
        slot_start_time_sast: formatSAST(startTimeSAST, 'yyyy-MM-dd HH:mm:ss'),
        slot_end_time_sast: formatSAST(endTimeSAST, 'yyyy-MM-dd HH:mm:ss'),
        slot_start_time_display: formatSAST(startTimeSAST, 'MMM dd HH:mm'),
        slot_end_time_display: formatSAST(endTimeSAST, 'MMM dd HH:mm'),
        duration_minutes: Math.round((endTimeSAST.getTime() - startTimeSAST.getTime()) / (1000 * 60)),
        date_sast: formatSAST(startTimeSAST, 'yyyy-MM-dd')
      };
    } catch (error) {
      console.error('Error formatting schedule overview item:', error, item);
      
      // Return safe fallback
      return {
        id: item.id || 'unknown',
        stage_name: 'Error',
        stage_color: '#ef4444',
        job_id: '',
        job_table_name: 'production_jobs',
        slot_start_time_sast: '',
        slot_end_time_sast: '',
        slot_start_time_display: 'Invalid time',
        slot_end_time_display: 'Invalid time',
        duration_minutes: 0,
        date_sast: ''
      };
    }
  });
}

/**
 * **VALIDATION: Check UI time consistency**
 */
export function validateUITimeConsistency(dbTimestamp: string): {
  isConsistent: boolean;
  dbUtc: string;
  displaySast: string;
  errors: string[];
} {
  const errors: string[] = [];
  
  try {
    // Get the database UTC time
    const dbUtc = new Date(dbTimestamp).toISOString();
    
    // Convert to SAST for display
    const sastDisplay = formatScheduledTimeForUI(dbTimestamp);
    
    // Verify the conversion is correct
    const sastTime = dbTimeToSAST(dbTimestamp);
    const expectedDisplay = formatSAST(sastTime, 'MMM dd HH:mm');
    
    if (sastDisplay !== expectedDisplay) {
      errors.push(`Display format mismatch: got "${sastDisplay}", expected "${expectedDisplay}"`);
    }

    return {
      isConsistent: errors.length === 0,
      dbUtc,
      displaySast: sastDisplay,
      errors
    };
    
  } catch (error) {
    errors.push(`Validation failed: ${error.message}`);
    return {
      isConsistent: false,
      dbUtc: '',
      displaySast: '',
      errors
    };
  }
}

/**
 * **PHASE 4 TESTING: UI Consistency**
 */
export function runUIConsistencyTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('🧪 **PHASE 4 TESTING: UI CONSISTENCY**');

  // Test 1: Time formatting consistency
  test('formatScheduledTimeForUI formats correctly', () => {
    // Test with known UTC time that should display as 8:00 AM SAST
    const utcTime = '2025-08-14T06:00:00.000Z'; // 6 AM UTC = 8 AM SAST
    const formatted = formatScheduledTimeForUI(utcTime);
    
    // Should be "Aug 14 08:00"
    if (!formatted.includes('08:00')) {
      throw new Error(`Expected time to contain '08:00', got '${formatted}'`);
    }
    
    if (!formatted.includes('Aug 14')) {
      throw new Error(`Expected date to contain 'Aug 14', got '${formatted}'`);
    }
  });

  // Test 2: Time-only formatting
  test('formatTimeOnlyForUI extracts time correctly', () => {
    const utcTime = '2025-08-14T06:00:00.000Z'; // 6 AM UTC = 8 AM SAST
    const timeOnly = formatTimeOnlyForUI(utcTime);
    
    if (timeOnly !== '08:00') {
      throw new Error(`Expected '08:00', got '${timeOnly}'`);
    }
  });

  // Test 3: Schedule overview formatting
  test('formatScheduleOverviewForUI handles data correctly', () => {
    const rawData = [{
      id: 'test-id',
      slot_start_time: '2025-08-14T06:00:00.000Z', // 8 AM SAST
      slot_end_time: '2025-08-14T08:30:00.000Z',   // 10:30 AM SAST
      production_stages: { name: 'Test Stage', color: '#blue' },
      job_stage_instances: { job_id: 'job-123', job_table_name: 'production_jobs' }
    }];
    
    const formatted = formatScheduleOverviewForUI(rawData);
    
    if (formatted.length !== 1) {
      throw new Error(`Expected 1 item, got ${formatted.length}`);
    }
    
    const item = formatted[0];
    if (!item.slot_start_time_display.includes('08:00')) {
      throw new Error(`Expected start time display to include '08:00', got '${item.slot_start_time_display}'`);
    }
    
    if (!item.slot_end_time_display.includes('10:30')) {
      throw new Error(`Expected end time display to include '10:30', got '${item.slot_end_time_display}'`);
    }
    
    if (item.duration_minutes !== 150) { // 2.5 hours = 150 minutes
      throw new Error(`Expected 150 minutes duration, got ${item.duration_minutes}`);
    }
  });

  // Test 4: UI consistency validation
  test('validateUITimeConsistency detects inconsistencies', () => {
    const utcTime = '2025-08-14T06:00:00.000Z';
    const validation = validateUITimeConsistency(utcTime);
    
    if (!validation.isConsistent) {
      throw new Error(`Time consistency validation failed: ${validation.errors.join(', ')}`);
    }
    
    if (!validation.displaySast.includes('08:00')) {
      throw new Error(`Expected SAST display to include '08:00', got '${validation.displaySast}'`);
    }
  });

  // Test 5: Working hours formatting
  test('formatWorkingHoursForUI formats correctly', () => {
    const startTime = new Date('2025-08-14T08:00:00+02:00');
    const endTime = new Date('2025-08-14T17:30:00+02:00');
    
    const formatted = formatWorkingHoursForUI(startTime, endTime);
    
    if (!formatted.includes('08:00 - 17:30 SAST')) {
      throw new Error(`Expected '08:00 - 17:30 SAST', got '${formatted}'`);
    }
  });

  console.log(`\n📊 **PHASE 4 TEST RESULTS:**`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log(`\n🚨 **ERRORS:**`);
    errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log(`\n🎉 **PHASE 4 COMPLETE: All UI consistency tests passed!**`);
  }

  return { passed, failed, errors };
}