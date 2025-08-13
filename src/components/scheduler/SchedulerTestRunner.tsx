import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { runCompleteSchedulerTests, MasterTestResult, PhaseTestResult } from '@/utils/scheduling/masterTestRunner';

const SchedulerTestRunner = () => {
  const [testResults, setTestResults] = useState<MasterTestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const results = runCompleteSchedulerTests();
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
            Systematic testing of all 5 phases - Phase 1: Time Zone Foundation, Phase 2: Business Logic Engine, 
            Phase 3: Data Integrity Layer, Phase 4: UI Consistency Fix, Phase 5: Production Features
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
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