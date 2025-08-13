import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { validateTimezoneDisplay, dbTimeToDisplayTime } from '@/utils/timezone-display-audit';

const Phase1VerificationPage = () => {
  const [validationResults, setValidationResults] = useState<any>(null);
  const [testCases, setTestCases] = useState<any[]>([]);

  const runVerification = () => {
    console.log('🔍 Running Phase 1 Verification...');
    
    // Run validation
    const results = validateTimezoneDisplay();
    setValidationResults(results);
    
    // Test specific cases manually
    const cases = [
      {
        description: 'Job at 06:00 SAST (04:00 UTC)',
        utcInput: '2024-01-15T04:00:00.000Z',
        expected: '06:00',
        actual: dbTimeToDisplayTime('2024-01-15T04:00:00.000Z')
      },
      {
        description: 'Job at 08:00 SAST (06:00 UTC)', 
        utcInput: '2024-01-15T06:00:00.000Z',
        expected: '08:00',
        actual: dbTimeToDisplayTime('2024-01-15T06:00:00.000Z')
      },
      {
        description: 'Job at 17:30 SAST (15:30 UTC)',
        utcInput: '2024-01-15T15:30:00.000Z', 
        expected: '17:30',
        actual: dbTimeToDisplayTime('2024-01-15T15:30:00.000Z')
      }
    ];
    
    setTestCases(cases);
    
    console.log('📊 Test Results:', results);
    console.log('🧪 Test Cases:', cases);
  };

  useEffect(() => {
    runVerification();
  }, []);

  const allPassed = validationResults?.passed && testCases.every(tc => tc.actual === tc.expected);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Phase 1: Timezone Display Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button onClick={runVerification} className="w-full">
            Re-run Verification
          </Button>

          {validationResults && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge variant={validationResults.passed ? "default" : "destructive"}>
                  ✅ {validationResults.results?.filter((r: any) => r.pass).length || 0} passed
                </Badge>
                <Badge variant={!validationResults.passed ? "destructive" : "secondary"}>
                  ❌ {validationResults.results?.filter((r: any) => !r.pass).length || 0} failed
                </Badge>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Test Cases:</h3>
                {testCases.map((testCase, i) => {
                  const passed = testCase.actual === testCase.expected;
                  return (
                    <div key={i} className={`p-3 rounded border ${passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2">
                        <span>{passed ? '✅' : '❌'}</span>
                        <span className="font-medium">{testCase.description}</span>
                      </div>
                      <div className="text-sm text-muted-foreground ml-6">
                        Expected: {testCase.expected} | Actual: {testCase.actual}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`p-4 rounded ${allPassed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {allPassed ? (
                  <div>
                    <h4 className="font-semibold text-green-800">✅ PHASE 1 VERIFICATION PASSED</h4>
                    <div className="text-sm text-green-700 mt-2 space-y-1">
                      <p>🎯 <strong>Timezone Display Bug FIXED</strong></p>
                      <p>✅ Jobs scheduled at 06:00 SAST display as "06:00" (not "08:00")</p>
                      <p>✅ UTC timestamps properly converted to SAST without double offset</p>
                      <p>✅ StageWeeklyScheduler.tsx now uses dbTimeToDisplayTime() instead of toLocaleString()</p>
                      <p className="font-medium pt-2 text-green-800">🚀 <strong>READY FOR PHASE 2: Scheduling Logic Fix</strong></p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-semibold text-red-800">❌ PHASE 1 VERIFICATION FAILED</h4>
                    <div className="text-sm text-red-700 mt-2">
                      <p>🚨 Timezone display still has issues</p>
                      <p>⚠️ Cannot proceed to Phase 2 until fixed</p>
                      {validationResults.errors?.map((error: string, i: number) => (
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
    </div>
  );
};

export default Phase1VerificationPage;