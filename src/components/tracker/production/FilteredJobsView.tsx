
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, ChevronRight, ChevronDown } from "lucide-react";
import { JobStageProgress } from "../JobStageProgress";
import { useJobStageInstances } from "@/hooks/tracker/useJobStageInstances";

interface FilteredJobsViewProps {
  jobs: any[];
  selectedStage?: string;
  isLoading: boolean;
  onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => void;
}

export const FilteredJobsView: React.FC<FilteredJobsViewProps> = ({
  jobs,
  selectedStage,
  isLoading,
  onStageAction
}) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [processingStages, setProcessingStages] = useState<Set<string>>(new Set());

  // Get job stage instances for the selected job
  const { 
    jobStages, 
    isLoading: stagesLoading,
    fetchJobStages,
    advanceJobStage,
    recordQRScan 
  } = useJobStageInstances(
    selectedJobId || undefined, 
    'production_jobs'
  );

  const handleJobClick = (jobId: string) => {
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
    } else {
      setSelectedJobId(jobId);
    }
  };

  const handleStageAction = async (stageId: string, action: 'start' | 'complete' | 'qr-scan') => {
    if (!selectedJobId) return;

    setProcessingStages(prev => new Set([...prev, stageId]));
    
    try {
      if (action === 'complete') {
        await advanceJobStage(stageId);
      } else if (action === 'qr-scan') {
        await recordQRScan(stageId, { action: 'qr_scan', timestamp: new Date().toISOString() });
      }
      
      // Also call the parent handler
      onStageAction(selectedJobId, stageId, action);
      
      // Refresh stages
      await fetchJobStages();
    } finally {
      setProcessingStages(prev => {
        const newSet = new Set(prev);
        newSet.delete(stageId);
        return newSet;
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading jobs...</span>
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-500 text-lg">No jobs found</p>
          <p className="text-gray-400">Try adjusting your filters or stage selection</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <Card key={job.id} className="overflow-hidden">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => handleJobClick(job.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {selectedJobId === job.id ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <CardTitle className="text-lg">{job.wo_no}</CardTitle>
                  </div>
                  
                  {job.category && (
                    <Badge variant="outline">{job.category}</Badge>
                  )}
                  
                  {job.current_stage && (
                    <Badge className={getStatusColor('active')}>
                      {job.current_stage}
                    </Badge>
                  )}
                </div>
                
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  {job.customer && (
                    <div>
                      <span className="font-medium">Customer:</span> {job.customer}
                    </div>
                  )}
                  {job.reference && (
                    <div>
                      <span className="font-medium">Reference:</span> {job.reference}
                    </div>
                  )}
                  {job.qty && (
                    <div>
                      <span className="font-medium">Qty:</span> {job.qty}
                    </div>
                  )}
                  {job.due_date && (
                    <div>
                      <span className="font-medium">Due:</span> {new Date(job.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {job.workflow_progress && (
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {job.workflow_progress.percentage}% Complete
                    </div>
                    <div className="text-xs text-gray-500">
                      {job.workflow_progress.completed}/{job.workflow_progress.total} stages
                    </div>
                    <Progress 
                      value={job.workflow_progress.percentage} 
                      className="w-24 h-2 mt-1" 
                    />
                  </div>
                )}
                
                {!job.has_workflow && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
                    No Workflow
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          
          {selectedJobId === job.id && (
            <CardContent className="border-t bg-gray-50">
              <div className="py-4">
                <h4 className="font-medium mb-4">Production Stages</h4>
                
                {stagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading stages...</span>
                  </div>
                ) : jobStages.length > 0 ? (
                  <JobStageProgress
                    jobStages={jobStages}
                    currentStage={jobStages.find(stage => stage.status === 'active')}
                    progress={job.workflow_progress || { completed: 0, total: 0, percentage: 0 }}
                    onStartStage={(stageId) => handleStageAction(stageId, 'start')}
                    onCompleteStage={(stageId) => handleStageAction(stageId, 'complete')}
                    onQRScan={(stageId) => handleStageAction(stageId, 'qr-scan')}
                    isProcessing={processingStages.size > 0}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No workflow stages configured for this job</p>
                    <p className="text-sm mt-1">Initialize a workflow to see production stages</p>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};
