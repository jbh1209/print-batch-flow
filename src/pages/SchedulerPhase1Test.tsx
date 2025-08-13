import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { runPhase1Tests } from '@/utils/timezone-display-audit';

const SchedulerPhase1Test = () => {
  const [testResults, setTestResults] = useState<{passed: number; failed: number; errors: string[]} | null>(null);

  useEffect(() => {
    const results = runPhase1Tests();
    setTestResults(results);
  }, []);

  if (!testResults) return <div>Running Phase 1 tests...</div>;

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>🔍 Phase 1: Timezone Display Fix - Test Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-4">
            <Badge variant={testResults.passed > 0 ? "default" : "destructive"}>
              ✅ Passed: {testResults.passed}
            </Badge>
            <Badge variant={testResults.failed > 0 ? "destructive" : "default"}>
              ❌ Failed: {testResults.failed}
            </Badge>
          </div>
          
          {testResults.failed > 0 && (
            <div className="bg-destructive/10 p-4 rounded-lg">
              <h4 className="font-semibold text-destructive">Errors:</h4>
              <ul className="list-disc list-inside text-sm">
                {testResults.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className={`p-4 rounded-lg ${testResults.failed === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <h4 className="font-semibold">
              {testResults.failed === 0 ? '✅ PHASE 1 PASSED' : '❌ PHASE 1 FAILED'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {testResults.failed === 0 
                ? 'Timezone display is now fixed. Ready for Phase 2: Scheduling Logic.'
                : 'Must fix timezone display before proceeding to Phase 2.'
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerPhase1Test;