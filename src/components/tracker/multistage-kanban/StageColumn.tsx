
import React, { useEffect } from "react";
import JobStageCard from "./JobStageCard";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  stage: any;
  jobStages: any[];
  onStageAction: (stageId: string, action: "start" | "complete" | "scan") => void;
  viewMode: "card" | "list";
  enableDnd?: boolean;
  onReorder?: (orderedIds: string[]) => void;
  registerReorder?: (fn: (newOrder: string[]) => void) => void;
  selectedJobId?: string | null;
  onSelectJob?: (jobId: string) => void;
};

const StageColumn: React.FC<Props> = ({
  stage,
  jobStages,
  onStageAction,
  viewMode,
  enableDnd,
  onReorder,
  registerReorder,
  selectedJobId,
  onSelectJob,
}) => {
  const stageJobStages = jobStages
    .filter(js => js.production_stage_id === stage.id)
    .sort((a, b) =>
      a.job_order_in_stage && b.job_order_in_stage
        ? (a.job_order_in_stage - b.job_order_in_stage)
        : (a.production_job?.wo_no || "").localeCompare(b.production_job?.wo_no || "")
    );

  // Register reorder handler for this column to parent via ref when DnD is enabled
  useEffect(() => {
    if (enableDnd && registerReorder && onReorder) {
      registerReorder(onReorder);
    }
  // eslint-disable-next-line
  }, [enableDnd, onReorder, registerReorder]);

  // Helper: is this job selected by work order id?
  const isJobHighlighted = (jobStage: any) => (
    selectedJobId && jobStage.production_job?.id === selectedJobId
  );

  // --- Card & DnD view ---
  if (viewMode === "card" && enableDnd) {
    return (
      <SortableContext
        items={stageJobStages.map(jobStage => jobStage.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className="bg-gray-50 rounded-lg p-2 min-w-[330px] max-w-full flex flex-col h-[calc(80vh-90px)]"
          style={{ width: 'auto' }}
        >
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
            <div className="flex flex-col gap-2">
              {stageJobStages.map(jobStage => (
                <SortableJobStageCard
                  key={jobStage.id}
                  jobStage={jobStage}
                  onStageAction={onStageAction}
                  onClick={() => onSelectJob && onSelectJob(jobStage.production_job?.id)}
                  highlighted={isJobHighlighted(jobStage)}
                />
              ))}
            </div>
            {stageJobStages.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs">No jobs</div>
            )}
          </div>
        </div>
      </SortableContext>
    );
  }

  // --- Table/List view ---
  return (
    <div
      className="bg-gray-50 rounded-lg p-2 min-w-[330px] max-w-full flex flex-col h-[calc(80vh-90px)]"
      style={{ width: 'auto' }}
    >
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
              <div
                key={jobStage.id}
                className={isJobHighlighted(jobStage) ? "ring-2 ring-green-500 rounded-lg transition" : ""}
                onClick={() => onSelectJob && onSelectJob(jobStage.production_job?.id)}
                tabIndex={0}
                style={{ cursor: "pointer" }}
              >
                <JobStageCard jobStage={jobStage} onStageAction={onStageAction} />
              </div>
            ))}
            {stageJobStages.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs">No jobs</div>
            )}
          </div>
        ) : (
          <table className="w-auto text-[13px] min-w-max" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left px-1 py-1 font-normal whitespace-nowrap">WO</th>
                <th className="text-left px-1 py-1 font-normal whitespace-nowrap w-[160px] max-w-[180px]">Customer</th>
                <th className="text-left px-1 py-1 font-normal whitespace-nowrap">Status</th>
                <th className="text-left px-1 py-1 font-normal whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {stageJobStages.map(jobStage => (
                <tr
                  key={jobStage.id}
                  className={
                    "hover:bg-green-50 transition group " +
                    (isJobHighlighted(jobStage) ? "ring-2 ring-green-500 rounded" : "")
                  }
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectJob && onSelectJob(jobStage.production_job?.id)}
                  tabIndex={0}
                >
                  <td className="px-1 whitespace-nowrap">{jobStage.production_job?.wo_no}</td>
                  <td className="px-1 whitespace-nowrap max-w-[180px] truncate" style={{ width: "160px" }}>
                    {jobStage.production_job?.customer}
                  </td>
                  <td className="px-1 whitespace-nowrap">
                    <span className={`inline-flex rounded px-1 text-xs ${jobStage.status === "active" ? "bg-blue-100 text-blue-700" : jobStage.status === "pending" ? "bg-yellow-50 text-yellow-800" : "bg-gray-100"}`}>
                      {jobStage.status}
                    </span>
                  </td>
                  <td className="px-1">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {jobStage.status === "pending" && (
                        <button title="Start" onClick={e => { e.stopPropagation(); onStageAction(jobStage.id, "start"); }} className="text-green-600 hover:text-green-700">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor" /></svg>
                        </button>
                      )}
                      {jobStage.status === "active" && (
                        <button title="Complete" onClick={e => { e.stopPropagation(); onStageAction(jobStage.id, "complete"); }} className="text-blue-600 hover:text-green-700">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
const SortableJobStageCard: React.FC<{ jobStage: any; onStageAction: any; onClick?: () => void; highlighted?: boolean }> = ({ jobStage, onStageAction, onClick, highlighted }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: jobStage.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: "pointer",
    outline: highlighted ? "2px solid #22c55e" : undefined, // Tailwind green-500
    borderRadius: highlighted ? 8 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick} tabIndex={0}>
      <JobStageCard jobStage={jobStage} onStageAction={onStageAction} />
    </div>
  );
};

export default StageColumn;
