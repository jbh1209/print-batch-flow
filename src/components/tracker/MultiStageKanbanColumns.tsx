
import React from "react";
import StageColumn from "./multistage-kanban/StageColumn";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";

interface MultiStageKanbanColumnsProps {
  stages: any[];
  jobs: any[];
  reorderRefs: React.MutableRefObject<Record<string, (newOrder: string[]) => void>>;
  handleStageAction: (jobId: string, stageId: string, action: "start" | "complete" | "scan") => void;
  viewMode: "card" | "list";
  enableDnd: boolean;
  handleReorder: (stageId: string, newOrderIds: string[]) => void;
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  layout: "horizontal" | "vertical";
}

export const MultiStageKanbanColumns: React.FC<MultiStageKanbanColumnsProps> = ({
  stages,
  jobs,
  reorderRefs,
  handleStageAction,
  viewMode,
  enableDnd,
  handleReorder,
  selectedJobId,
  onSelectJob,
  layout,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find which stage this drag operation belongs to
    const draggedJob = jobs.find(job => job.id === active.id);
    if (!draggedJob) return;

    const stageId = draggedJob.current_stage_id;
    if (!stageId) return;

    // Get all jobs in this stage
    const stageJobs = jobs.filter(job => job.current_stage_id === stageId);
    const oldIndex = stageJobs.findIndex(job => job.id === active.id);
    const newIndex = stageJobs.findIndex(job => job.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = [...stageJobs];
      const [reorderedItem] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, reorderedItem);

      // Call the reorder handler with the new order of job IDs
      handleReorder(stageId, newOrder.map(job => job.id));
    }
  };

  const renderColumns = () => (
    <>
      {stages
        .filter(stage => stage.is_active !== false)
        .map(stage => (
          <StageColumn
            key={stage.id}
            stage={stage}
            jobs={jobs}
            onStageAction={handleStageAction}
            viewMode={viewMode}
            enableDnd={enableDnd}
            onReorder={(newOrder) => handleReorder(stage.id, newOrder)}
            registerReorder={(handler) => {
              reorderRefs.current[stage.id] = handler;
            }}
            selectedJobId={selectedJobId}
            onSelectJob={onSelectJob}
          />
        ))}
    </>
  );

  if (enableDnd && viewMode === "card") {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className={`flex gap-2 ${layout === "vertical" ? "flex-col" : "flex-row"} overflow-auto`}>
          {renderColumns()}
        </div>
      </DndContext>
    );
  }

  return (
    <div className={`flex gap-2 ${layout === "vertical" ? "flex-col" : "flex-row"} overflow-auto`}>
      {renderColumns()}
    </div>
  );
};
