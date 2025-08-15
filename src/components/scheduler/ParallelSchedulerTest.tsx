import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { autoSchedulerService } from '@/services/autoSchedulerService';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentSAST, formatSAST } from '@/utils/timezone';

interface TestResult {
  success: boolean;
  message: string;
  scheduledSlots?: number;
  details?: any;
}

/**
 * **PARALLEL SCHEDULER VERIFICATION COMPONENT**
 * Tests the new capacity-aware scheduler to ensure it fixes "Monday to Friday" gaps
 */
const ParallelSchedulerTest = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<string>('Ready');

  /**
   * **CORE TEST: Schedule 2 jobs and verify they pack within same day**
   * This test should PASS if the "Monday to Friday" bug is fixed
   */
  const runParallelCapacityTest = async () => {
    setIsRunning(true);
    setPhase('Creating test jobs...');
    setTestResults([]);

    try {
      console.log('🧪 **PARALLEL CAPACITY TEST STARTING**');
      
      // STEP 1: Create two test production jobs
      const testJob1 = {
        id: crypto.randomUUID(),
        user_id: (await supabase.auth.getUser()).data.user?.id,
        wo_no: `TEST-${Date.now()}-1`,
        customer: 'PARALLEL TEST CUSTOMER 1',
        status: 'In Production',
        qty: 100,
        category_id: null
      };

      const testJob2 = {
        id: crypto.randomUUID(),
        user_id: (await supabase.auth.getUser()).data.user?.id,
        wo_no: `TEST-${Date.now()}-2`,
        customer: 'PARALLEL TEST CUSTOMER 2',
        status: 'In Production',
        qty: 200,
        category_id: null
      };

      setPhase('Inserting test jobs...');

      // Insert test jobs
      const { error: job1Error } = await supabase
        .from('production_jobs')
        .insert(testJob1);

      const { error: job2Error } = await supabase
        .from('production_jobs')
        .insert(testJob2);

      if (job1Error || job2Error) {
        throw new Error(`Failed to create test jobs: ${job1Error?.message || job2Error?.message}`);
      }

      console.log(`✅ Created test jobs: ${testJob1.id}, ${testJob2.id}`);

      // STEP 2: Get a production stage for testing
      const { data: stages } = await supabase
        .from('production_stages')
        .select('id, name')
        .eq('is_active', true)
        .neq('name', 'DTP')
        .neq('name', 'Proof')
        .neq('name', 'Batch Allocation')
        .limit(1);

      if (!stages || stages.length === 0) {
        throw new Error('No production stages found for testing');
      }

      const testStage = stages[0];
      console.log(`🎯 Using test stage: ${testStage.name}`);

      // STEP 3: Create stage instances for both jobs (2 hours each)
      const stageInstances = [
        {
          job_id: testJob1.id,
          job_table_name: 'production_jobs',
          production_stage_id: testStage.id,
          stage_order: 1,
          status: 'pending',
          estimated_duration_minutes: 120 // 2 hours
        },
        {
          job_id: testJob2.id,
          job_table_name: 'production_jobs',
          production_stage_id: testStage.id,
          stage_order: 1,
          status: 'pending',
          estimated_duration_minutes: 120 // 2 hours
        }
      ];

      setPhase('Creating stage instances...');

      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .insert(stageInstances);

      if (stageError) {
        throw new Error(`Failed to create stage instances: ${stageError.message}`);
      }

      console.log(`✅ Created stage instances for both jobs`);

      // STEP 4: Schedule first job using parallel scheduler
      setPhase('Scheduling Job 1...');

      const result1 = await autoSchedulerService.scheduleJob(testJob1.id, 'production_jobs');
      
      if (!result1.success) {
        throw new Error(`Job 1 scheduling failed: ${result1.message}`);
      }

      setTestResults(prev => [...prev, {
        success: result1.success,
        message: `Job 1 scheduled: ${result1.message}`,
        scheduledSlots: result1.scheduled_slots,
        details: result1
      }]);

      // STEP 5: Schedule second job using parallel scheduler  
      setPhase('Scheduling Job 2...');

      const result2 = await autoSchedulerService.scheduleJob(testJob2.id, 'production_jobs');

      if (!result2.success) {
        throw new Error(`Job 2 scheduling failed: ${result2.message}`);
      }

      setTestResults(prev => [...prev, {
        success: result2.success,
        message: `Job 2 scheduled: ${result2.message}`,
        scheduledSlots: result2.scheduled_slots,
        details: result2
      }]);

      // STEP 6: Verify both jobs are scheduled on the same day (CRITICAL TEST)
      setPhase('Verifying parallel capacity logic...');

      const { data: scheduledJobs } = await supabase
        .from('job_stage_instances')
        .select('job_id, auto_scheduled_start_at, auto_scheduled_end_at, auto_scheduled_duration_minutes')
        .in('job_id', [testJob1.id, testJob2.id])
        .not('auto_scheduled_start_at', 'is', null);

      if (!scheduledJobs || scheduledJobs.length !== 2) {
        throw new Error('Both jobs should be scheduled but were not found');
      }

      const job1Schedule = scheduledJobs.find(j => j.job_id === testJob1.id);
      const job2Schedule = scheduledJobs.find(j => j.job_id === testJob2.id);

      if (!job1Schedule || !job2Schedule) {
        throw new Error('Could not find scheduled times for both jobs');
      }

      // Parse scheduled dates
      const job1Date = new Date(job1Schedule.auto_scheduled_start_at!).toDateString();
      const job2Date = new Date(job2Schedule.auto_scheduled_start_at!).toDateString();

      const job1Start = formatSAST(new Date(job1Schedule.auto_scheduled_start_at!), 'HH:mm');
      const job1End = formatSAST(new Date(job1Schedule.auto_scheduled_end_at!), 'HH:mm');
      const job2Start = formatSAST(new Date(job2Schedule.auto_scheduled_start_at!), 'HH:mm');
      const job2End = formatSAST(new Date(job2Schedule.auto_scheduled_end_at!), 'HH:mm');

      console.log(`📅 Job 1 scheduled: ${job1Date} ${job1Start}-${job1End}`);
      console.log(`📅 Job 2 scheduled: ${job2Date} ${job2Start}-${job2End}`);

      // CRITICAL VERIFICATION: Both jobs should be on same day if capacity allows
      const sameDayScheduling = job1Date === job2Date;
      
      setTestResults(prev => [...prev, {
        success: sameDayScheduling,
        message: sameDayScheduling 
          ? `✅ PARALLEL CAPACITY VERIFIED: Both jobs scheduled on same day (${job1Date})`
          : `❌ SEQUENTIAL SCHEDULING DETECTED: Jobs scheduled on different days (${job1Date} vs ${job2Date})`,
        details: {
          job1: { date: job1Date, time: `${job1Start}-${job1End}` },
          job2: { date: job2Date, time: `${job2Start}-${job2End}` },
          sameDayScheduling
        }
      }]);

      // STEP 7: Cleanup test data
      setPhase('Cleaning up test data...');

      await supabase.from('job_stage_instances').delete().in('job_id', [testJob1.id, testJob2.id]);
      await supabase.from('production_jobs').delete().in('id', [testJob1.id, testJob2.id]);

      setPhase(sameDayScheduling ? '✅ PARALLEL SCHEDULER VERIFIED' : '❌ STILL USING SEQUENTIAL LOGIC');

      console.log(sameDayScheduling 
        ? '🎉 **PARALLEL CAPACITY TEST PASSED** - Scheduler is working correctly!' 
        : '🚨 **PARALLEL CAPACITY TEST FAILED** - Scheduler still has sequential behavior'
      );

    } catch (error) {
      console.error('Parallel capacity test failed:', error);
      setTestResults(prev => [...prev, {
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      }]);
      setPhase('❌ TEST FAILED');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            🚀 Parallel Capacity Scheduler Test
          </CardTitle>
          <p className="text-center text-muted-foreground">
            Verifies that the new parallel scheduler fixes "Monday to Friday" scheduling gaps
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Test Status */}
          <Card className="border-2 border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-lg">🧪 Capacity Logic Verification</CardTitle>
              <p className="text-sm text-muted-foreground">
                Creates 2 test jobs (2 hours each) and verifies they pack within same day capacity
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <p className="text-lg font-medium">Status: {phase}</p>
                {isRunning && (
                  <div className="mt-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                )}
              </div>

              <Button 
                onClick={runParallelCapacityTest} 
                disabled={isRunning}
                className="w-full"
                size="lg"
              >
                {isRunning ? 'Running Parallel Scheduler Test...' : '🚀 Test Parallel Capacity Scheduler'}
              </Button>
            </CardContent>
          </Card>

          {/* Test Results */}
          {testResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {testResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded border-l-4 ${
                      result.success 
                        ? 'bg-green-50 border-green-400' 
                        : 'bg-red-50 border-red-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? '✅ PASS' : '❌ FAIL'}
                      </Badge>
                      <span className="font-medium">Step {index + 1}</span>
                    </div>
                    <p className="text-sm">{result.message}</p>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer">View Details</summary>
                        <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card className="border border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-2">Expected Results:</h4>
              <ul className="text-sm space-y-1">
                <li>✅ Both test jobs should be scheduled successfully</li>
                <li>✅ Both jobs should be scheduled on the SAME DAY (if capacity allows)</li>
                <li>✅ Jobs should start at different times (e.g., 08:00-10:00, then 10:00-12:00)</li>
                <li>❌ Jobs should NOT be scheduled days apart (Monday/Friday)</li>
              </ul>
            </CardContent>
          </Card>

        </CardContent>
      </Card>
    </div>
  );
};

export default ParallelSchedulerTest;