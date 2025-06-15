import React from "react";
import JobStageCard from "./JobStageCard";
import ColumnViewToggle from "./ColumnViewToggle";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";

type Props = {
  stage: any;
  jobStages: any[];
  onStageAction: (stageId: string, action: "start" | "complete" | "scan") => void;
  viewMode: "card" | "list";
  enableDnd?: boolean;
  onReorder?: (orderedIds: string[]) => void;
};

const StageColumn: React.FC<Props> = ({
  stage,
  jobStages,
  onStageAction,
  viewMode,
  enableDnd,
  onReorder,
}) => {
  // Sort by job_order_in_stage then fallback to original (to handle legacy rows)
  const stageJobStages = jobStages
    .filter(js => js.production_stage_id === stage.id)
    .sort((a, b) => (a.job_order_in_stage ?? 1) - (b.job_order_in_stage ?? 1) || a.stage_order - b.stage_order);

  const activeStages = stageJobStages.filter(js => js.status === "active");
  const pendingStages = stageJobStages.filter(js => js.status === "pending");
  const completedStages = stageJobStages.filter(js => js.status === "completed");

  // DND setup for card view
  if (viewMode === "card" && enableDnd) {
    return (
      <SortableContext
        items={stageJobStages.map(jobStage => jobStage.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="bg-gray-50 rounded-lg p-2 min-w-[260px] max-w-full flex flex-col h-[calc(80vh-90px)]" style={{width: 'auto'}}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
              <span className="font-medium text-xs">{stage.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="bg-gray-100 text-xs px-1 rounded">{stageJobStages.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DndContext
              sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))}
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (over && active.id !== over.id) {
                  const oldIndex = stageJobStages.findIndex(js => js.id === active.id);
                  const newIndex = stageJobStages.findIndex(js => js.id === over.id);
                  if (onReorder) {
                    // Array in new order
                    const reordered = [...stageJobStages];
                    const moved = reordered.splice(oldIndex, 1)[0];
                    reordered.splice(newIndex, 0, moved);
                    onReorder(reordered.map(js => js.id));
                  }
                }
              }}
            >
              <div className="flex flex-col gap-2">
                {stageJobStages.map(jobStage => (
                  <SortableJobStageCard
                    key={jobStage.id}
                    jobStage={jobStage}
                    onStageAction={onStageAction}
                  />
                ))}
              </div>
              {stageJobStages.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-xs">No jobs</div>
              )}
            </DndContext>
          </div>
        </div>
      </SortableContext>
    );
  }

  // Default (non-DND) column
  return (
    <div className="bg-gray-50 rounded-lg p-2 min-w-[260px] max-w-full flex flex-col h-[calc(80vh-90px)]" style={{width: 'auto'}}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="font-medium text-xs">{stage.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="bg-gray-100 text-xs px-1 rounded">{stageJobStages.length}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {viewMode === "card" ? (
          <div className="flex flex-col gap-2">
            {stageJobStages.map(jobStage => (
              <JobStageCard key={jobStage.id} jobStage={jobStage} onStageAction={onStageAction} />
            ))}
            {stageJobStages.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs">No jobs</div>
            )}
          </div>
        ) : (
          <table className="w-auto text-[13px] min-w-max" style={{tableLayout: 'auto'}}>
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left px-1 py-1 font-normal whitespace-nowrap">WO</th>
                <th className="text-left px-1 py-1 font-normal whitespace-nowrap">Customer</th>
                <th className="text-left px-1 py-1 font-normal whitespace-nowrap">Status</th>
                <th className="text-left px-1 py-1 font-normal whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {stageJobStages.map(jobStage => (
                <tr key={jobStage.id} className="hover:bg-green-50 transition group">
                  <td className="px-1 whitespace-nowrap">{jobStage.production_job?.wo_no}</td>
                  <td className="px-1 whitespace-nowrap max-w-none">{jobStage.production_job?.customer}</td>
                  <td className="px-1 whitespace-nowrap">
                    <span className={`inline-flex rounded px-1 text-xs ${jobStage.status === "active" ? "bg-blue-100 text-blue-700" : jobStage.status === "pending" ? "bg-yellow-50 text-yellow-800" : "bg-gray-100"}`}>
                      {jobStage.status}
                    </span>
                  </td>
                  <td className="px-1">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {jobStage.status === "pending" && (
                        <button title="Start" onClick={()=>onStageAction(jobStage.id,"start")} className="text-green-600 hover:text-green-700">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>
                        </button>
                      )}
                      {jobStage.status === "active" && (
                        <button title="Complete" onClick={()=>onStageAction(jobStage.id,"complete")} className="text-blue-600 hover:text-green-700">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {stageJobStages.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-xs text-gray-400">No jobs</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// Sortable wrapper for JobStageCard
const SortableJobStageCard: React.FC<{ jobStage: any; onStageAction: any }> = ({ jobStage, onStageAction }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: jobStage.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <JobStageCard jobStage={jobStage} onStageAction={onStageAction} />
    </div>
  );
};

export default StageColumn;
