
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
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";

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
  // Use enhanced production jobs hook instead of context
  const { 
    jobs, 
    isLoading, 
    error, 
    refreshJobs,
    startStage,
    completeStage 
  } = useEnhancedProductionJobs({ fetchAllJobs: true });

  // Get stages from props (they come from context in parent)
  const stages = propsStages;

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

  const handleStageAction = async (jobId: string, stageId: string, action: 'start' | 'complete' | 'scan') => {
    try {
      if (action === 'start') await startStage(jobId, stageId);
      else if (action === 'complete') await completeStage(jobId, stageId);
      else if (action === 'scan') toast.info('QR Scanner would open here');
      // Refresh after action
      await refreshJobs();
    } catch (err) {
      console.error('Error performing stage action:', err);
    }
  };

  // Per-stage reorder handlers
  const handleReorder = async (stageId: string, newOrderIds: string[]) => {
    // Find jobs for this stage and update their order
    const stageJobs = activeJobs.filter(job => job.current_stage_id === stageId);
    const updates = newOrderIds.map((jobId, idx) => {
      const job = stageJobs.find(j => j.id === jobId);
      if (!job) return null;
      
      // Find the current stage instance for this job
      const currentStageInstance = job.job_stage_instances?.find(
        jsi => jsi.production_stage_id === stageId && jsi.status === 'active'
      ) || job.job_stage_instances?.find(
        jsi => jsi.production_stage_id === stageId && jsi.status === 'pending'
      );
      
      if (!currentStageInstance) return null;
      
      return {
        id: currentStageInstance.id,
        job_id: job.id,
        job_table_name: 'production_jobs',
        production_stage_id: stageId,
        stage_order: currentStageInstance.stage_order,
        job_order_in_stage: idx + 1,
        status: currentStageInstance.status,
      };
    }).filter(Boolean);

    try {
      const { error } = await supabase
        .from("job_stage_instances")
        .upsert(updates, { onConflict: "id" });
      if (error) toast.error("Failed to persist job order");
      await refreshJobs();
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

  // Calculate metrics from unique jobs
  const metrics = {
    uniqueJobs: activeJobs.length,
    activeStages: activeJobs.filter(job => job.is_active).length,
    pendingStages: activeJobs.filter(job => job.is_pending).length,
  };

  return (
    <div className="p-2">
      <MultiStageKanbanHeader
        metrics={metrics}
        lastUpdate={new Date()}
        onRefresh={refreshJobs}
        onSettings={() => {}}
        // New layout props:
        layout={layout}
        onLayoutChange={value => setLayout(value)}
      >
        <ColumnViewToggle viewMode={viewMode} onChange={setViewMode} />
      </MultiStageKanbanHeader>

      <MultiStageKanbanColumns
        stages={stages}
        jobs={activeJobs}
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
