
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Clock, Wrench, BarChart3, FileText, Zap, Shield } from "lucide-react";
import { toast } from "sonner";
import { 
  runComprehensiveWorkflowDiagnostics, 
  executeComprehensiveWorkflowRepair,
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
      const results = await runComprehensiveWorkflowDiagnostics();
      setDiagnostics(results.diagnostics);
      setSummary(results.summary);
      
      if (results.diagnostics.length === 0) {
        toast.success('🎉 No workflow issues detected - system is healthy!');
      } else {
        toast.info(`📊 Analysis complete: ${results.diagnostics.length} jobs need attention`, {
          description: `System health: ${results.summary.system_health_score}%`
        });
      }
    } catch (error) {
      console.error('Diagnostics failed:', error);
      toast.error('Failed to run comprehensive diagnostics');
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const executeRepair = async (options: {
    repairMissingStages?: boolean;
    removeOrphanedStages?: boolean;
    dryRun?: boolean;
  } = {}) => {
    if (diagnostics.length === 0) return;

    setIsRepairing(true);
    try {
      const repairableDiagnostics = diagnostics.filter(d => 
        d.category_id && (d.missing_stages.length > 0 || (options.removeOrphanedStages && d.orphaned_stages.length > 0))
      );

      if (repairableDiagnostics.length === 0) {
        toast.warning('No automatically repairable jobs found');
        return;
      }

      const results = await executeComprehensiveWorkflowRepair(repairableDiagnostics, {
        ...options,
        batchSize: 10
      });

      setRepairResults(results);
      
      if (results.success) {
        toast.success(`✅ Successfully repaired ${results.summary.successful_repairs} jobs!`);
        // Re-run diagnostics to verify repairs
        setTimeout(() => runDiagnostics(), 1000);
      } else {
        toast.error(`⚠️ Repair completed with ${results.summary.failed_repairs} errors`);
      }
    } catch (error) {
      console.error('Repair failed:', error);
      toast.error('Failed to execute workflow repair');
    } finally {
      setIsRepairing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'moderate': return 'secondary';
      case 'minor': return 'outline';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'moderate': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'minor': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Workflow Diagnostics & Repair v2.0</h2>
          <p className="text-muted-foreground">
            Comprehensive analysis and automated repair of production workflows
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunningDiagnostics}
            variant="outline"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {isRunningDiagnostics ? 'Analyzing...' : 'Run Analysis'}
          </Button>
          {diagnostics.length > 0 && (
            <>
              <Button 
                onClick={() => executeRepair({ dryRun: true })} 
                disabled={isRepairing}
                variant="outline"
              >
                <Shield className="h-4 w-4 mr-2" />
                Dry Run
              </Button>
              <Button 
                onClick={() => executeRepair({ repairMissingStages: true, removeOrphanedStages: true })} 
                disabled={isRepairing}
              >
                <Wrench className="h-4 w-4 mr-2" />
                {isRepairing ? 'Repairing...' : `Auto-Repair ${diagnostics.filter(d => d.category_id).length} Jobs`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* System Health Score */}
      {summary && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">System Health Score</h3>
                <p className="text-sm text-muted-foreground">Overall workflow integrity across all jobs</p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${getHealthScoreColor(summary.system_health_score)}`}>
                  {summary.system_health_score}%
                </div>
                <Progress value={summary.system_health_score} className="w-32 mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <p className="text-2xl font-bold text-red-600">{summary.jobs_with_issues}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Auto-Repairable</p>
                  <p className="text-2xl font-bold text-green-600">{summary.repair_candidates.auto_repairable}</p>
                </div>
                <Zap className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Custom Workflows</p>
                  <p className="text-2xl font-bold text-purple-600">{summary.jobs_with_custom_workflows}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
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
            <TabsTrigger value="jobs">Problem Jobs ({diagnostics.length})</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="repair-plan">Repair Plan</TabsTrigger>
            {repairResults && <TabsTrigger value="repair-results">Repair Results</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Issue Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Missing Stages</span>
                    <Badge variant="destructive">{summary.jobs_with_missing_stages} jobs</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Orphaned Stages</span>
                    <Badge variant="secondary">{summary.jobs_with_orphaned_stages} jobs</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>No Category</span>
                    <Badge variant="outline">{summary.jobs_without_category} jobs</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Repair Readiness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Auto-Repairable</span>
                    <Badge variant="default" className="bg-green-500">{summary.repair_candidates.auto_repairable}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Manual Review Needed</span>
                    <Badge variant="secondary">{summary.repair_candidates.manual_intervention_needed}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Need Category Assignment</span>
                    <Badge variant="outline">{summary.repair_candidates.category_assignment_needed}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Jobs Requiring Attention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {diagnostics.map((diagnostic) => (
                    <div key={diagnostic.job_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(diagnostic.issue_severity)}>
                            {getSeverityIcon(diagnostic.issue_severity)}
                            {diagnostic.issue_severity.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{diagnostic.job_wo_no}</span>
                          <span className="text-sm text-muted-foreground">
                            {diagnostic.category_name || 'No Category'}
                          </span>
                          {diagnostic.has_custom_workflow && (
                            <Badge variant="outline" className="text-purple-600">Custom</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {diagnostic.actual_stages} / {diagnostic.expected_stages} stages
                        </div>
                      </div>
                      
                      {diagnostic.missing_stages.length > 0 && (
                        <div className="text-sm mb-2">
                          <span className="font-medium text-red-600">Missing: </span>
                          {diagnostic.missing_stages.map(stage => stage.stage_name).join(', ')}
                        </div>
                      )}
                      
                      {diagnostic.orphaned_stages.length > 0 && (
                        <div className="text-sm mb-2">
                          <span className="font-medium text-orange-600">Orphaned: </span>
                          {diagnostic.orphaned_stages.map(stage => stage.stage_name).join(', ')}
                        </div>
                      )}
                      
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Recommendations: </span>
                        {diagnostic.recommendations.join('; ')}
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
                        <span className="font-medium">Common issues: </span>
                        {category.common_issues.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repair-plan" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Automated Repair Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800">✅ Auto-Repairable</h4>
                    <p className="text-2xl font-bold text-green-700">{summary.repair_candidates.auto_repairable}</p>
                    <p className="text-sm text-green-600">Jobs with missing stages that can be automatically fixed</p>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-800">⚠️ Manual Review</h4>
                    <p className="text-2xl font-bold text-yellow-700">{summary.repair_candidates.manual_intervention_needed}</p>
                    <p className="text-sm text-yellow-600">Jobs requiring manual assessment before repair</p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800">🏷️ Category Needed</h4>
                    <p className="text-2xl font-bold text-blue-700">{summary.repair_candidates.category_assignment_needed}</p>
                    <p className="text-sm text-blue-600">Jobs needing category assignment first</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Repair Actions Available:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• <strong>Add Missing Stages:</strong> Create workflow stages that should exist based on category</li>
                    <li>• <strong>Remove Orphaned Stages:</strong> Delete stages that don't belong to the job's workflow</li>
                    <li>• <strong>Dry Run Mode:</strong> Preview changes without making actual modifications</li>
                    <li>• <strong>Batch Processing:</strong> Process multiple jobs efficiently with progress tracking</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {repairResults && (
            <TabsContent value="repair-results" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Repair Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-sm text-green-600">Successfully Repaired</div>
                      <div className="text-2xl font-bold text-green-700">{repairResults.summary.successful_repairs}</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="text-sm text-red-600">Failed Repairs</div>
                      <div className="text-2xl font-bold text-red-700">{repairResults.summary.failed_repairs}</div>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <div className="text-sm text-yellow-600">Skipped</div>
                      <div className="text-2xl font-bold text-yellow-700">{repairResults.summary.skipped_repairs}</div>
                    </div>
                  </div>

                  {repairResults.results.failed_repairs.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600">Failed Repairs</h4>
                      {repairResults.results.failed_repairs.slice(0, 10).map((failure: any, index: number) => (
                        <div key={index} className="text-sm p-2 bg-red-50 rounded border">
                          <span className="font-medium">Job {failure.job_id}:</span> {failure.error}
                        </div>
                      ))}
                      {repairResults.results.failed_repairs.length > 10 && (
                        <p className="text-sm text-muted-foreground">
                          ... and {repairResults.results.failed_repairs.length - 10} more failures
                        </p>
                      )}
                    </div>
                  )}

                  {repairResults.results.skipped_jobs.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-yellow-600">Skipped Jobs</h4>
                      {repairResults.results.skipped_jobs.slice(0, 10).map((skipped: any, index: number) => (
                        <div key={index} className="text-sm p-2 bg-yellow-50 rounded border">
                          <span className="font-medium">Job {skipped.job_id}:</span> {skipped.reason}
                        </div>
                      ))}
                      {repairResults.results.skipped_jobs.length > 10 && (
                        <p className="text-sm text-muted-foreground">
                          ... and {repairResults.results.skipped_jobs.length - 10} more skipped jobs
                        </p>
                      )}
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
            <h3 className="text-lg font-medium mb-2">Ready for Comprehensive Analysis</h3>
            <p className="text-muted-foreground mb-4">
              Run a complete diagnostic scan to analyze workflow integrity, detect issues, and get automated repair recommendations
            </p>
            <Button onClick={runDiagnostics} disabled={isRunningDiagnostics}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Start Comprehensive Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
