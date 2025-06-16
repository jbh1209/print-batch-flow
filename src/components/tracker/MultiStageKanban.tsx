
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Loader2, 
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { useRealTimeJobStages } from "@/hooks/tracker/useRealTimeJobStages";
import { filterActiveJobs } from "@/utils/tracker/jobCompletionUtils";
import StageColumn from "./multistage-kanban/StageColumn";
import ColumnViewToggle from "./multistage-kanban/ColumnViewToggle";
import { arrayMove } from "@/utils/tracker/reorderUtils";
import { supabase } from "@/integrations/supabase/client";

// DnD kit
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { MultiStageKanbanHeader } from "./MultiStageKanbanHeader";
import { MultiStageKanbanColumns } from "./MultiStageKanbanColumns";

interface MultiStageKanbanProps {
  jobs: any[];
  stages: any[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh: () => void;
}

export const MultiStageKanban = ({ jobs, stages, isLoading, error, onRefresh }: MultiStageKanbanProps) => {
  // CRITICAL: Filter out completed jobs for kanban view
  const activeJobs = React.useMemo(() => {
    return filterActiveJobs(jobs);
  }, [jobs]);
  
  const { 
    jobStages, 
    isLoading: stagesLoading, 
    error: stagesError, 
    lastUpdate,
    startStage, 
    completeStage, 
    refreshStages,
    getStageMetrics 
  } = useRealTimeJobStages(activeJobs); // Pass only active jobs

  // ---- NEW: Layout selector ----
  const [layout, setLayout] = React.useState<"horizontal" | "vertical">("horizontal");

  // --- GLOBAL VIEW MODE TOGGLE ---
  const [viewMode, setViewMode] = React.useState<"card" | "list">("list");

  // Highlighted job selection (for cross-column highlighting)
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);

  const handleViewModeChange = (mode: "card" | "list") => setViewMode(mode);

  // When a job stage card/row is clicked, select by job_id. Clicking again will unselect.
  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(prev =>
      prev === jobId ? null : jobId
    );
  };

  const handleStageAction = async (stageId: string, action: 'start' | 'complete' | 'scan') => {
    try {
      if (action === 'start') await startStage(stageId);
      else if (action === 'complete') await completeStage(stageId);
      else if (action === 'scan') toast.info('QR Scanner would open here');
      onRefresh();
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
    onRefresh();
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
          <div className="flex gap-3 overflow-x-auto pb-2">
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
                  selectedJobId={selectedJobId}
                  onSelectJob={handleSelectJob}
                />
              ))}
          </div>
        </DndContext>
      );
    }
    // For list view, simple rendering
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
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
              selectedJobId={selectedJobId}
              onSelectJob={handleSelectJob}
            />
          ))}
      </div>
    );
  };

  if (isLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading multi-stage kanban...</span>
      </div>
    );
  }

  if (error || stagesError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Error loading multi-stage kanban</p>
              <p className="text-sm mt-1">{error || stagesError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const metrics = getStageMetrics();

  return (
    <div className="p-2">
      <MultiStageKanbanHeader
        metrics={{
          uniqueJobs: metrics.uniqueJobs,
          activeStages: metrics.activeStages,
          pendingStages: metrics.pendingStages,
        }}
        lastUpdate={lastUpdate}
        onRefresh={() => { refreshStages(); onRefresh(); }}
        onSettings={() => {}}
        // New layout props:
        layout={layout}
        onLayoutChange={value => setLayout(value)}
      >
        <ColumnViewToggle viewMode={viewMode} onChange={setViewMode} />
      </MultiStageKanbanHeader>

      <MultiStageKanbanColumns
        stages={stages}
        jobStages={jobStages}
        reorderRefs={reorderRefs}
        handleStageAction={handleStageAction}
        viewMode={viewMode}
        enableDnd={viewMode === "card"}
        handleReorder={handleReorder}
        selectedJobId={selectedJobId}
        onSelectJob={handleSelectJob}
        layout={layout} // passes new layout arg
      />

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
export default MultiStageKanban;
