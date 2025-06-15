
import React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { useKanbanDnDContext } from "./useKanbanDnDContext";
import StageColumn from "./multistage-kanban/StageColumn";
import { MultiStageKanbanColumnsProps } from "./MultiStageKanban.types";

// Add layout prop type
type LayoutType = "horizontal" | "vertical";
interface MultiStageKanbanColumnsWithLayoutProps extends MultiStageKanbanColumnsProps {
  layout?: LayoutType;
}

export const MultiStageKanbanColumns: React.FC<MultiStageKanbanColumnsWithLayoutProps> = ({
  stages,
  jobStages,
  reorderRefs,
  handleStageAction,
  viewMode,
  enableDnd,
  handleReorder,
  selectedJobId,
  onSelectJob,
  layout = "horizontal", // default
}) => {
  // Layout classes
  const horizontalClass =
    "grid gap-3 overflow-x-auto pb-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
  const verticalClass =
    "flex flex-col gap-3 overflow-y-auto pb-2 max-h-[calc(80vh-80px)]"; // stacked: vertical

  if (viewMode === "card" && enableDnd) {
    const { sensors, onDragEnd } = useKanbanDnDContext({
      stages, jobStages, reorderRefs, handleReorder
    });

    if (layout === "vertical") {
      return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className={verticalClass} style={{ minWidth: 280 }}>
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
    // horizontal (default)
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className={horizontalClass}>
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
  // List view fallback: Layout switch works for both card/list
  if (layout === "vertical") {
    return (
      <div className={verticalClass} style={{ minWidth: 280 }}>
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
  }
  // Horizontal (default)
  return (
    <div className={horizontalClass}>
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

