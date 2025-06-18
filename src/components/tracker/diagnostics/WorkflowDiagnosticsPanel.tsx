
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Clock, Wrench, BarChart3, FileText } from "lucide-react";
import { toast } from "sonner";
import { 
  runWorkflowDiagnostics, 
  repairJobWorkflows,
  type WorkflowDiagnostic, 
  type DiagnosticSummary 
} from "@/utils/tracker/workflowDiagnostics";

export const WorkflowDiagnosticsPanel = () => {
  const [diagnostics, setDiagnostics] = useState<WorkflowDiagnostic[]>([]);
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResults, setRepairResults] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const results = await runWorkflowDiagnostics();
      setDiagnostics(results.diagnostics);
      setSummary(results.summary);
      toast.success(`Diagnostics complete: ${results.diagnostics.length} jobs with missing stages found`);
    } catch (error) {
      console.error('Diagnostics failed:', error);
      toast.error('Failed to run diagnostics');
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const repairAllJobs = async () => {
    if (diagnostics.length === 0) return;

    setIsRepairing(true);
    try {
      const jobIds = diagnostics.map(d => d.job_id);
      const results = await repairJobWorkflows(jobIds, {
        batchSize: 10,
        logChanges: true,
        validateBeforeCommit: true
      });

      setRepairResults(results);
      
      if (results.success) {
        toast.success(`Successfully repaired ${results.repairedJobs.length} jobs`);
        // Re-run diagnostics to verify repairs
        await runDiagnostics();
      } else {
        toast.error(`Repair completed with ${results.errors.length} errors`);
      }
    } catch (error) {
      console.error('Repair failed:', error);
      toast.error('Failed to repair workflows');
    } finally {
      setIsRepairing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'moderate': return 'secondary';
      case 'minor': return 'outline';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'moderate': return <Clock className="h-4 w-4" />;
      case 'minor': return <CheckCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Workflow Diagnostics & Repair</h2>
          <p className="text-muted-foreground">
            Analyze and repair missing stages in production workflows
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunningDiagnostics}
            variant="outline"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {isRunningDiagnostics ? 'Running...' : 'Run Diagnostics'}
          </Button>
          {diagnostics.length > 0 && (
            <Button 
              onClick={repairAllJobs} 
              disabled={isRepairing}
            >
              <Wrench className="h-4 w-4 mr-2" />
              {isRepairing ? 'Repairing...' : `Repair ${diagnostics.length} Jobs`}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold">{summary.total_jobs_analyzed}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Jobs with Issues</p>
                  <p className="text-2xl font-bold text-red-600">{summary.jobs_with_missing_stages}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Affected Categories</p>
                  <p className="text-2xl font-bold">{summary.most_affected_categories.length}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {Math.round((1 - summary.jobs_with_missing_stages / summary.total_jobs_analyzed) * 100)}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {summary && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="jobs">Affected Jobs</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            {repairResults && <TabsTrigger value="repair-log">Repair Log</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Diagnostic Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Workflow Health</span>
                  <Progress 
                    value={Math.round((1 - summary.jobs_with_missing_stages / summary.total_jobs_analyzed) * 100)} 
                    className="w-32" 
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Missing Stage Frequency</h4>
                  {Object.entries(summary.missing_stage_frequency)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([stage, count]) => (
                      <div key={stage} className="flex justify-between text-sm">
                        <span>{stage}</span>
                        <Badge variant="secondary">{count} jobs</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Jobs with Missing Stages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {diagnostics.map((diagnostic) => (
                    <div key={diagnostic.job_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(diagnostic.issue_severity)}>
                            {getSeverityIcon(diagnostic.issue_severity)}
                            {diagnostic.issue_severity}
                          </Badge>
                          <span className="font-medium">{diagnostic.job_wo_no}</span>
                          <span className="text-sm text-muted-foreground">
                            {diagnostic.category_name}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {diagnostic.actual_stages} / {diagnostic.expected_stages} stages
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-medium">Missing stages: </span>
                        {diagnostic.missing_stages.map(stage => stage.stage_name).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Most Affected Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.most_affected_categories.map((category) => (
                    <div key={category.category_name} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{category.category_name}</h4>
                        <Badge variant="destructive">{category.affected_jobs} jobs</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Common missing stages: {category.missing_stage_patterns.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Repair Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.repair_recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                      <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {repairResults && (
            <TabsContent value="repair-log" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Repair Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-sm text-green-600">Successfully Repaired</div>
                      <div className="text-2xl font-bold text-green-700">{repairResults.repairedJobs.length}</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="text-sm text-red-600">Errors</div>
                      <div className="text-2xl font-bold text-red-700">{repairResults.errors.length}</div>
                    </div>
                  </div>

                  {repairResults.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600">Repair Errors</h4>
                      {repairResults.errors.map((error: any, index: number) => (
                        <div key={index} className="text-sm p-2 bg-red-50 rounded border">
                          <span className="font-medium">Job {error.jobId}:</span> {error.error}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Empty State */}
      {!summary && !isRunningDiagnostics && (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Diagnostics Run Yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Run Diagnostics" to analyze workflow integrity across all production jobs
            </p>
            <Button onClick={runDiagnostics} disabled={isRunningDiagnostics}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Start Diagnostic Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
