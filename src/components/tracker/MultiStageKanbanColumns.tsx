import React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { useKanbanDnDContext } from "./useKanbanDnDContext";
import StageColumn from "./multistage-kanban/StageColumn";
import { MultiStageKanbanColumnsProps } from "./MultiStageKanban.types";

export const MultiStageKanbanColumns: React.FC<MultiStageKanbanColumnsProps> = ({
  stages,
  jobStages,
  reorderRefs,
  handleStageAction,
  viewMode,
  enableDnd,
  handleReorder,
  selectedJobId,
  onSelectJob
}) => {
  if (viewMode === "card" && enableDnd) {
    const { sensors, onDragEnd } = useKanbanDnDContext({
      stages, jobStages, reorderRefs, handleReorder
    });
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="grid gap-3 overflow-x-auto pb-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
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
                onReorder={order => handleReorder(stage.id, order)}
                registerReorder={fn => { reorderRefs.current[stage.id] = fn; }}
                selectedJobId={selectedJobId}
                onSelectJob={onSelectJob}
              />
            ))}
        </div>
      </DndContext>
    );
  }
  // List view fallback
  return (
    <div className="grid gap-3 overflow-x-auto pb-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
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
            onReorder={() => {}}
            selectedJobId={selectedJobId}
            onSelectJob={onSelectJob}
          />
        ))}
    </div>
  );
};
