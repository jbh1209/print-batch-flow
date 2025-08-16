/**
 * SCHEDULER TEST PANEL
 * Simple UI to test and verify the scheduler fixes
 */

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { testSchedulerFix, debugSchedulingState } from "@/utils/scheduling/testSchedulerFix";

interface TestResult {
  passed: number;
  failed: number;
  errors: string[];
}

export function SchedulerTestPanel() {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const runTests = async () => {
    setIsRunning(true);
    setTestResult(null);
    setDebugInfo([]);
    
    try {
      // Capture console output for display
      const originalLog = console.log;
      const originalError = console.error;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
      };
      
      console.error = (...args) => {
        logs.push(`ERROR: ${args.join(' ')}`);
        originalError(...args);
      };

      const result = await testSchedulerFix();
      setTestResult(result);
      setDebugInfo(logs);
      
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const runDebug = async () => {
    setIsRunning(true);
    setDebugInfo([]);
    
    try {
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
      };

      await debugSchedulingState();
      setDebugInfo(logs);
      
      console.log = originalLog;
      
    } catch (error) {
      console.error('Debug execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Scheduler Fix Verification</CardTitle>
        <CardDescription>
          Test the UTC-first timezone fixes to ensure jobs schedule at 8:00 AM SAST and pack correctly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runTests}
            disabled={isRunning}
            variant="default"
          >
            {isRunning ? 'Running Tests...' : 'Run Scheduler Tests'}
          </Button>
          
          <Button 
            onClick={runDebug}
            disabled={isRunning}
            variant="outline"
          >
            {isRunning ? 'Running Debug...' : 'Debug Current State'}
          </Button>
        </div>

        {testResult && (
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <Badge variant={testResult.failed === 0 ? "default" : "destructive"}>
                {testResult.passed} Passed
              </Badge>
              {testResult.failed > 0 && (
                <Badge variant="destructive">
                  {testResult.failed} Failed
                </Badge>
              )}
            </div>
            
            {testResult.failed > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-800 mb-2">Test Failures:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {testResult.errors.map((error, i) => (
                    <li key={i} className="font-mono">• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {debugInfo.length > 0 && (
          <div className="bg-gray-50 border rounded p-3">
            <h4 className="font-medium mb-2">Output:</h4>
            <div className="text-sm font-mono space-y-1 max-h-64 overflow-y-auto">
              {debugInfo.map((log, i) => (
                <div key={i} className={log.startsWith('ERROR:') ? 'text-red-600' : 'text-gray-700'}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}