
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

// --- NEW: ColumnViewToggle ---
const ColumnViewToggle = ({
  viewMode,
  onChange,
}: {
  viewMode: "card" | "list";
  onChange: (mode: "card" | "list") => void;
}) => (
  <div className="flex gap-1 items-center">
    <button
      className={`p-1 rounded ${viewMode === "card" ? "bg-green-200" : "bg-gray-100"} text-xs`}
      title="Card View"
      onClick={() => onChange("card")}
    >
      <svg width={16} height={16} viewBox="0 0 16 16" className="inline"><rect x="1" y="1" width="6" height="6" rx="1" fill={viewMode==="card"?"#22c55e":"#e5e7eb"}/><rect x="9" y="1" width="6" height="6" rx="1" fill={viewMode==="card"?"#22c55e":"#e5e7eb"}/><rect x="1" y="9" width="6" height="6" rx="1" fill={viewMode==="card"?"#22c55e":"#e5e7eb"}/><rect x="9" y="9" width="6" height="6" rx="1" fill={viewMode==="card"?"#22c55e":"#e5e7eb"}/></svg>
    </button>
    <button
      className={`p-1 rounded ${viewMode === "list" ? "bg-green-200" : "bg-gray-100"} text-xs`}
      title="List View"
      onClick={() => onChange("list")}
    >
      <svg width={16} height={16} viewBox="0 0 16 16" className="inline"><rect x="2" y="3" width="12" height="2" rx="1" fill={viewMode==="list"?"#22c55e":"#e5e7eb"}/><rect x="2" y="7" width="12" height="2" rx="1" fill={viewMode==="list"?"#22c55e":"#e5e7eb"}/><rect x="2" y="11" width="12" height="2" rx="1" fill={viewMode==="list"?"#22c55e":"#e5e7eb"}/></svg>
    </button>
  </div>
);

// --- Timer: Single instance ---
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

// --- Job Stage Card: Single instance ---
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

// --- Main Kanban Component ---
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

  // --- NEW: Per-column view state ---
  const [columnViews, setColumnViews] = React.useState<Record<string, "card" | "list">>(
    {}
  );
  const handleColumnViewChange = (stageId: string, mode: "card" | "list") => {
    setColumnViews((prev) => ({ ...prev, [stageId]: mode }));
  };

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

  // --- COMPACT HEADER IMPLEMENTATION ---
  return (
    <div className="p-2">
      <div className="mb-2">
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4">
          <div className="flex flex-col gap-0">
            <h2 className="text-lg font-bold leading-5">Multi-Stage Kanban</h2>
            <span className="text-xs text-gray-600">Active jobs in production stages</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 rounded text-blue-700">
              {metrics.uniqueJobs} jobs
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 rounded text-green-700">
              {metrics.activeStages} active stages
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-yellow-100 rounded text-yellow-700">
              {metrics.pendingStages} pending
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-100 rounded text-purple-700">
              {metrics.activeStages + metrics.pendingStages} total stages
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500">
              Last: {lastUpdate.toLocaleTimeString()}
            </span>
            <Button 
              variant="outline" size="sm"
              onClick={() => { refreshStages(); fetchJobs(); }}
              className="px-2 h-7"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="px-2 h-7">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {stages
          .filter(stage => stage.is_active)
          .sort((a, b) => a.order_index - b.order_index)
          .map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              jobStages={jobStages}
              onStageAction={handleStageAction}
              viewMode={columnViews[stage.id] || "card"}
              onViewModeChange={(mode) => handleColumnViewChange(stage.id, mode)}
            />
          ))}
      </div>

      {activeJobs.length === 0 && (
        <Card className="text-center py-6">
          <CardContent>
            <p className="text-gray-500 text-lg">No active jobs found</p>
            <p className="text-gray-400">All jobs have been completed</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// --- UPDATE: StageColumn to include a toggle + list mode ---
const StageColumn = ({
  stage,
  jobStages,
  onStageAction,
  viewMode,
  onViewModeChange,
}: {
  stage: any;
  jobStages: any[];
  onStageAction: (stageId: string, action: "start" | "complete" | "scan") => void;
  viewMode: "card" | "list";
  onViewModeChange: (mode: "card" | "list") => void;
}) => {
  const stageJobStages = jobStages.filter(js => js.production_stage_id === stage.id);
  const activeStages = stageJobStages.filter(js => js.status === "active");
  const pendingStages = stageJobStages.filter(js => js.status === "pending");
  const completedStages = stageJobStages.filter(js => js.status === "completed");

  // --- COMPACT LIST MODE RENDERING ---
  return (
    <div className={`bg-gray-50 rounded-lg p-2 min-w-[210px] max-w-[240px] flex flex-col h-[calc(80vh-90px)]`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="font-medium text-xs">{stage.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="bg-gray-100 text-xs px-1 rounded">{stageJobStages.length}</span>
          <ColumnViewToggle viewMode={viewMode} onChange={onViewModeChange} />
        </div>
      </div>
      <div className={`flex-1 overflow-y-auto`}>
        {viewMode === "card" ? (
          <div className="space-y-2">
            {activeStages.map(jobStage => (
              <JobStageCard key={jobStage.id} jobStage={jobStage} onStageAction={onStageAction} />
            ))}
            {pendingStages.map(jobStage => (
              <JobStageCard key={jobStage.id} jobStage={jobStage} onStageAction={onStageAction} />
            ))}
            {completedStages.slice(0, 3).map(jobStage => (
              <JobStageCard key={jobStage.id} jobStage={jobStage} onStageAction={onStageAction} />
            ))}
            {stageJobStages.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs">No jobs</div>
            )}
          </div>
        ) : (
          // --- List Mode ---
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left px-1 py-1 font-normal">WO</th>
                <th className="text-left px-1 py-1 font-normal">Customer</th>
                <th className="text-left px-1 py-1 font-normal">Status</th>
                <th className="text-left px-1 py-1 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {[...activeStages, ...pendingStages, ...completedStages.slice(0,3)].map(jobStage => (
                <tr key={jobStage.id} className="hover:bg-green-50 transition group">
                  <td className="px-1">{jobStage.production_job?.wo_no}</td>
                  <td className="px-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{jobStage.production_job?.customer}</td>
                  <td className="px-1">
                    <span className={`inline-flex rounded px-1 text-xs ${jobStage.status === "active" ? "bg-blue-100 text-blue-700" : jobStage.status === "pending" ? "bg-yellow-50 text-yellow-800" : "bg-gray-100"}`}>
                      {jobStage.status}
                    </span>
                  </td>
                  <td className="px-1">
                    {/* Show tiny action buttons on hover */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {jobStage.status === "pending" && (
                        <button title="Start" onClick={()=>onStageAction(jobStage.id,"start")} className="text-green-600 hover:text-green-700">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>
                        </button>
                      )}
                      {jobStage.status === "active" && (
                        <button title="Complete" onClick={()=>onStageAction(jobStage.id,"complete")} className="text-blue-600 hover:text-green-700">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {stageJobStages.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-xs text-gray-400">No jobs</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// --- CHANGES END ---
