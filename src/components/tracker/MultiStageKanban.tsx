
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  AlertTriangle, 
  Settings, 
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { useRealTimeJobStages } from "@/hooks/tracker/useRealTimeJobStages";
import { filterActiveJobs } from "@/utils/tracker/jobCompletionUtils";
import StageColumn from "./multistage-kanban/StageColumn";
import ColumnViewToggle from "./multistage-kanban/ColumnViewToggle";
import { arrayMove } from "@/utils/tracker/reorderUtils";
import { supabase } from "@/integrations/supabase/client";

// DnD kit
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

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

  const handleViewModeChange = (mode: "card" | "list") => setViewMode(mode);

  const handleStageAction = async (stageId: string, action: 'start' | 'complete' | 'scan') => {
    try {
      if (action === 'start') await startStage(stageId);
      else if (action === 'complete') await completeStage(stageId);
      else if (action === 'scan') toast.info('QR Scanner would open here');
      fetchJobs();
    } catch (err) {
      console.error('Error performing stage action:', err);
    }
  };

  // Per-stage reorder handlers
  const handleReorder = async (stageId: string, newOrderIds: string[]) => {
    const updates = newOrderIds.map((jobStageId, idx) => {
      const jobStage = jobStages.find(js => js.id === jobStageId);
      if (!jobStage) throw new Error("JobStage not found for id: " + jobStageId);
      return {
        id: jobStage.id,
        job_id: jobStage.job_id,
        job_table_name: jobStage.job_table_name,
        production_stage_id: jobStage.production_stage_id,
        stage_order: jobStage.stage_order,
        job_order_in_stage: idx + 1,
        status: jobStage.status,
      };
    });
    try {
      const { error } = await supabase
        .from("job_stage_instances")
        .upsert(updates, { onConflict: "id" });
      if (error) toast.error("Failed to persist job order");
    } catch (e) {
      toast.error("Failed to persist job order: " + (e instanceof Error ? e.message : String(e)));
    }
    refreshStages();
    fetchJobs();
  };

  // Use a ref to hold per-stage reorder handlers, for the drag-end logic below
  const reorderRefs = React.useRef<Record<string, (newOrder: string[]) => void>>({});

  // ----- DND SETUP -----
  // Only used for 'card' view mode
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Only in 'card' view, wrap all StageColumns in a top-level DndContext
  const renderColumns = () => {
    if (viewMode === "card") {
      // For each stage, need to register a ref to its reorder function
      reorderRefs.current = {};
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={event => {
            // Find which column (stageId) this drag occurred in
            for (const stage of stages.filter(s => s.is_active)) {
              const colJobStages = jobStages.filter(js => js.production_stage_id === stage.id)
                .sort((a, b) => (a.job_order_in_stage ?? 1) - (b.job_order_in_stage ?? 1) || a.stage_order - b.stage_order);
              const jobIds = colJobStages.map(js => js.id);
              // If both active/over ids in this column, process reorder
              if (
                jobIds.includes(event.active.id as string) &&
                jobIds.includes(event.over?.id as string)
              ) {
                const oldIndex = jobIds.indexOf(event.active.id as string);
                const newIndex = jobIds.indexOf(event.over?.id as string);
                if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                  const newOrder = arrayMove(jobIds, oldIndex, newIndex);
                  reorderRefs.current[stage.id]?.(newOrder);
                }
                break;
              }
            }
          }}
        >
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
                  enableDnd
                  onReorder={order => {
                    reorderRefs.current[stage.id] = order => handleReorder(stage.id, order);
                    return handleReorder(stage.id, order);
                  }}
                  registerReorder={fn => { reorderRefs.current[stage.id] = fn; }}
                />
              ))}
          </div>
        </DndContext>
      );
    }
    // For list view, simple rendering
    return (
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
              enableDnd={false}
              onReorder={() => {}} // no-op
            />
          ))}
      </div>
    );
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
      {renderColumns()}
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
