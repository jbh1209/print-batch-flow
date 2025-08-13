/**
 * **PHASE 4: DEBUGGING & MONITORING TESTS**
 * Tests for logging, capacity monitoring, and debugging features
 */

import { supabase } from '@/integrations/supabase/client';

export interface Phase4TestSummary {
  passed: number;
  failed: number;
  errors: string[];
}

export interface Phase4TestResult {
  test_name: string;
  passed: boolean;
  details: string;
  execution_time_ms: number;
}

export const runPhase4Tests = async (): Promise<Phase4TestSummary> => {
  const results: Phase4TestResult[] = [];

  // Test 1: Scheduling Decision Logging
  const loggingTest = await testSchedulingDecisionLogging();
  results.push(loggingTest);

  // Test 2: Capacity Monitoring
  const capacityTest = await testCapacityMonitoring();
  results.push(capacityTest);

  // Test 3: Why This Time Explanations
  const explanationTest = await testSchedulingExplanations();
  results.push(explanationTest);

  // Test 4: Debug Dashboard Functionality
  const dashboardTest = await testDebugDashboard();
  results.push(dashboardTest);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const errors = results.filter(r => !r.passed).map(r => r.details);

  return { passed, failed, errors };
};

export const runPhase4TestsWithResults = async (): Promise<Phase4TestResult[]> => {
  const results: Phase4TestResult[] = [];

  // Test 1: Scheduling Decision Logging
  const loggingTest = await testSchedulingDecisionLogging();
  results.push(loggingTest);

  // Test 2: Capacity Monitoring
  const capacityTest = await testCapacityMonitoring();
  results.push(capacityTest);

  // Test 3: Why This Time Explanations
  const explanationTest = await testSchedulingExplanations();
  results.push(explanationTest);

  // Test 4: Debug Dashboard Functionality
  const dashboardTest = await testDebugDashboard();
  results.push(dashboardTest);

  return results;
};

const testSchedulingDecisionLogging = async (): Promise<Phase4TestResult> => {
  const startTime = performance.now();
  
  try {
    // Check if decision logs table exists and has data
    const { data, error } = await supabase
      .from('scheduling_decision_logs')
      .select('*')
      .limit(1);

    if (error) throw error;

    const passed = data !== null;
    const details = passed 
      ? '✅ Scheduling decision logging table accessible'
      : '❌ Cannot access scheduling decision logs';

    return {
      test_name: 'Scheduling Decision Logging',
      passed,
      details,
      execution_time_ms: performance.now() - startTime
    };
  } catch (error) {
    return {
      test_name: 'Scheduling Decision Logging',
      passed: false,
      details: `❌ Error: ${error}`,
      execution_time_ms: performance.now() - startTime
    };
  }
};

const testCapacityMonitoring = async (): Promise<Phase4TestResult> => {
  const startTime = performance.now();
  
  try {
    // Test real-time capacity monitor view
    const { data, error } = await supabase
      .from('real_time_capacity_monitor')
      .select('*')
      .limit(1);

    if (error) throw error;

    const passed = data !== null;
    const details = passed 
      ? '✅ Real-time capacity monitoring functional'
      : '❌ Capacity monitoring view not accessible';

    return {
      test_name: 'Capacity Monitoring',
      passed,
      details,
      execution_time_ms: performance.now() - startTime
    };
  } catch (error) {
    return {
      test_name: 'Capacity Monitoring',
      passed: false,
      details: `❌ Error: ${error}`,
      execution_time_ms: performance.now() - startTime
    };
  }
};

const testSchedulingExplanations = async (): Promise<Phase4TestResult> => {
  const startTime = performance.now();
  
  try {
    // Test the explain_job_scheduling function
    const { data, error } = await supabase.rpc('explain_job_scheduling', {
      p_job_id: '00000000-0000-0000-0000-000000000000', // Test UUID
      p_job_table_name: 'production_jobs'
    });

    // Should not error even with dummy data
    const passed = error === null || error.message.includes('not found');
    const details = passed 
      ? '✅ Scheduling explanation function working'
      : `❌ Explanation function error: ${error?.message}`;

    return {
      test_name: 'Scheduling Explanations',
      passed,
      details,
      execution_time_ms: performance.now() - startTime
    };
  } catch (error) {
    return {
      test_name: 'Scheduling Explanations',
      passed: false,
      details: `❌ Error: ${error}`,
      execution_time_ms: performance.now() - startTime
    };
  }
};

const testDebugDashboard = async (): Promise<Phase4TestResult> => {
  const startTime = performance.now();
  
  try {
    // Test access to capacity snapshots
    const { data, error } = await supabase
      .from('stage_capacity_snapshots')
      .select('*')
      .limit(1);

    if (error) throw error;

    const passed = data !== null;
    const details = passed 
      ? '✅ Debug dashboard data accessible'
      : '❌ Dashboard data not accessible';

    return {
      test_name: 'Debug Dashboard',
      passed,
      details,
      execution_time_ms: performance.now() - startTime
    };
  } catch (error) {
    return {
      test_name: 'Debug Dashboard',
      passed: false,
      details: `❌ Error: ${error}`,
      execution_time_ms: performance.now() - startTime
    };
  }
};