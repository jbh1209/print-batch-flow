import React, { useEffect, useState } from 'react';
import { runPhase2Tests } from '@/utils/scheduling/phase2-capacity-tests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const Phase2TestTrigger = () => {
  const [results, setResults] = useState<any>(null);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    if (!hasRun) {
      console.log('🔧 **PHASE 2: PARALLEL CAPACITY SCHEDULING TESTS**');
      console.log('Running Phase 2 tests automatically...');
      
      try {
        const testResults = runPhase2Tests();
        setResults(testResults);
        setHasRun(true);
        
        // Log results to console
        console.log('📊 PHASE 2 TEST RESULTS:');
        console.log(`✅ Passed: ${testResults.passed}`);
        console.log(`❌ Failed: ${testResults.failed}`);
        console.log(`🎯 Success Rate: ${testResults.passed + testResults.failed > 0 ? Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100) : 0}%`);
        
        if (testResults.errors.length > 0) {
          console.log('🚨 ERRORS:');
          testResults.errors.forEach((error: string, i: number) => {
            console.log(`${i + 1}. ${error}`);
          });
        }
        
        if (testResults.failed === 0) {
          console.log('🎉 ALL PHASE 2 TESTS PASSED!');
          console.log('✅ Capacity scheduling logic is working correctly');
          console.log('✅ "10 days later" bug has been fixed');
          console.log('🚀 Ready to proceed to Phase 3');
        } else {
          console.log('⚠️  PHASE 2 TESTS FAILED');
          console.log('❌ Capacity scheduling needs fixes');
        }
        
      } catch (error) {
        console.error('❌ Error running Phase 2 tests:', error);
        setResults({ passed: 0, failed: 1, errors: [String(error)] });
        setHasRun(true);
      }
    }
  }, [hasRun]);

  if (!results) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>🔧 Phase 2: Capacity Scheduling Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Running Phase 2 tests...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>🔧 Phase 2: Capacity Scheduling Test Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Badge variant={results.passed > 0 ? "default" : "secondary"}>
            ✅ Passed: {results.passed}
          </Badge>
          <Badge variant={results.failed > 0 ? "destructive" : "secondary"}>
            ❌ Failed: {results.failed}
          </Badge>
          <Badge variant="outline">
            🎯 Success Rate: {results.passed + results.failed > 0 ? Math.round((results.passed / (results.passed + results.failed)) * 100) : 0}%
          </Badge>
        </div>
        
        {results.errors && results.errors.length > 0 && (
          <div>
            <h4 className="font-semibold text-destructive mb-2">🚨 Errors:</h4>
            <ul className="list-disc list-inside space-y-1">
              {results.errors.map((error: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground">{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        {results.testDetails && results.testDetails.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">📊 Test Details:</h4>
            <div className="space-y-2">
              {results.testDetails.map((test: any, i: number) => (
                <div key={i} className="border rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={test.pass ? "default" : "destructive"}>
                      {test.pass ? "✅ PASS" : "❌ FAIL"}
                    </Badge>
                    <span className="font-medium">{test.test}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Expected: {test.expected}</p>
                  <p className="text-sm text-muted-foreground">Actual: {test.actual}</p>
                  {test.details && (
                    <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                      {JSON.stringify(test.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="pt-4 border-t">
          {results.failed === 0 ? (
            <div className="text-center text-green-600">
              <p className="font-semibold">🎉 ALL PHASE 2 TESTS PASSED!</p>
              <p className="text-sm">✅ Capacity scheduling logic is working correctly</p>
              <p className="text-sm">✅ "10 days later" bug has been fixed</p>
              <p className="text-sm">🚀 Ready to proceed to Phase 3</p>
            </div>
          ) : (
            <div className="text-center text-red-600">
              <p className="font-semibold">⚠️ PHASE 2 TESTS FAILED</p>
              <p className="text-sm">❌ Capacity scheduling needs fixes</p>
              <p className="text-sm">🔧 Review test details above</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Phase2TestTrigger;