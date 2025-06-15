
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
import StageColumn from "./multistage-kanban/StageColumn";
import ColumnViewToggle from "./multistage-kanban/ColumnViewToggle";

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

  // --- GLOBAL VIEW MODE TOGGLE ---
  const [viewMode, setViewMode] = React.useState<"card" | "list">("list");

  const handleViewModeChange = (mode: "card" | "list") => {
    setViewMode(mode);
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

  // --- Placeholder for future smart automation code ---
  // useEffect(() => {
  //   if (viewMode === "card" && jobs && jobs.length && stages) {
  //     // Idea: Suggest grouping jobs based on future paper/printing specs here.
  //     // Example (not active): groupJobsByPaperSpec(jobs)
  //   }
  // }, [viewMode, jobs, stages]);
  // --- End Placeholder ---

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
            <ColumnViewToggle viewMode={viewMode} onChange={handleViewModeChange} />
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
              viewMode={viewMode}
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
