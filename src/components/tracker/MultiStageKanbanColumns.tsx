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
  // Responsive grid: each StageColumn min-w-[280px], grid-flow-col for horizontal scroll, always show scrollbar
  const horizontalClass =
    "flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 min-h-0"
  const verticalClass =
    "flex flex-col gap-3 overflow-y-auto pb-2 max-h-[calc(80vh-80px)]"; // vertical, as before

  // --- Horizontal Scrollbar Decoration ---
  // We rely on native scroll. To always show the scrollbar in modern browsers, ensure overflow-x-auto is present.
  // Optionally, you can use Tailwind's scrollbar utilities for visibility or customize height for thicker bar.

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
                  reorderRef={React.createRef()}
                  selectedJobId={selectedJobId}
                  onSelectJob={onSelectJob}
                />
              ))}
          </div>
        </DndContext>
      );
    }
    // --- Horizontal Scrollable Columns ---
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div
          className={horizontalClass}
          style={{
            WebkitOverflowScrolling: "touch",
            // Always present scrollbar on macOS/Win Chrome/Firefox
            overflowY: "hidden",
            scrollbarWidth: "auto",
          }}
        >
          {stages
            .filter(stage => stage.is_active)
            .sort((a, b) => a.order_index - b.order_index)
            .map(stage => (
              <div key={stage.id} className="min-w-[280px] max-w-[350px] w-full flex-shrink-0">
                <StageColumn
                  stage={stage}
                  jobStages={jobStages}
                  onStageAction={handleStageAction}
                  viewMode={viewMode}
                  enableDnd
                onReorder={order => handleReorder(stage.id, order)}
                reorderRef={React.createRef()}
                  selectedJobId={selectedJobId}
                  onSelectJob={onSelectJob}
                />
              </div>
            ))}
        </div>
      </DndContext>
    );
  }
  // List view fallback: vertical remains unchanged
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
                reorderRef={React.createRef()}
              selectedJobId={selectedJobId}
              onSelectJob={onSelectJob}
            />
          ))}
      </div>
    );
  }
  // --- Horizontal Scrollable Columns (non-DnD/list view) ---
  return (
    <div
      className={horizontalClass}
      style={{
        WebkitOverflowScrolling: "touch",
        overflowY: "hidden",
        scrollbarWidth: "auto",
      }}
    >
      {stages
        .filter(stage => stage.is_active)
        .sort((a, b) => a.order_index - b.order_index)
        .map(stage => (
          <div key={stage.id} className="min-w-[280px] max-w-[350px] w-full flex-shrink-0">
            <StageColumn
              stage={stage}
              jobStages={jobStages}
              onStageAction={handleStageAction}
              viewMode={viewMode}
              enableDnd={false}
              onReorder={() => {}}
              reorderRef={React.createRef()}
              selectedJobId={selectedJobId}
              onSelectJob={onSelectJob}
            />
          </div>
        ))}
    </div>
  );
};
