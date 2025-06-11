
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  AlertTriangle, 
  Settings, 
  Clock,
  Play,
  CheckCircle,
  QrCode,
  Timer,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { useRealTimeJobStages } from "@/hooks/tracker/useRealTimeJobStages";
import { filterActiveJobs } from "@/utils/tracker/jobCompletionUtils";

const StageTimer = ({ startedAt }: { startedAt?: string }) => {
  const [elapsed, setElapsed] = useState<number>(0);

  React.useEffect(() => {
    if (!startedAt) return;

    const updateElapsed = () => {
      const start = new Date(startedAt).getTime();
      const now = new Date().getTime();
      setElapsed(Math.floor((now - start) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex items-center gap-1 text-xs text-blue-600">
      <Timer className="h-3 w-3" />
      <span>{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
    </div>
  );
};

const JobStageCard = ({ 
  jobStage, 
  onStageAction 
}: { 
  jobStage: any;
  onStageAction: (stageId: string, action: 'start' | 'complete' | 'scan') => void;
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'active':
        return <Play className="h-4 w-4 text-blue-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card className={`mb-3 transition-all duration-200 ${
      jobStage.status === 'active' ? 'ring-2 ring-blue-300 shadow-lg' : 'hover:shadow-md'
    }`}>
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-sm">{jobStage.production_job?.wo_no}</h4>
              {jobStage.production_job?.customer && (
                <p className="text-xs text-gray-600">{jobStage.production_job.customer}</p>
              )}
            </div>
            <Badge variant="outline" className={getStatusColor(jobStage.status)}>
              <div className="flex items-center gap-1">
                {getStatusIcon(jobStage.status)}
                {jobStage.status}
              </div>
            </Badge>
          </div>

          <div className="text-xs text-gray-500">
            Stage {jobStage.stage_order} • {jobStage.production_stage.name}
          </div>

          {jobStage.status === 'active' && (
            <StageTimer startedAt={jobStage.started_at} />
          )}

          {jobStage.production_job?.due_date && (
            <div className="text-xs text-gray-500">
              Due: {new Date(jobStage.production_job.due_date).toLocaleDateString()}
            </div>
          )}

          <div className="flex gap-1">
            {jobStage.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStageAction(jobStage.id, 'scan')}
                  className="text-xs h-7"
                >
                  <QrCode className="h-3 w-3 mr-1" />
                  Scan
                </Button>
                <Button
                  size="sm"
                  onClick={() => onStageAction(jobStage.id, 'start')}
                  className="text-xs h-7"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </Button>
              </>
            )}
            
            {jobStage.status === 'active' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStageAction(jobStage.id, 'scan')}
                  className="text-xs h-7"
                >
                  <QrCode className="h-3 w-3 mr-1" />
                  Scan
                </Button>
                <Button
                  size="sm"
                  onClick={() => onStageAction(jobStage.id, 'complete')}
                  className="text-xs h-7 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </Button>
              </>
            )}
          </div>

          {jobStage.notes && (
            <div className="text-xs p-2 bg-gray-50 rounded">
              <strong>Notes:</strong> {jobStage.notes}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const StageColumn = ({ 
  stage, 
  jobStages, 
  onStageAction 
}: { 
  stage: any;
  jobStages: any[];
  onStageAction: (stageId: string, action: 'start' | 'complete' | 'scan') => void;
}) => {
  const stageJobStages = jobStages.filter(js => 
    js.production_stage_id === stage.id
  );

  const activeStages = stageJobStages.filter(js => js.status === 'active');
  const pendingStages = stageJobStages.filter(js => js.status === 'pending');
  const completedStages = stageJobStages.filter(js => js.status === 'completed');

  return (
    <div className="bg-gray-50 rounded-lg p-4 min-w-[300px] max-w-[350px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium text-sm">{stage.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {stageJobStages.length}
          </Badge>
          {activeStages.length > 0 && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
              {activeStages.length} active
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {activeStages.map(jobStage => (
          <JobStageCard
            key={jobStage.id}
            jobStage={jobStage}
            onStageAction={onStageAction}
          />
        ))}

        {pendingStages.map(jobStage => (
          <JobStageCard
            key={jobStage.id}
            jobStage={jobStage}
            onStageAction={onStageAction}
          />
        ))}

        {completedStages.slice(0, 3).map(jobStage => (
          <JobStageCard
            key={jobStage.id}
            jobStage={jobStage}
            onStageAction={onStageAction}
          />
        ))}

        {stageJobStages.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No jobs in this stage
          </div>
        )}
      </div>
    </div>
  );
};

export const MultiStageKanban = () => {
  const { jobs, isLoading: jobsLoading, error: jobsError, fetchJobs } = useProductionJobs();
  const { stages } = useProductionStages();
  
  // CRITICAL: Filter out completed jobs for kanban view
  const activeJobs = React.useMemo(() => {
    return filterActiveJobs(jobs);
  }, [jobs]);
  
  const { 
    jobStages, 
    isLoading, 
    error, 
    lastUpdate,
    startStage, 
    completeStage, 
    refreshStages,
    getStageMetrics 
  } = useRealTimeJobStages(activeJobs); // Pass only active jobs

  const handleStageAction = async (stageId: string, action: 'start' | 'complete' | 'scan') => {
    console.log(`Stage action: ${action} on stage ${stageId}`);
    
    try {
      if (action === 'start') {
        await startStage(stageId);
      } else if (action === 'complete') {
        await completeStage(stageId);
      } else if (action === 'scan') {
        toast.info('QR Scanner would open here');
      }

      // Refresh jobs to update status
      fetchJobs();
    } catch (err) {
      console.error('Error performing stage action:', err);
    }
  };

  if (jobsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading multi-stage kanban...</span>
      </div>
    );
  }

  if (jobsError || error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Error loading multi-stage kanban</p>
              <p className="text-sm mt-1">{jobsError || error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const metrics = getStageMetrics();

  console.log("🔍 MultiStageKanban - Active Jobs Only:", {
    totalJobs: jobs.length,
    activeJobs: activeJobs.length,
    jobStages: jobStages.length,
    metrics
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Multi-Stage Production Workflow</h2>
            <p className="text-gray-600">Real-time view of active jobs across all production stages</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                refreshStages();
                fetchJobs();
              }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configure
            </Button>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-5 gap-4">
          <Card className="p-3">
            <div className="text-2xl font-bold text-blue-600">{metrics.uniqueJobs}</div>
            <div className="text-sm text-gray-600">Active Jobs</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-green-600">{metrics.activeStages}</div>
            <div className="text-sm text-gray-600">Active Stages</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-yellow-600">{metrics.pendingStages}</div>
            <div className="text-sm text-gray-600">Pending Stages</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-purple-600">{stages.filter(s => s.is_active).length}</div>
            <div className="text-sm text-gray-600">Production Stages</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm font-medium">{lastUpdate.toLocaleTimeString()}</div>
          </Card>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6">
        {stages
          .filter(stage => stage.is_active)
          .sort((a, b) => a.order_index - b.order_index)
          .map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              jobStages={jobStages}
              onStageAction={handleStageAction}
            />
          ))}
      </div>

      {activeJobs.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-gray-500 text-lg">No active jobs found</p>
            <p className="text-gray-400">All jobs have been completed</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
