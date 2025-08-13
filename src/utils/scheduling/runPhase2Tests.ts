/**
 * Simple test runner for Phase 2 capacity scheduling tests
 */

import { runPhase2Tests } from './phase2-capacity-tests';

// Auto-run tests when module loads
(async () => {

console.log('🚀 Starting Phase 2 Capacity Scheduling Tests...\n');

try {
  const results = runPhase2Tests();
  
  console.log('\n📊 FINAL PHASE 2 TEST RESULTS:');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`🎯 Success Rate: ${results.passed + results.failed > 0 ? Math.round((results.passed / (results.passed + results.failed)) * 100) : 0}%`);
  
  if (results.errors.length > 0) {
    console.log('\n🚨 ERRORS:');
    results.errors.forEach((error, i) => {
      console.log(`${i + 1}. ${error}`);
    });
  }
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL PHASE 2 TESTS PASSED!');
    console.log('✅ Capacity scheduling logic is working correctly');
    console.log('✅ "10 days later" bug has been fixed');
    console.log('🚀 Ready to proceed to Phase 3');
  } else {
    console.log('\n⚠️  PHASE 2 TESTS FAILED');
    console.log('❌ Capacity scheduling needs fixes');
    console.log('🔧 Review test details above');
  }
  
} catch (error) {
  console.error('❌ Error running Phase 2 tests:', error);
}
})();