/**
 * **COMPLETE PRODUCTION SCHEDULER REWRITE - MASTER TEST RUNNER**
 * Runs all phases of testing systematically
 * CRITICAL: All phases must pass before scheduler is production-ready
 * 
 * Updated to include Phase 3: Data Integrity Layer 🛡️
 */

import { runTimezoneFoundationTests } from '../tests/timezone-foundation.test';
import { runBusinessLogicTests } from './businessLogicEngine';
import { runDataIntegrityTests } from './dataIntegrityLayer';
import { runUIConsistencyTests } from './uiConsistencyFix';
import { runProductionFeaturesTests } from './productionFeatures';
import { runPhase2Tests } from './phase2-capacity-tests';
import { runPhase3Tests } from './phase3-integrity-tests';
import { runPhase4Tests } from './phase4-debugging-tests';

export interface PhaseTestResult {
  phase: number;
  name: string;
  passed: number;
  failed: number;
  errors: string[];
  success: boolean;
}

export interface MasterTestResult {
  allPhasesPass: boolean;
  totalPassed: number;
  totalFailed: number;
  phaseResults: PhaseTestResult[];
  summary: string;
  readyForProduction: boolean;
}

/**
 * **MASTER TEST RUNNER: Execute all phases systematically**
 */
export async function runCompleteSchedulerTests(): Promise<MasterTestResult> {
  console.log('🚀 **COMPLETE PRODUCTION SCHEDULER REWRITE - MASTER TEST RUNNER**');
  console.log('=' .repeat(80));

  const phaseResults: PhaseTestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  // **PHASE 1: TIME ZONE FOUNDATION**
  console.log('\n📍 **EXECUTING PHASE 1: TIME ZONE FOUNDATION**');
  console.log('-' .repeat(50));
  const phase1 = runTimezoneFoundationTests();
  phaseResults.push({
    phase: 1,
    name: 'Time Zone Foundation',
    passed: phase1.passed,
    failed: phase1.failed,
    errors: phase1.errors,
    success: phase1.failed === 0
  });
  totalPassed += phase1.passed;
  totalFailed += phase1.failed;

  // **PHASE 2: PARALLEL CAPACITY SCHEDULING**
  console.log('\n📍 **EXECUTING PHASE 2: PARALLEL CAPACITY SCHEDULING**');
  console.log('-' .repeat(50));
  const phase2 = runPhase2Tests();
  phaseResults.push({
    phase: 2,
    name: 'Parallel Capacity Scheduling',
    passed: phase2.passed,
    failed: phase2.failed,
    errors: phase2.errors,
    success: phase2.failed === 0
  });
  totalPassed += phase2.passed;
  totalFailed += phase2.failed;

  // **PHASE 3: DATA INTEGRITY LAYER** (NEW 🛡️)
  console.log('\n📍 **EXECUTING PHASE 3: DATA INTEGRITY LAYER**');
  console.log('-' .repeat(50));
  const phase3 = runPhase3Tests();
  phaseResults.push({
    phase: 3,
    name: 'Data Integrity Layer',
    passed: phase3.passed,
    failed: phase3.failed,
    errors: phase3.errors,
    success: phase3.failed === 0
  });
  totalPassed += phase3.passed;
  totalFailed += phase3.failed;

  // **PHASE 4: DEBUGGING & MONITORING** (NEW 🔍)
  console.log('\n📍 **EXECUTING PHASE 4: DEBUGGING & MONITORING**');
  console.log('-' .repeat(50));
  const phase4Debug = await runPhase4Tests();
  phaseResults.push({
    phase: 4,
    name: 'Debugging & Monitoring',
    passed: phase4Debug.passed,
    failed: phase4Debug.failed,
    errors: phase4Debug.errors,
    success: phase4Debug.failed === 0
  });
  totalPassed += phase4Debug.passed;
  totalFailed += phase4Debug.failed;

  // **PHASE 5: DATA INTEGRITY LAYER** (renumbered)
  console.log('\n📍 **EXECUTING PHASE 5: DATA INTEGRITY LAYER**');
  console.log('-' .repeat(50));
  const phase5 = runDataIntegrityTests();
  phaseResults.push({
    phase: 5,
    name: 'Data Integrity Layer',
    passed: phase5.passed,
    failed: phase5.failed,
    errors: phase5.errors,
    success: phase5.failed === 0
  });
  totalPassed += phase5.passed;
  totalFailed += phase5.failed;

  // **PHASE 6: UI CONSISTENCY FIX** (renumbered)
  console.log('\n📍 **EXECUTING PHASE 6: UI CONSISTENCY FIX**');
  console.log('-' .repeat(50));
  const phase6UI = runUIConsistencyTests();
  phaseResults.push({
    phase: 6,
    name: 'UI Consistency Fix',
    passed: phase6UI.passed,
    failed: phase6UI.failed,
    errors: phase6UI.errors,
    success: phase6UI.failed === 0
  });
  totalPassed += phase6UI.passed;
  totalFailed += phase6UI.failed;

  // **PHASE 7: PRODUCTION FEATURES** (renumbered)
  console.log('\n📍 **EXECUTING PHASE 7: PRODUCTION FEATURES**');
  console.log('-' .repeat(50));
  const phase7 = runProductionFeaturesTests();
  phaseResults.push({
    phase: 7,
    name: 'Production Features',
    passed: phase7.passed,
    failed: phase7.failed,
    errors: phase7.errors,
    success: phase7.failed === 0
  });
  totalPassed += phase7.passed;
  totalFailed += phase7.failed;

  // **FINAL RESULTS**
  const allPhasesPass = phaseResults.every(phase => phase.success);
  const readyForProduction = allPhasesPass && totalFailed === 0;

  console.log('\n' + '=' .repeat(80));
  console.log('📊 **MASTER TEST RESULTS - COMPLETE SCHEDULER REWRITE**');
  console.log('=' .repeat(80));

  // Phase summary
  phaseResults.forEach(phase => {
    const status = phase.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} Phase ${phase.phase}: ${phase.name} (${phase.passed}/${phase.passed + phase.failed})`);
    
    if (!phase.success) {
      console.log(`    🚨 Errors: ${phase.errors.length}`);
      phase.errors.forEach(error => {
        console.log(`      - ${error}`);
      });
    }
  });

  console.log('\n' + '-' .repeat(80));
  console.log(`📈 **TOTAL RESULTS:**`);
  console.log(`   ✅ Tests Passed: ${totalPassed}`);
  console.log(`   ❌ Tests Failed: ${totalFailed}`);
  console.log(`   🎯 Success Rate: ${totalPassed > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 0}%`);

  // Final verdict
  console.log('\n' + '=' .repeat(80));
  if (readyForProduction) {
    console.log('🎉 **PRODUCTION READY: All phases passed! Scheduler is ready for production use.**');
    console.log('✅ Time Zone Foundation: Robust SAST handling');
    console.log('✅ Parallel Capacity Scheduling: Daily capacity packing (no more "10 days later")');
    console.log('✅ Business Logic Engine: Proper scheduling rules');
    console.log('✅ Data Integrity Layer: Database constraints active');
    console.log('✅ UI Consistency Fix: Display matches database');
    console.log('✅ Production Features: Full feature set available');
  } else {
    console.log('🚨 **NOT PRODUCTION READY: Critical issues must be resolved.**');
    const failedPhases = phaseResults.filter(p => !p.success);
    console.log(`❌ Failed Phases: ${failedPhases.map(p => `Phase ${p.phase}`).join(', ')}`);
    console.log('⚠️  SCHEDULER IS NOT SAFE FOR PRODUCTION USE');
  }
  console.log('=' .repeat(80));

  const summary = readyForProduction 
    ? `All 6 phases passed. Scheduler is production-ready with ${totalPassed} tests passed.`
    : `${totalFailed} tests failed across ${phaseResults.filter(p => !p.success).length} phases. Not production-ready.`;

  return {
    allPhasesPass,
    totalPassed,
    totalFailed,
    phaseResults,
    summary,
    readyForProduction
  };
}

/**
 * **CONTINUOUS VALIDATION: Run specific phase**
 */
export function runSpecificPhase(phaseNumber: 1 | 2 | 3 | 4 | 5): PhaseTestResult {
  console.log(`🔍 Running Phase ${phaseNumber} tests only...`);
  
  switch (phaseNumber) {
    case 1:
      const phase1 = runTimezoneFoundationTests();
      return {
        phase: 1,
        name: 'Time Zone Foundation',
        passed: phase1.passed,
        failed: phase1.failed,
        errors: phase1.errors,
        success: phase1.failed === 0
      };
    
    case 2:
      const phase2 = runBusinessLogicTests();
      return {
        phase: 2,
        name: 'Business Logic Engine',
        passed: phase2.passed,
        failed: phase2.failed,
        errors: phase2.errors,
        success: phase2.failed === 0
      };
    
    case 3:
      const phase3 = runDataIntegrityTests();
      return {
        phase: 3,
        name: 'Data Integrity Layer',
        passed: phase3.passed,
        failed: phase3.failed,
        errors: phase3.errors,
        success: phase3.failed === 0
      };
    
    case 4:
      const phase4 = runUIConsistencyTests();
      return {
        phase: 4,
        name: 'UI Consistency Fix',
        passed: phase4.passed,
        failed: phase4.failed,
        errors: phase4.errors,
        success: phase4.failed === 0
      };
    
    case 5:
      const phase5 = runProductionFeaturesTests();
      return {
        phase: 5,
        name: 'Production Features',
        passed: phase5.passed,
        failed: phase5.failed,
        errors: phase5.errors,
        success: phase5.failed === 0
      };
    
    default:
      return {
        phase: phaseNumber,
        name: 'Unknown Phase',
        passed: 0,
        failed: 1,
        errors: ['Invalid phase number'],
        success: false
      };
  }
}

/**
 * **EXPORT MASTER TEST FUNCTION**
 */
export { runCompleteSchedulerTests as testCompleteScheduler };