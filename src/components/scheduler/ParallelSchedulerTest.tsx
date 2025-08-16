/**
 * **PARALLEL SCHEDULER TEST: Verifies parallel capacity packing**
 * Tests that the new capacity-aware scheduler can pack multiple jobs within the same day
 * instead of spreading them across multiple days
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { autoSchedulerService } from '@/services/autoSchedulerService';
import { supabase } from '@/integrations/supabase/client';
import { formatSAST } from '@/utils/timezone';

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

const ParallelSchedulerTest = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');

  const runParallelCapacityTest = async () => {
    setIsRunning(true);
    setResults([]);
    setCurrentPhase('Setting up test environment...');

    const testResults: TestResult[] = [];

    try {
      // Step 1: Create test production jobs
      setCurrentPhase('Creating test production jobs...');
      
      const { data: testJob1, error: job1Error } = await supabase
        .from('production_jobs')
        .insert({
          wo_no: `TEST-PARALLEL-${Date.now()}-1`,
          customer: 'Test Customer 1',
          reference: 'Parallel Test Job 1',
          qty: 100,
          status: 'In Production',
          user_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (job1Error) throw job1Error;

      const { data: testJob2, error: job2Error } = await supabase
        .from('production_jobs')
        .insert({
          wo_no: `TEST-PARALLEL-${Date.now()}-2`, 
          customer: 'Test Customer 2',
          reference: 'Parallel Test Job 2',
          qty: 150,
          status: 'In Production',
          user_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (job2Error) throw job2Error;

      testResults.push({
        success: true,
        message: 'Created two test production jobs',
        details: `Job 1: ${testJob1.wo_no}, Job 2: ${testJob2.wo_no}`
      });

      // Step 2: Get an active production stage
      setCurrentPhase('Finding active production stage...');
      
      const { data: activeStage, error: stageError } = await supabase
        .from('production_stages')
        .select('id, name')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (stageError || !activeStage) {
        throw new Error('No active production stages found');
      }

      testResults.push({
        success: true,
        message: 'Found active production stage',
        details: `Stage: ${activeStage.name} (${activeStage.id})`
      });

      // Step 3: Create stage instances for both jobs (2 hour duration each)
      setCurrentPhase('Creating stage instances...');
      
      const estimatedMinutes = 120; // 2 hours each

      await supabase.from('job_stage_instances').insert([
        {
          job_id: testJob1.id,
          job_table_name: 'production_jobs',
          production_stage_id: activeStage.id,
          stage_order: 1,
          status: 'pending',
          estimated_duration_minutes: estimatedMinutes
        },
        {
          job_id: testJob2.id,
          job_table_name: 'production_jobs', 
          production_stage_id: activeStage.id,
          stage_order: 1,
          status: 'pending',
          estimated_duration_minutes: estimatedMinutes
        }
      ]);

      testResults.push({
        success: true,
        message: 'Created stage instances for both jobs',
        details: `Each job has ${estimatedMinutes} minute estimated duration`
      });

      // Step 4: Schedule first job
      setCurrentPhase('Scheduling first job...');
      
      const schedule1Result = await autoSchedulerService.scheduleJob(testJob1.id);
      
      if (!schedule1Result.success) {
        throw new Error(`Failed to schedule first job: ${schedule1Result.message}`);
      }

      testResults.push({
        success: true,
        message: 'Scheduled first job successfully',
        details: schedule1Result.message
      });

      // Step 5: Schedule second job
      setCurrentPhase('Scheduling second job...');
      
      const schedule2Result = await autoSchedulerService.scheduleJob(testJob2.id);
      
      if (!schedule2Result.success) {
        throw new Error(`Failed to schedule second job: ${schedule2Result.message}`);
      }

      testResults.push({
        success: true,
        message: 'Scheduled second job successfully',
        details: schedule2Result.message
      });

      // Step 6: Verify both jobs are scheduled on the same day
      setCurrentPhase('Verifying parallel scheduling...');
      
      // Query the scheduled times using new unified columns
      const { data: scheduledJobs, error: scheduleError } = await supabase
        .from('job_stage_instances')
        .select('job_id, scheduled_start_at, scheduled_end_at')
        .in('job_id', [testJob1.id, testJob2.id])
        .not('scheduled_start_at', 'is', null);

      if (scheduleError) {
        throw scheduleError;
      }

      if (!scheduledJobs || scheduledJobs.length !== 2) {
        throw new Error('Both jobs should be scheduled but were not found');
      }

      const job1Schedule = scheduledJobs.find(j => j.job_id === testJob1.id);
      const job2Schedule = scheduledJobs.find(j => j.job_id === testJob2.id);

      if (!job1Schedule || !job2Schedule) {
        throw new Error('Could not find scheduled times for both jobs');
      }

      // Parse scheduled dates using new unified columns
      const job1Date = new Date(job1Schedule.scheduled_start_at!).toDateString();
      const job2Date = new Date(job2Schedule.scheduled_start_at!).toDateString();

      const job1Start = formatSAST(new Date(job1Schedule.scheduled_start_at!), 'HH:mm');
      const job1End = formatSAST(new Date(job1Schedule.scheduled_end_at!), 'HH:mm');
      const job2Start = formatSAST(new Date(job2Schedule.scheduled_start_at!), 'HH:mm');
      const job2End = formatSAST(new Date(job2Schedule.scheduled_end_at!), 'HH:mm');

      console.log(`📅 Job 1 scheduled: ${job1Date} ${job1Start}-${job1End}`);
      console.log(`📅 Job 2 scheduled: ${job2Date} ${job2Start}-${job2End}`);

      if (job1Date === job2Date) {
        testResults.push({
          success: true,
          message: '✅ PASS: Both jobs scheduled on the same day (parallel capacity)',
          details: `Both jobs scheduled for ${job1Date}. Job 1: ${job1Start}-${job1End}, Job 2: ${job2Start}-${job2End}`
        });
      } else {
        testResults.push({
          success: false,
          message: '❌ FAIL: Jobs scheduled on different days',
          details: `Job 1 on ${job1Date}, Job 2 on ${job2Date}. This indicates sequential scheduling bug.`
        });
      }

      // Step 7: Cleanup test data
      setCurrentPhase('Cleaning up test data...');
      
      await supabase.from('job_stage_instances').delete().in('job_id', [testJob1.id, testJob2.id]);
      await supabase.from('production_jobs').delete().in('id', [testJob1.id, testJob2.id]);

      testResults.push({
        success: true,
        message: 'Cleaned up test data',
        details: 'Removed test jobs and stage instances'
      });

    } catch (error) {
      console.error('Test failed:', error);
      testResults.push({
        success: false,
        message: 'Test failed with error',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setResults(testResults);
      setIsRunning(false);
      setCurrentPhase('');
    }
  };

  const passedTests = results.filter(r => r.success).length;
  const failedTests = results.filter(r => !r.success).length;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🧪 Parallel Scheduler Test
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Tests whether the new scheduler can pack multiple jobs within the same day
              instead of spreading them unnecessarily across multiple days.
            </p>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runParallelCapacityTest}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? 'Running Test...' : 'Run Parallel Capacity Test'}
            </Button>
            {currentPhase && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Current Phase:</strong> {currentPhase}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Test Results
                <div className="flex gap-2">
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Passed: {passedTests}
                  </Badge>
                  <Badge variant="destructive">
                    Failed: {failedTests}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-md border ${
                      result.success 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <p className={`font-medium ${
                      result.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {result.success ? '✅' : '❌'} {result.message}
                    </p>
                    {result.details && (
                      <p className={`text-sm mt-1 ${
                        result.success ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {result.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Final Status */}
              <div className="mt-6 p-4 rounded-md border-2 border-dashed">
                {failedTests === 0 ? (
                  <div className="text-center text-green-800">
                    <p className="text-lg font-bold">🎉 All Tests Passed!</p>
                    <p className="text-sm">
                      The parallel capacity scheduler is working correctly and can pack 
                      multiple jobs within the same day instead of spreading them across multiple days.
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-red-800">
                    <p className="text-lg font-bold">❌ Test Failed</p>
                    <p className="text-sm">
                      The scheduler is still spreading jobs across multiple days instead of 
                      using parallel capacity. Check the failed tests above for details.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Expected Behavior</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>✅ Correct (Parallel):</strong> Both 2-hour jobs scheduled on the same day, e.g.:</p>
            <ul className="list-disc list-inside ml-4">
              <li>Job 1: Today 08:00-10:00</li>
              <li>Job 2: Today 10:00-12:00</li>
            </ul>
            
            <p><strong>❌ Incorrect (Sequential):</strong> Jobs spread across different days, e.g.:</p>
            <ul className="list-disc list-inside ml-4">
              <li>Job 1: Today 08:00-10:00</li>
              <li>Job 2: Tomorrow 08:00-10:00</li>
            </ul>
            
            <p className="mt-4">
              The test creates two 2-hour jobs and verifies they get packed within the same day's 
              8-hour capacity (8 AM - 5:30 PM SAST) instead of being scheduled on separate days.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParallelSchedulerTest;