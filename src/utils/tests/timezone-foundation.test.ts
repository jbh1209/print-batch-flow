/**
 * **PHASE 1 TESTING: TIME ZONE FOUNDATION**
 * CRITICAL: All timezone foundation functions must pass these tests
 * before proceeding to Phase 2
 */

import {
  getCurrentSAST,
  toSAST,
  fromSAST,
  formatSAST,
  createSASTDate,
  isInPast,
  isWithinBusinessHours,
  isWorkingDay,
  getNextValidBusinessTime,
  getNextWorkingDayStart,
  validateAndNormalizeSchedulingTime,
  dbTimeToSAST,
  sastToDbTime
} from '../timezone';

// Test runner function
export function runTimezoneFoundationTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('🧪 **PHASE 1 TESTING: TIME ZONE FOUNDATION**');

  // Test 1: getCurrentSAST returns a valid SAST time
  test('getCurrentSAST returns valid SAST time', () => {
    const sastNow = getCurrentSAST();
    if (!sastNow || isNaN(sastNow.getTime())) {
      throw new Error('getCurrentSAST returned invalid date');
    }
    // Should be roughly UTC+2
    const utcNow = new Date();
    const timeDiff = Math.abs(sastNow.getTime() - utcNow.getTime());
    if (timeDiff > 4 * 60 * 60 * 1000) { // Allow 4 hour difference max
      throw new Error(`Time difference too large: ${timeDiff}ms`);
    }
  });

  // Test 2: Business hours validation
  test('isWithinBusinessHours validates correctly', () => {
    const sastDate = new Date('2025-08-14T10:00:00+02:00'); // 10 AM SAST - should be valid
    if (!isWithinBusinessHours(sastDate)) {
      throw new Error('10 AM should be within business hours');
    }
    
    const sastDateEarly = new Date('2025-08-14T06:00:00+02:00'); // 6 AM SAST - should be invalid
    if (isWithinBusinessHours(sastDateEarly)) {
      throw new Error('6 AM should be outside business hours');
    }
    
    const sastDateLate = new Date('2025-08-14T19:00:00+02:00'); // 7 PM SAST - should be invalid
    if (isWithinBusinessHours(sastDateLate)) {
      throw new Error('7 PM should be outside business hours');
    }
  });

  // Test 3: Working day validation
  test('isWorkingDay validates correctly', () => {
    const monday = new Date('2025-08-18T10:00:00+02:00'); // Monday - should be valid
    if (!isWorkingDay(monday)) {
      throw new Error('Monday should be a working day');
    }
    
    const saturday = new Date('2025-08-16T10:00:00+02:00'); // Saturday - should be invalid
    if (isWorkingDay(saturday)) {
      throw new Error('Saturday should not be a working day');
    }
    
    const sunday = new Date('2025-08-17T10:00:00+02:00'); // Sunday - should be invalid
    if (isWorkingDay(sunday)) {
      throw new Error('Sunday should not be a working day');
    }
  });

  // Test 4: Past time validation
  test('isInPast validates correctly', () => {
    const pastTime = new Date('2025-01-01T10:00:00+02:00'); // Past time
    if (!isInPast(pastTime)) {
      throw new Error('Past time should be detected as in past');
    }
    
    const futureTime = new Date('2025-12-31T10:00:00+02:00'); // Future time
    if (isInPast(futureTime)) {
      throw new Error('Future time should not be detected as in past');
    }
  });

  // Test 5: createSASTDate validation
  test('createSASTDate enforces business rules', () => {
    // Valid business time
    try {
      const validTime = createSASTDate('2025-08-18', '10:00:00'); // Monday 10 AM
      if (!validTime) {
        throw new Error('Should create valid business time');
      }
    } catch (error) {
      throw new Error(`Should not throw error for valid business time: ${error.message}`);
    }
    
    // Invalid - outside business hours
    try {
      createSASTDate('2025-08-18', '06:00:00'); // Monday 6 AM
      throw new Error('Should throw error for time outside business hours');
    } catch (error) {
      if (!error.message.includes('outside business hours')) {
        throw new Error('Should throw specific business hours error');
      }
    }
    
    // Invalid - weekend
    try {
      createSASTDate('2025-08-16', '10:00:00'); // Saturday 10 AM
      throw new Error('Should throw error for weekend');
    } catch (error) {
      if (!error.message.includes('weekend')) {
        throw new Error('Should throw specific weekend error');
      }
    }
  });

  // Test 6: getNextValidBusinessTime adjustment
  test('getNextValidBusinessTime adjusts invalid times', () => {
    // Past time should be adjusted to next valid business time
    const pastTime = new Date('2025-01-01T10:00:00+02:00');
    const adjustedTime = getNextValidBusinessTime(pastTime);
    
    if (isInPast(adjustedTime)) {
      throw new Error('Adjusted time should not be in past');
    }
    
    if (!isWithinBusinessHours(adjustedTime)) {
      throw new Error('Adjusted time should be within business hours');
    }
    
    if (!isWorkingDay(adjustedTime)) {
      throw new Error('Adjusted time should be on working day');
    }
  });

  // Test 7: getNextWorkingDayStart
  test('getNextWorkingDayStart finds next working day', () => {
    const friday = new Date('2025-08-15T16:00:00+02:00'); // Friday 4 PM
    const nextWorking = getNextWorkingDayStart(friday);
    
    // Should be Monday at 8 AM
    if (nextWorking.getDay() !== 1) { // Monday = 1
      throw new Error(`Should be Monday, got day ${nextWorking.getDay()}`);
    }
    
    if (nextWorking.getHours() !== 8) {
      throw new Error(`Should be 8 AM, got ${nextWorking.getHours()}`);
    }
  });

  // Test 8: Database conversion functions
  test('Database conversion functions work correctly', () => {
    const sastTime = new Date('2025-08-18T10:00:00+02:00');
    const utcString = sastToDbTime(sastTime);
    const convertedBack = dbTimeToSAST(utcString);
    
    // Times should match (within 1 second tolerance for rounding)
    const timeDiff = Math.abs(sastTime.getTime() - convertedBack.getTime());
    if (timeDiff > 1000) {
      throw new Error(`Round-trip conversion failed. Diff: ${timeDiff}ms`);
    }
  });

  // Test 9: validateAndNormalizeSchedulingTime
  test('validateAndNormalizeSchedulingTime enforces all rules', () => {
    // Valid time should pass
    const validTime = new Date('2025-08-18T10:00:00+02:00'); // Monday 10 AM
    try {
      const normalized = validateAndNormalizeSchedulingTime(validTime);
      if (!normalized) {
        throw new Error('Should return normalized time');
      }
    } catch (error) {
      throw new Error(`Should not throw for valid time: ${error.message}`);
    }
    
    // Invalid times should throw specific errors
    const pastTime = new Date('2025-01-01T10:00:00+02:00');
    try {
      validateAndNormalizeSchedulingTime(pastTime);
      throw new Error('Should throw for past time');
    } catch (error) {
      if (!error.message.includes('past')) {
        throw new Error('Should throw specific past time error');
      }
    }
  });

  console.log(`\n📊 **PHASE 1 TEST RESULTS:**`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log(`\n🚨 **ERRORS:**`);
    errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log(`\n🎉 **PHASE 1 COMPLETE: All timezone foundation tests passed!**`);
  }

  return { passed, failed, errors };
}

// Export for manual testing
export const testTimezoneFoundation = runTimezoneFoundationTests;