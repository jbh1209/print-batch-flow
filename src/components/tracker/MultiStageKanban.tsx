
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Loader2, 
  AlertTriangle, 
  Settings, 
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
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
import { MultiStageKanbanColumnsProps } from "./MultiStageKanban.types";

export const MultiStageKanban = () => {
  const { jobs, isLoading: jobsLoading, error: jobsError, refreshJobs } = useAccessibleJobs({
    permissionType: 'manage'
  });
  const { stages } = useProductionStages();

  // CRITICAL: Filter out completed jobs for kanban view
  const activeJobs = React.useMemo(() => {
    // AccessibleJobs already filters for active jobs, but we can add extra safety
    return jobs.filter(job => job.status !== 'Completed');
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
  } = useRealTimeJobStages(activeJobs);

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
      refreshJobs();
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
    refreshJobs();
  };

  // Use a ref to hold per-stage reorder handlers, for the drag-end logic below
  const reorderRefs = React.useRef<Record<string, (newOrder: string[]) => void>>({});

  // ----- DND SETUP -----
  // Only used for 'card' view mode
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
      <MultiStageKanbanHeader
        metrics={{
          uniqueJobs: metrics.uniqueJobs,
          activeStages: metrics.activeStages,
          pendingStages: metrics.pendingStages,
        }}
        lastUpdate={lastUpdate}
        onRefresh={() => { refreshStages(); refreshJobs(); }}
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
        layout={layout}
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
