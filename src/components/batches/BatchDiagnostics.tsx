import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bug, 
  Database, 
  FileSearch, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchDiagnosticsProps {
  batchId: string;
}

interface DiagnosticResult {
  category: string;
  status: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  details?: any;
  count?: number;
}

export const BatchDiagnostics: React.FC<BatchDiagnosticsProps> = ({ batchId }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runCompleteDiagnostics = async () => {
    setIsRunning(true);
    const diagnosticResults: DiagnosticResult[] = [];

    try {
      console.log(`🔍 Running complete diagnostics for batch ${batchId}`);

      // 1. Check batch existence and status
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchError || !batch) {
        diagnosticResults.push({
          category: 'batch',
          status: 'error',
          title: 'Batch Not Found',
          message: 'The specified batch does not exist in the system',
          details: batchError
        });
      } else {
        diagnosticResults.push({
          category: 'batch',
          status: 'success',
          title: 'Batch Found',
          message: `Batch "${batch.name}" exists with status: ${batch.status}`,
          details: batch
        });
      }

      // 2. Check batch job references
      const { data: batchRefs, error: refsError } = await supabase
        .from('batch_job_references')
        .select('*')
        .eq('batch_id', batchId);

      if (refsError) {
        diagnosticResults.push({
          category: 'references',
          status: 'error',
          title: 'Reference Query Failed',
          message: `Failed to query batch job references: ${refsError.message}`,
          details: refsError
        });
      } else if (!batchRefs || batchRefs.length === 0) {
        diagnosticResults.push({
          category: 'references',
          status: 'warning',
          title: 'No Batch References',
          message: 'No batch job references found for this batch',
          count: 0
        });
      } else {
        diagnosticResults.push({
          category: 'references',
          status: 'success',
          title: 'Batch References Found',
          message: `Found ${batchRefs.length} batch job reference(s)`,
          count: batchRefs.length,
          details: batchRefs
        });

        // 3. Validate production jobs for each reference
        const productionJobIds = batchRefs.map(ref => ref.production_job_id);
        const { data: productionJobs, error: jobsError } = await supabase
          .from('production_jobs')
          .select('id, wo_no, customer, status, batch_ready')
          .in('id', productionJobIds);

        if (jobsError) {
          diagnosticResults.push({
            category: 'production_jobs',
            status: 'error',
            title: 'Production Jobs Query Failed',
            message: `Failed to query production jobs: ${jobsError.message}`,
            details: jobsError
          });
        } else {
          const foundCount = productionJobs?.length || 0;
          const expectedCount = productionJobIds.length;
          
          if (foundCount !== expectedCount) {
            diagnosticResults.push({
              category: 'production_jobs',
              status: 'error',
              title: 'Missing Production Jobs',
              message: `Expected ${expectedCount} production jobs, found ${foundCount}`,
              count: foundCount,
              details: { expected: productionJobIds, found: productionJobs?.map(j => j.id) }
            });
          } else {
            diagnosticResults.push({
              category: 'production_jobs',
              status: 'success',
              title: 'All Production Jobs Found',
              message: `All ${foundCount} production jobs are accessible`,
              count: foundCount,
              details: productionJobs
            });

            // Check batch readiness
            const batchReadyCount = productionJobs?.filter(job => job.batch_ready).length || 0;
            if (batchReadyCount < foundCount) {
              diagnosticResults.push({
                category: 'batch_ready',
                status: 'warning',
                title: 'Jobs Not Batch Ready',
                message: `Only ${batchReadyCount} of ${foundCount} jobs are marked as batch ready`,
                count: batchReadyCount
              });
            } else {
              diagnosticResults.push({
                category: 'batch_ready',
                status: 'success',
                title: 'All Jobs Batch Ready',
                message: `All ${foundCount} jobs are marked as batch ready`,
                count: batchReadyCount
              });
            }
          }
        }
      }

      // 4. Check for orphaned references
      if (batchRefs && batchRefs.length > 0) {
        const { data: orphanCheck } = await supabase
          .from('batch_job_references')
          .select(`
            id,
            production_job_id,
            production_jobs!inner(id)
          `)
          .eq('batch_id', batchId);

        const orphanedCount = batchRefs.length - (orphanCheck?.length || 0);
        if (orphanedCount > 0) {
          diagnosticResults.push({
            category: 'orphaned',
            status: 'warning',
            title: 'Orphaned References',
            message: `Found ${orphanedCount} batch references pointing to non-existent production jobs`,
            count: orphanedCount
          });
        }
      }

      // 5. Run integrity validation
      const { data: integrityData, error: integrityError } = await supabase
        .rpc('validate_batch_integrity', { p_batch_id: batchId });

      if (integrityError) {
        diagnosticResults.push({
          category: 'integrity',
          status: 'error',
          title: 'Integrity Check Failed',
          message: `Integrity validation failed: ${integrityError.message}`,
          details: integrityError
        });
      } else if (integrityData && integrityData.length > 0) {
        const integrity = integrityData[0];
        diagnosticResults.push({
          category: 'integrity',
          status: integrity.is_valid ? 'success' : 'warning',
          title: integrity.is_valid ? 'Integrity Check Passed' : 'Integrity Issues Found',
          message: integrity.is_valid 
            ? 'Batch data integrity is valid' 
            : `Found ${integrity.error_count} integrity issue(s)`,
          details: integrity
        });
      }

      setResults(diagnosticResults);
      setLastRun(new Date());
      
      const errorCount = diagnosticResults.filter(r => r.status === 'error').length;
      const warningCount = diagnosticResults.filter(r => r.status === 'warning').length;
      
      if (errorCount > 0) {
        toast.error(`Diagnostics completed with ${errorCount} error(s) and ${warningCount} warning(s)`);
      } else if (warningCount > 0) {
        toast.warning(`Diagnostics completed with ${warningCount} warning(s)`);
      } else {
        toast.success('All diagnostics passed successfully');
      }

    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      toast.error('Failed to run diagnostics');
      
      diagnosticResults.push({
        category: 'system',
        status: 'error',
        title: 'Diagnostic System Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      });
      
      setResults(diagnosticResults);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getResultsByCategory = (category: string) => 
    results.filter(result => result.category === category);

  const getCategorySummary = (category: string) => {
    const categoryResults = getResultsByCategory(category);
    const errors = categoryResults.filter(r => r.status === 'error').length;
    const warnings = categoryResults.filter(r => r.status === 'warning').length;
    
    if (errors > 0) return 'error';
    if (warnings > 0) return 'warning';
    return categoryResults.length > 0 ? 'success' : 'info';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Batch Diagnostics
            </CardTitle>
            <CardDescription>
              Comprehensive batch system diagnostics and troubleshooting
            </CardDescription>
          </div>
          <Button
            onClick={runCompleteDiagnostics}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSearch className="h-4 w-4" />
            )}
            {isRunning ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </div>
        
        {lastRun && (
          <div className="text-xs text-muted-foreground">
            Last run: {lastRun.toLocaleString()}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {results.length > 0 && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="batch">
                <div className="flex items-center gap-1">
                  Batch {getStatusIcon(getCategorySummary('batch'))}
                </div>
              </TabsTrigger>
              <TabsTrigger value="references">
                <div className="flex items-center gap-1">
                  References {getStatusIcon(getCategorySummary('references'))}
                </div>
              </TabsTrigger>
              <TabsTrigger value="jobs">
                <div className="flex items-center gap-1">
                  Jobs {getStatusIcon(getCategorySummary('production_jobs'))}
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['batch', 'references', 'production_jobs', 'integrity'].map(category => {
                  const categoryResults = getResultsByCategory(category);
                  const status = getCategorySummary(category);
                  
                  return (
                    <div key={category} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(status)}
                        <span className="font-medium capitalize">{category.replace('_', ' ')}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {categoryResults.length} check(s)
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="space-y-2">
                {results.map((result, index) => (
                  <Alert key={index} variant={result.status === 'error' ? 'destructive' : 'default'}>
                    <div className="flex items-start gap-2">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <div className="font-medium">{result.title}</div>
                        <AlertDescription className="mt-1">
                          {result.message}
                          {result.count !== undefined && (
                            <Badge variant="outline" className="ml-2">
                              {result.count}
                            </Badge>
                          )}
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            </TabsContent>

            {['batch', 'references', 'production_jobs'].map(category => (
              <TabsContent key={category} value={category === 'production_jobs' ? 'jobs' : category}>
                <div className="space-y-4">
                  {getResultsByCategory(category).map((result, index) => (
                    <Alert key={index} variant={result.status === 'error' ? 'destructive' : 'default'}>
                      <div className="flex items-start gap-2">
                        {getStatusIcon(result.status)}
                        <div className="flex-1">
                          <div className="font-medium">{result.title}</div>
                          <AlertDescription className="mt-1">
                            {result.message}
                          </AlertDescription>
                          {result.details && (
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer">View Details</summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {results.length === 0 && !isRunning && (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Diagnostics" to analyze this batch</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};