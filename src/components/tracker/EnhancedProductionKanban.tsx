
import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Settings } from "lucide-react";
import { toast } from "sonner";
import { EnhancedJobCard } from "./EnhancedJobCard";
import { useUnifiedProductionData } from "@/hooks/tracker/useUnifiedProductionData";

interface JobWithStages {
  id: string;
  wo_no: string;
  customer: string;
  category: string;
  due_date?: string;
  status: string;
  category_id?: string;
  stages: Array<{
    id: string;
    production_stage_id: string;
    stage_name: string;
    stage_color: string;
    status: 'pending' | 'active' | 'completed' | 'skipped';
    stage_order: number;
  }>;
}

interface EnhancedProductionKanbanProps {
  jobs: any[];
  stages: any[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh: () => void;
}

const EnhancedJobStageCard = ({ job, onJobUpdate }: { 
  job: JobWithStages; 
  onJobUpdate: () => void;
}) => {
  return (
    <div className="mb-3">
      <EnhancedJobCard
        job={{
          id: job.id,
          wo_no: job.wo_no,
          customer: job.customer,
          category: job.category,
          due_date: job.due_date,
          status: job.status
        }}
        stages={job.stages.map(stage => ({
          id: stage.id,
          name: stage.stage_name,
          status: stage.status === 'active' ? 'in-progress' : 
                  stage.status === 'skipped' ? 'on-hold' : 
                  stage.status,
          startTime: undefined,
          endTime: undefined
        }))}
        onJobClick={(job) => {
          console.log('Job clicked:', job);
        }}
        onStageClick={(jobId, stageId) => {
          console.log('Stage clicked:', jobId, stageId);
        }}
      />
    </div>
  );
};

const StageColumn = ({ stage, jobs, onJobUpdate }: { 
  stage: any; 
  jobs: JobWithStages[]; 
  onJobUpdate: () => void;
}) => {
  // Filter jobs that have stages matching this production stage
  const stageJobs = jobs.filter(job => 
    job.stages.some(s => s.production_stage_id === stage.id && s.status === 'active')
  );

  return (
    <div className="bg-gray-50 rounded-lg p-4 min-w-[350px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium">{stage.name}</h3>
        </div>
        <Badge variant="outline">
          {stageJobs.length}
        </Badge>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {stageJobs.map(job => (
          <EnhancedJobStageCard
            key={job.id}
            job={job}
            onJobUpdate={onJobUpdate}
          />
        ))}

        {stageJobs.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No jobs in this stage
          </div>
        )}
      </div>
    </div>
  );
};

export const EnhancedProductionKanban = ({ jobs: propsJobs, stages: propsStages, isLoading: propsLoading, error: propsError, onRefresh }: EnhancedProductionKanbanProps) => {
  // Use unified data hook directly instead of context
  const { jobs, consolidatedStages, isLoading, error, refreshJobs } = useUnifiedProductionData();
  
  // Transform jobs to include stage information - using correct job data
  const jobsWithStages: JobWithStages[] = React.useMemo(() => {
    return jobs.map(job => ({
      id: job.id,
      wo_no: job.wo_no || '',
      customer: job.customer || '',
      category: job.category_name || 'General',
      due_date: job.due_date,
      status: job.status || '',
      category_id: job.category_id,
      // Use actual job stages from the unified data
      stages: job.stages?.map((stage: any, index: number) => ({
        id: stage.id,
        production_stage_id: stage.production_stage_id,
        stage_name: stage.stage_name,
        stage_color: stage.stage_color,
        status: stage.status,
        stage_order: stage.stage_order || index + 1,
      })) || []
    }));
  }, [jobs]);

  const handleJobUpdate = useCallback(() => {
    refreshJobs();
  }, [refreshJobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading enhanced kanban board...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Error loading enhanced kanban board</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Enhanced Production Workflow</h2>
            <p className="text-gray-600">Track jobs through multi-stage production workflows with QR scanning</p>
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configure Workflows
          </Button>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Total jobs: {jobsWithStages.length} | Active stages: {consolidatedStages.filter(s => s.is_active !== false).length}
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6">
        {consolidatedStages
          .filter(stage => stage.is_active !== false)
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
          .map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              jobs={jobsWithStages}
              onJobUpdate={handleJobUpdate}
            />
          ))}
      </div>

      {jobsWithStages.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-gray-500 text-lg">No jobs found</p>
            <p className="text-gray-400">Upload an Excel file to start tracking jobs</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
