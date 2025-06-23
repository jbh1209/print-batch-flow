
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Settings, 
  Play, 
  Pause, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { repairJobWorkflows } from "@/utils/tracker/workflowDiagnostics";
import type { WorkflowDiagnostic } from "@/utils/tracker/workflowDiagnostics";

interface BatchRepairManagerProps {
  diagnostics: WorkflowDiagnostic[];
  onRepairComplete: () => void;
}

interface RepairProgress {
  total: number;
  completed: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  errors: Array<{ jobId: string; error: string }>;
  repairedJobs: string[];
}

export const BatchRepairManager: React.FC<BatchRepairManagerProps> = ({
  diagnostics,
  onRepairComplete
}) => {
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [batchSize, setBatchSize] = useState(5);
  const [progress, setProgress] = useState<RepairProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    currentBatch: 0,
    totalBatches: 0,
    status: 'idle',
    errors: [],
    repairedJobs: []
  });

  const criticalJobs = diagnostics.filter(d => d.issue_severity === 'critical');
  const moderateJobs = diagnostics.filter(d => d.issue_severity === 'moderate');
  const minorJobs = diagnostics.filter(d => d.issue_severity === 'minor');

  const handleSelectAll = (severity?: string) => {
    const newSelected = new Set(selectedJobs);
    
    let jobsToSelect: WorkflowDiagnostic[] = [];
    if (severity === 'critical') jobsToSelect = criticalJobs;
    else if (severity === 'moderate') jobsToSelect = moderateJobs;
    else if (severity === 'minor') jobsToSelect = minorJobs;
    else jobsToSelect = diagnostics;

    jobsToSelect.forEach(job => newSelected.add(job.job_id));
    setSelectedJobs(newSelected);
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    const newSelected = new Set(selectedJobs);
    if (checked) {
      newSelected.add(jobId);
    } else {
      newSelected.delete(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const startBatchRepair = async () => {
    if (selectedJobs.size === 0) {
      toast.error('Please select jobs to repair');
      return;
    }

    const jobIds = Array.from(selectedJobs);
    const totalBatches = Math.ceil(jobIds.length / batchSize);

    setProgress({
      total: jobIds.length,
      completed: 0,
      failed: 0,
      currentBatch: 0,
      totalBatches,
      status: 'running',
      errors: [],
      repairedJobs: []
    });

    try {
      // Process in batches
      for (let i = 0; i < jobIds.length; i += batchSize) {
        const batch = jobIds.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;

        setProgress(prev => ({
          ...prev,
          currentBatch,
          status: 'running'
        }));

        console.log(`🔧 Processing batch ${currentBatch}/${totalBatches}`, { batch });

        const result = await repairJobWorkflows(batch, {
          batchSize: batch.length,
          logChanges: true,
          validateBeforeCommit: true
        });

        setProgress(prev => ({
          ...prev,
          completed: prev.completed + result.repairedJobs.length,
          failed: prev.failed + result.errors.length,
          errors: [...prev.errors, ...result.errors],
          repairedJobs: [...prev.repairedJobs, ...result.repairedJobs]
        }));

        // Small delay between batches to prevent overwhelming the database
        if (i + batchSize < jobIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setProgress(prev => ({ ...prev, status: 'completed' }));
      toast.success(`Batch repair completed: ${progress.completed + (jobIds.length - progress.failed)} jobs repaired`);
      onRepairComplete();

    } catch (error) {
      console.error('❌ Batch repair failed:', error);
      setProgress(prev => ({ ...prev, status: 'failed' }));
      toast.error('Batch repair failed');
    }
  };

  const resetProgress = () => {
    setProgress({
      total: 0,
      completed: 0,
      failed: 0,
      currentBatch: 0,
      totalBatches: 0,
      status: 'idle',
      errors: [],
      repairedJobs: []
    });
    setSelectedJobs(new Set());
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
      {/* Batch Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Batch Repair Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Batch Size:</label>
              <select 
                value={batchSize} 
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="px-3 py-1 border rounded"
                disabled={progress.status === 'running'}
              >
                <option value={3}>3 jobs</option>
                <option value={5}>5 jobs</option>
                <option value={10}>10 jobs</option>
                <option value={20}>20 jobs</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Selected: {selectedJobs.size} / {diagnostics.length} jobs
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSelectAll('critical')}
              disabled={progress.status === 'running'}
            >
              Select Critical ({criticalJobs.length})
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSelectAll('moderate')}
              disabled={progress.status === 'running'}
            >
              Select Moderate ({moderateJobs.length})
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSelectAll()}
              disabled={progress.status === 'running'}
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedJobs(new Set())}
              disabled={progress.status === 'running'}
            >
              Clear Selection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress Tracking */}
      {progress.status !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Repair Progress</span>
              <Badge variant={
                progress.status === 'running' ? 'default' :
                progress.status === 'completed' ? 'secondary' :
                progress.status === 'failed' ? 'destructive' : 'outline'
              }>
                {progress.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{progress.completed + progress.failed} / {progress.total}</span>
              </div>
              <Progress 
                value={progress.total > 0 ? ((progress.completed + progress.failed) / progress.total) * 100 : 0} 
                className="h-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded">
                <div className="text-lg font-bold text-green-600">{progress.completed}</div>
                <div className="text-xs text-green-600">Repaired</div>
              </div>
              <div className="p-3 bg-red-50 rounded">
                <div className="text-lg font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-red-600">Failed</div>
              </div>
              <div className="p-3 bg-blue-50 rounded">
                <div className="text-lg font-bold text-blue-600">
                  {progress.currentBatch} / {progress.totalBatches}
                </div>
                <div className="text-xs text-blue-600">Batches</div>
              </div>
            </div>

            {progress.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {progress.errors.length} jobs failed to repair. Check individual errors below.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Job Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs to Repair</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {diagnostics.map((diagnostic) => (
              <div key={diagnostic.job_id} className="flex items-center gap-3 p-3 border rounded">
                <Checkbox
                  checked={selectedJobs.has(diagnostic.job_id)}
                  onCheckedChange={(checked) => 
                    handleSelectJob(diagnostic.job_id, checked as boolean)
                  }
                  disabled={progress.status === 'running'}
                />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
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
                    Missing {diagnostic.expected_stages - diagnostic.actual_stages} of {diagnostic.expected_stages} stages
                  </div>
                </div>

                {progress.repairedJobs.includes(diagnostic.job_id) && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                
                {progress.errors.some(error => error.jobId === diagnostic.job_id) && (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Control Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={startBatchRepair}
          disabled={selectedJobs.size === 0 || progress.status === 'running'}
          className="flex-1"
        >
          <Play className="h-4 w-4 mr-2" />
          {progress.status === 'running' ? 'Repairing...' : `Start Repair (${selectedJobs.size} jobs)`}
        </Button>
        
        {progress.status !== 'idle' && (
          <Button variant="outline" onClick={resetProgress}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      {/* Error Details */}
      {progress.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Repair Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {progress.errors.map((error, index) => (
                <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                  <span className="font-medium">Job {error.jobId}:</span> {error.error}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
