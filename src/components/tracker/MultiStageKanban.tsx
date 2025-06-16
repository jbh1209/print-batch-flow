
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Loader2, 
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { filterActiveJobs } from "@/utils/tracker/jobCompletionUtils";
import StageColumn from "./multistage-kanban/StageColumn";
import ColumnViewToggle from "./multistage-kanban/ColumnViewToggle";
import { arrayMove } from "@/utils/tracker/reorderUtils";
import { supabase } from "@/integrations/supabase/client";
import { useProductionDataContext } from "@/contexts/ProductionDataContext";

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

export const MultiStageKanban = ({ jobs: propsJobs, stages: propsStages, isLoading: propsLoading, error: propsError, onRefresh }: MultiStageKanbanProps) => {
  // Use unified data from context instead of props
  const { 
    jobs, 
    stages, 
    jobStages, 
    isLoading, 
    error, 
    lastUpdated,
    startStage, 
    completeStage, 
    refresh,
    getStageMetrics 
  } = useProductionDataContext();

  // CRITICAL: Filter out completed jobs for kanban view
  const activeJobs = React.useMemo(() => {
    return filterActiveJobs(jobs);
  }, [jobs]);

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
      // No need to call onRefresh as context handles refresh automatically
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
      refresh(); // Use context refresh
    } catch (e) {
      toast.error("Failed to persist job order: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // Use a ref to hold per-stage reorder handlers, for the drag-end logic below
  const reorderRefs = React.useRef<Record<string, (newOrder: string[]) => void>>({});

  // ----- DND SETUP -----
  // Only used for 'card' view mode
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading multi-stage kanban...</span>
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
              <p className="font-medium">Error loading multi-stage kanban</p>
              <p className="text-sm mt-1">{error}</p>
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
        lastUpdate={lastUpdated}
        onRefresh={refresh}
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
