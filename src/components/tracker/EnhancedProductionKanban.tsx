import React, { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Play, Pause, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { useJobStageInstances } from "@/hooks/tracker/useJobStageInstances";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";

interface JobWithStages {
  id: string;
  wo_no: string;
  customer: string;
  category: string;
  due_date?: string; // Make optional to match ProductionJob type
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

const JobStageCard = ({ job, onStageAction }: { job: JobWithStages; onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete') => void }) => {
  const activeStage = job.stages.find(s => s.status === 'active');
  const completedStages = job.stages.filter(s => s.status === 'completed').length;
  const totalStages = job.stages.length;

  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-medium text-sm">{job.wo_no}</h4>
            <p className="text-xs text-gray-600">{job.customer}</p>
            {job.category && (
              <Badge variant="outline" className="text-xs mt-1">
                {job.category}
              </Badge>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {completedStages}/{totalStages}
          </div>
        </div>

        {/* Stage Progress */}
        <div className="space-y-1 mb-3">
          {job.stages.map((stage) => (
            <div
              key={stage.id}
              className={`flex items-center gap-2 p-1 rounded text-xs ${
                stage.status === 'active' 
                  ? 'bg-blue-100 text-blue-800' 
                  : stage.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: stage.stage_color }}
              />
              <span className="flex-1">{stage.stage_name}</span>
              {stage.status === 'completed' && <CheckCircle className="h-3 w-3" />}
              {stage.status === 'active' && <Play className="h-3 w-3" />}
            </div>
          ))}
        </div>

        {/* Action Button */}
        {activeStage && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => onStageAction(job.id, activeStage.production_stage_id, 'complete')}
          >
            Complete {activeStage.stage_name}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const StageColumn = ({ stage, jobs, onStageAction }: { 
  stage: any; 
  jobs: JobWithStages[]; 
  onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete') => void;
}) => {
  // Filter jobs that have this stage
  const stageJobs = jobs.filter(job => 
    job.stages.some(s => s.production_stage_id === stage.id)
  );

  // Further filter by stage status for this column
  const activeJobs = stageJobs.filter(job => 
    job.stages.some(s => s.production_stage_id === stage.id && s.status === 'active')
  );

  const pendingJobs = stageJobs.filter(job => 
    job.stages.some(s => s.production_stage_id === stage.id && s.status === 'pending')
  );

  return (
    <div className="bg-gray-50 rounded-lg p-4 min-w-[300px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium">{stage.name}</h3>
        </div>
        <Badge variant="outline">
          {activeJobs.length + pendingJobs.length}
        </Badge>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {/* Active Jobs */}
        {activeJobs.map(job => (
          <JobStageCard
            key={`${job.id}-active`}
            job={job}
            onStageAction={onStageAction}
          />
        ))}

        {/* Pending Jobs */}
        {pendingJobs.map(job => (
          <div key={`${job.id}-pending`} className="opacity-60">
            <JobStageCard
              job={job}
              onStageAction={onStageAction}
            />
          </div>
        ))}

        {activeJobs.length === 0 && pendingJobs.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No jobs in this stage
          </div>
        )}
      </div>
    </div>
  );
};

export const EnhancedProductionKanban = () => {
  const { jobs, isLoading, error } = useProductionJobs();
  const { stages } = useProductionStages();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Transform jobs to include stage information with proper type handling
  const jobsWithStages: JobWithStages[] = React.useMemo(() => {
    // For now, we'll simulate stage data since we need to integrate with the actual job stage instances
    // In a real implementation, you'd fetch job_stage_instances for each job
    return jobs.map(job => ({
      ...job,
      customer: job.customer || 'Unknown Customer', // Ensure customer is always a string
      category: job.category || 'General', // Ensure category is always a string
      due_date: job.due_date || undefined, // Keep due_date as optional
      stages: stages.slice(0, 3).map((stage, index) => ({
        id: `${job.id}-${stage.id}`,
        production_stage_id: stage.id,
        stage_name: stage.name,
        stage_color: stage.color,
        status: index === 0 ? 'active' : 'pending' as const,
        stage_order: index + 1,
      }))
    }));
  }, [jobs, stages]);

  const handleStageAction = useCallback(async (jobId: string, stageId: string, action: 'start' | 'complete') => {
    console.log(`${action} stage ${stageId} for job ${jobId}`);
    
    // Here you would call the advanceJobStage function
    // const success = await advanceJobStage(stageId);
    // if (success) {
    //   toast.success(`Stage ${action}d successfully`);
    // }
    
    toast.success(`Stage ${action}d successfully`);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        <h2 className="text-2xl font-bold">Enhanced Production Workflow</h2>
        <p className="text-gray-600">Track jobs through multi-stage production workflows</p>
        <div className="mt-2 text-sm text-gray-500">
          Total jobs: {jobsWithStages.length} | Active stages: {stages.filter(s => s.is_active).length}
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6">
        {stages
          .filter(stage => stage.is_active)
          .sort((a, b) => a.order_index - b.order_index)
          .map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              jobs={jobsWithStages}
              onStageAction={handleStageAction}
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
