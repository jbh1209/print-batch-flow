/**
 * **PHASE 1: TIMEZONE DISPLAY AUDIT & STANDARDIZATION**
 * Enforces consistent timezone handling across the application
 */

import { toSAST, formatSAST, getCurrentSAST } from './timezone';

/**
 * STANDARD PATTERN 1: Database UTC to Display SAST
 * Use this instead of toLocaleString() or manual conversions
 */
export const dbTimeToDisplayTime = (utcString: string | null): string => {
  if (!utcString) return '--:--';
  
  // Database stores UTC, convert to SAST for display
  const sastDate = toSAST(new Date(utcString));
  return formatSAST(sastDate, 'HH:mm');
};

/**
 * STANDARD PATTERN 2: Database UTC to Full Display
 */
export const dbTimeToFullDisplay = (utcString: string | null): string => {
  if (!utcString) return 'Not scheduled';
  
  const sastDate = toSAST(new Date(utcString));
  return formatSAST(sastDate, 'MMM dd HH:mm');
};

/**
 * VALIDATION: Test timezone display consistency
 * CRITICAL: This must pass before proceeding to Phase 2
 */
export const validateTimezoneDisplay = (): { 
  passed: boolean; 
  errors: string[]; 
  results: { test: string; expected: string; actual: string; pass: boolean }[];
} => {
  const errors: string[] = [];
  const results: { test: string; expected: string; actual: string; pass: boolean }[] = [];
  
  // Test case 1: Job scheduled at 06:00 SAST should display as "06:00"
  const test1Utc = "2024-01-15T04:00:00.000Z"; // 06:00 SAST in UTC
  const test1Result = dbTimeToDisplayTime(test1Utc);
  const test1Pass = test1Result === "06:00";
  results.push({
    test: "06:00 SAST display",
    expected: "06:00",
    actual: test1Result,
    pass: test1Pass
  });
  if (!test1Pass) errors.push(`Expected 06:00, got ${test1Result}`);
  
  // Test case 2: Job scheduled at 08:00 SAST should display as "08:00"
  const test2Utc = "2024-01-15T06:00:00.000Z"; // 08:00 SAST in UTC
  const test2Result = dbTimeToDisplayTime(test2Utc);
  const test2Pass = test2Result === "08:00";
  results.push({
    test: "08:00 SAST display",
    expected: "08:00", 
    actual: test2Result,
    pass: test2Pass
  });
  if (!test2Pass) errors.push(`Expected 08:00, got ${test2Result}`);
  
  // Test case 3: Job scheduled at 17:30 SAST should display as "17:30"
  const test3Utc = "2024-01-15T15:30:00.000Z"; // 17:30 SAST in UTC  
  const test3Result = dbTimeToDisplayTime(test3Utc);
  const test3Pass = test3Result === "17:30";
  results.push({
    test: "17:30 SAST display",
    expected: "17:30",
    actual: test3Result,
    pass: test3Pass
  });
  if (!test3Pass) errors.push(`Expected 17:30, got ${test3Result}`);
  
  // Test case 4: Null handling
  const test4Result = dbTimeToDisplayTime(null);
  const test4Pass = test4Result === "--:--";
  results.push({
    test: "Null time handling",
    expected: "--:--",
    actual: test4Result,
    pass: test4Pass
  });
  if (!test4Pass) errors.push(`Expected --:--, got ${test4Result}`);
  
  return {
    passed: errors.length === 0,
    errors,
    results
  };
};

/**
 * DEBUG HELPER: Add this to components showing wrong times
 */
export const debugTimezoneConversion = (utcString: string, componentName: string) => {
  const original = new Date(utcString);
  const converted = toSAST(original);
  const formatted = formatSAST(converted, 'HH:mm');
  
  console.log(`[${componentName}] Timezone Debug:`, {
    originalUTC: original.toISOString(),
    convertedSAST: converted.toISOString(),
    displayFormatted: formatted,
    expectedSASTHour: original.getUTCHours() + 2 // UTC+2 for SAST
  });
  
  return formatted;
};

/**
 * PHASE 1 TEST RUNNER
 * MANDATORY: Must pass before proceeding to Phase 2
 */
export const runPhase1Tests = (): { passed: number; failed: number; errors: string[] } => {
  console.log('🔍 **PHASE 1: UI TIMEZONE DISPLAY TESTS**');
  console.log('-'.repeat(50));
  
  const validation = validateTimezoneDisplay();
  
  console.log('📊 Test Results:');
  validation.results.forEach(result => {
    const status = result.pass ? '✅' : '❌';
    console.log(`${status} ${result.test}: expected "${result.expected}", got "${result.actual}"`);
  });
  
  const passed = validation.results.filter(r => r.pass).length;
  const failed = validation.results.filter(r => !r.pass).length;
  
  console.log(`\n📈 Phase 1 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('🚨 PHASE 1 FAILED - STOPPING EXECUTION');
    console.log('❌ Errors:', validation.errors);
    console.log('⚠️  Cannot proceed to Phase 2 until timezone display is fixed');
  } else {
    console.log('✅ PHASE 1 PASSED - Ready for Phase 2');
  }
  
  return {
    passed,
    failed, 
    errors: validation.errors
  };
};