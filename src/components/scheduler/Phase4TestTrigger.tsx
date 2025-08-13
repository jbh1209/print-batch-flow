/**
 * **PHASE 4: DEBUGGING & MONITORING TEST TRIGGER**
 * UI component to run and display Phase 4 test results
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { runPhase4TestsWithResults, Phase4TestResult } from '@/utils/scheduling/phase4-debugging-tests';
import { CheckCircle, XCircle, AlertTriangle, PlayCircle } from 'lucide-react';

const Phase4TestTrigger = () => {
  const [results, setResults] = useState<Phase4TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    try {
      const testResults = await runPhase4TestsWithResults();
      setResults(testResults);
      setLastRun(new Date());
    } catch (error) {
      console.error('Failed to run Phase 4 tests:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getTestIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔍 Phase 4: Debugging & Monitoring Tests
              <Badge variant="outline">Debug Features</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button 
                onClick={runTests} 
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                {isRunning ? 'Running Tests...' : 'Run Phase 4 Tests'}
              </Button>
              
              {lastRun && (
                <div className="text-sm text-muted-foreground">
                  Last run: {lastRun.toLocaleTimeString()}
                </div>
              )}
              
              {results.length > 0 && (
                <Badge variant={passedTests === totalTests ? 'default' : 'destructive'}>
                  {passedTests}/{totalTests} Tests Passed
                </Badge>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              <p><strong>Phase 4 Testing:</strong> Debugging logs, capacity monitoring, and explanation features</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>🔍 Scheduling Decision Logging - Tests decision tracking</li>
                <li>📊 Capacity Monitoring - Tests real-time capacity views</li>
                <li>💡 Why This Time Explanations - Tests scheduling explanations</li>
                <li>🔧 Debug Dashboard - Tests debugging UI functionality</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Test Results Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{passedTests}</div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{totalTests - passedTests}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{totalTests}</div>
                    <div className="text-sm text-muted-foreground">Total Tests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {results.map((result, index) => (
              <Card key={index} className={!result.passed ? 'border-red-200' : ''}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getTestIcon(result.passed)}
                    {result.test_name}
                    <Badge variant={result.passed ? 'default' : 'destructive'}>
                      {result.passed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm">{result.details}</p>
                    <div className="text-xs text-muted-foreground">
                      Execution time: {result.execution_time_ms.toFixed(2)}ms
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {results.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p className="font-semibold">No Test Results</p>
                <p className="text-sm">Click "Run Phase 4 Tests" to start debugging & monitoring tests</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Phase 4 Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">🔍 Debugging & Monitoring Dashboard</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Phase 4 provides comprehensive debugging and monitoring capabilities for the scheduling system.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium">Available Tools:</h5>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Capacity Dashboard (/capacity-dashboard)</li>
                      <li>Why This Time Explainer (/why-this-time)</li>
                      <li>Decision logging system</li>
                      <li>Real-time capacity monitoring</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium">Key Features:</h5>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Detailed scheduling decision logs</li>
                      <li>Stage utilization tracking</li>
                      <li>Capacity warnings and alerts</li>
                      <li>Scheduling explanation system</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Phase4TestTrigger;