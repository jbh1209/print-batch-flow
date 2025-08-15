import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { runCompleteSchedulerTests, MasterTestResult, PhaseTestResult } from '@/utils/scheduling/masterTestRunner';
import { runPhase1Tests } from '@/utils/timezone-display-audit';
import { runPhase2Tests } from '@/utils/scheduling/phase2-capacity-tests';
import ParallelSchedulerTest from './ParallelSchedulerTest';

const SchedulerTestRunner = () => {
  const [testResults, setTestResults] = useState<MasterTestResult | null>(null);
  const [phase1Results, setPhase1Results] = useState<any>(null);
  const [phase2Results, setPhase2Results] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showParallelTest, setShowParallelTest] = useState(true);

  const runPhase1Only = () => {
    console.log('🔍 **PHASE 1 VERIFICATION STARTING**');
    setIsRunning(true);
    
    try {
      const results = runPhase1Tests();
      setPhase1Results(results);
      
      if (results.failed === 0) {
        console.log('✅ **PHASE 1 VERIFICATION PASSED**');
        console.log('🎯 Timezone display bug FIXED - Ready for Phase 2');
      } else {
        console.log('❌ **PHASE 1 VERIFICATION FAILED**');
        console.log('🚨 Must fix timezone display before Phase 2');
      }
    } catch (error) {
      console.error('Phase 1 test error:', error);
      setPhase1Results({ passed: 0, failed: 1, errors: [String(error)] });
    }
    
    setIsRunning(false);
  };

  const runPhase2Only = () => {
    console.log('🔧 **PHASE 2 VERIFICATION STARTING**');
    setIsRunning(true);
    
    try {
      const results = runPhase2Tests();
      setPhase2Results(results);
      
      if (results.failed === 0) {
        console.log('✅ **PHASE 2 VERIFICATION PASSED**');
        console.log('🎯 Capacity scheduling fixed - No more "10 days later" bug');
      } else {
        console.log('❌ **PHASE 2 VERIFICATION FAILED**');
        console.log('🚨 Jobs still using sequential queue logic');
      }
    } catch (error) {
      console.error('Phase 2 test error:', error);
      setPhase2Results({ passed: 0, failed: 1, errors: [String(error)] });
    }
    
    setIsRunning(false);
  };

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const results = await runCompleteSchedulerTests();
      setTestResults(results);
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getPhaseStatus = (phase: PhaseTestResult) => {
    return phase.success ? 'success' : 'destructive';
  };

  const getPhaseIcon = (phase: PhaseTestResult) => {
    return phase.success ? '✅' : '❌';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            🚀 Complete Production Scheduler Test Suite
          </CardTitle>
          <p className="text-center text-muted-foreground">
            Systematic testing of all 6 phases - Phase 1: Timezone Foundation, Phase 2: Capacity Scheduling, 
            Phase 3: Business Logic, Phase 4: Data Integrity, Phase 5: UI Consistency, Phase 6: Production Features
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* NEW PARALLEL SCHEDULER TEST */}
          {showParallelTest && (
            <Card className="border-2 border-purple-200 bg-purple-50/30">
              <CardHeader>
                <CardTitle className="text-lg">🚀 LIVE PARALLEL SCHEDULER TEST</CardTitle>
                <p className="text-sm text-muted-foreground">
                  <strong>IMMEDIATE:</strong> Test the new parallel capacity scheduler with real data
                </p>
              </CardHeader>
              <CardContent>
                <ParallelSchedulerTest />
                <Button 
                  onClick={() => setShowParallelTest(false)}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  Hide Parallel Test
                </Button>
              </CardContent>
            </Card>
          )}

          {!showParallelTest && (
            <Button 
              onClick={() => setShowParallelTest(true)}
              variant="outline"
              className="w-full"
            >
              🚀 Show Parallel Scheduler Test
            </Button>
          )}

          {/* Phase 1 Verification Section */}
          <Card className="border-2 border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-lg">🔍 Phase 1: Timezone Display Verification</CardTitle>
              <p className="text-sm text-muted-foreground">
                <strong>MANDATORY:</strong> Phase 1 must pass before proceeding to Phase 2
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={runPhase1Only} 
                disabled={isRunning}
                className="w-full"
                variant="outline"
              >
                {isRunning ? 'Running Phase 1 Verification...' : '🔍 Verify Phase 1: Timezone Display Fix'}
              </Button>

              {phase1Results && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Badge variant={phase1Results.passed > 0 ? "default" : "destructive"}>
                      ✅ {phase1Results.passed} passed
                    </Badge>
                    <Badge variant={phase1Results.failed > 0 ? "destructive" : "secondary"}>
                      ❌ {phase1Results.failed} failed
                    </Badge>
                  </div>
                  
                  <div className={`p-3 rounded ${phase1Results.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    {phase1Results.failed === 0 ? (
                      <div>
                        <h4 className="font-semibold text-green-800">✅ PHASE 1 VERIFICATION PASSED</h4>
                        <div className="text-sm text-green-700 mt-1 space-y-1">
                          <p>✅ Jobs scheduled at 06:00 SAST display as "06:00" (not "08:00")</p>
                          <p>✅ UTC timestamps properly converted to SAST without double offset</p>
                          <p className="font-medium">🚀 READY FOR PHASE 2: Scheduling Logic Fix</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-semibold text-red-800">❌ PHASE 1 VERIFICATION FAILED</h4>
                        <div className="text-sm text-red-700 mt-1">
                          <p>🚨 Timezone display still has issues. Cannot proceed to Phase 2.</p>
                          {phase1Results.errors?.map((error: string, i: number) => (
                            <p key={i}>• {error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Phase 2 Verification Section */}
          <Card className="border-2 border-green-200 bg-green-50/30">
            <CardHeader>
              <CardTitle className="text-lg">🔧 Phase 2: Capacity Scheduling Verification</CardTitle>
              <p className="text-sm text-muted-foreground">
                <strong>CRITICAL:</strong> Tests that jobs pack within daily capacity (fixes "10 days later" bug)
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={runPhase2Only} 
                disabled={isRunning}
                className="w-full"
                variant="outline"
              >
                {isRunning ? 'Running Phase 2 Verification...' : '🔧 Verify Phase 2: Capacity Scheduling Fix'}
              </Button>

              {phase2Results && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Badge variant={phase2Results.passed > 0 ? "default" : "destructive"}>
                      ✅ {phase2Results.passed} passed
                    </Badge>
                    <Badge variant={phase2Results.failed > 0 ? "destructive" : "secondary"}>
                      ❌ {phase2Results.failed} failed
                    </Badge>
                  </div>
                  
                  <div className={`p-3 rounded ${phase2Results.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    {phase2Results.failed === 0 ? (
                      <div>
                        <h4 className="font-semibold text-green-800">✅ PHASE 2 VERIFICATION PASSED</h4>
                        <div className="text-sm text-green-700 mt-1 space-y-1">
                          <p>✅ Two 2-hour jobs pack within same day (not 10 days apart)</p>
                          <p>✅ Daily capacity logic replaces sequential queue</p>
                          <p>✅ Jobs schedule within working hours (8 AM - 5:30 PM SAST)</p>
                          <p>✅ Weekend jobs correctly move to Monday</p>
                          <p className="font-medium">🚀 READY FOR PHASE 3: Data Integrity</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-semibold text-red-800">❌ PHASE 2 VERIFICATION FAILED</h4>
                        <div className="text-sm text-red-700 mt-1">
                          <p>🚨 Capacity scheduling still has issues. Cannot proceed to Phase 3.</p>
                          {phase2Results.errors?.map((error: string, i: number) => (
                            <p key={i}>• {error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button 
              onClick={handleRunTests} 
              disabled={isRunning}
              size="lg"
              className="w-48"
            >
              {isRunning ? 'Running Tests...' : 'Run Complete Test Suite'}
            </Button>
          </div>

          {testResults && (
            <div className="space-y-4">
              {/* Overall Status */}
              <Card className={`border-2 ${testResults.readyForProduction ? 'border-green-500' : 'border-red-500'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {testResults.readyForProduction ? '🎉' : '🚨'} 
                    Production Status: {testResults.readyForProduction ? 'READY' : 'NOT READY'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{testResults.totalPassed}</div>
                      <div className="text-sm text-muted-foreground">Tests Passed</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{testResults.totalFailed}</div>
                      <div className="text-sm text-muted-foreground">Tests Failed</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {testResults.totalPassed > 0 
                          ? Math.round((testResults.totalPassed / (testResults.totalPassed + testResults.totalFailed)) * 100) 
                          : 0}%
                      </div>
                      <div className="text-sm text-muted-foreground">Success Rate</div>
                    </div>
                  </div>
                  <p className="mt-4 text-center text-sm">{testResults.summary}</p>
                </CardContent>
              </Card>

              {/* Phase Results */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Phase Results</h3>
                {testResults.phaseResults.map((phase) => (
                  <Card key={phase.phase} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{getPhaseIcon(phase)}</span>
                          <div>
                            <h4 className="font-medium">Phase {phase.phase}: {phase.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {phase.passed} passed, {phase.failed} failed
                            </p>
                          </div>
                        </div>
                        <Badge variant={getPhaseStatus(phase)}>
                          {phase.success ? 'PASS' : 'FAIL'}
                        </Badge>
                      </div>
                      
                      {!phase.success && phase.errors.length > 0 && (
                        <div className="mt-3 p-3 bg-red-50 rounded border-l-4 border-red-400">
                          <h5 className="font-medium text-red-800 mb-2">Errors:</h5>
                          <ul className="text-sm text-red-700 space-y-1">
                            {phase.errors.map((error, index) => (
                              <li key={index} className="list-disc list-inside">
                                {error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SchedulerTestRunner;