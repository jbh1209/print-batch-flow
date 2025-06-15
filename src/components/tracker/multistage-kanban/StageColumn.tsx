import React, { useEffect } from "react";
import JobStageCard from "./JobStageCard";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getDueStatusColor } from "@/utils/tracker/trafficLightUtils";

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

  // --- MODIFIED: Filtering & warning logic for due dates ---
  // Filtering: show jobs in this column if their stage instance production_stage_id matches stage.id, regardless of due date or status (allow overdue, missing due, etc)
  const stageJobStages = jobStages
    .filter(js => js.production_stage_id === stage.id)
    .sort((a, b) => {
      // Use explicit order in stage, fallback to work order number
      if (a.job_order_in_stage && b.job_order_in_stage) {
        return a.job_order_in_stage - b.job_order_in_stage;
      }
      // fallback to wo_no if job_order not set
      const aWo = a.production_job?.wo_no || "";
      const bWo = b.production_job?.wo_no || "";
      return aWo.localeCompare(bWo, undefined, { numeric: true });
    });

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

  // --- MODIFIED: Add warning if due date is missing and guard against undefined production_job ---
  function getDueInfo(jobStage: any) {
    const hasProductionJob = !!jobStage.production_job;
    if (!hasProductionJob) {
      // Log to console only ONCE per missing production_job, to avoid flooding
      if (jobStage._warned !== true) {
        console.warn(
          "⛔ Kanban: Stage instance missing production_job",
          jobStage
        );
        jobStage._warned = true; // mark so we don't repeat
      }
      return {
        color: "#F59E42", // amber-400
        label: "Job not found",
        code: "yellow",
        warning: true
      };
    }
    const due = jobStage.production_job?.due_date;
    const sla = jobStage.production_job?.sla_target_days ?? 3;
    if (!due) {
      return {
        color: "#F59E42", // amber-400
        label: "Missing Due Date",
        code: "yellow",
        warning: true
      };
    }
    return { ...getDueStatusColor(due, sla), warning: false };
  }

  // --- Card & DnD view ---
  if (viewMode === "card" && enableDnd) {
    return (
      <SortableContext
        items={stageJobStages.map(jobStage => jobStage.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className="bg-gray-50 rounded-lg p-2 min-w-[350px] max-w-full flex flex-col h-[calc(80vh-90px)]"
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
              {stageJobStages.map(jobStage => {
                const dueMeta = getDueInfo(jobStage);
                // Null-safe: Always check production_job exists before rendering job info
                const woNo = jobStage.production_job?.wo_no ?? "Orphaned";
                const dueDateDisplay = jobStage.production_job?.due_date ?? "No Due";
                return (
                  <div
                    key={jobStage.id}
                    className={`relative ${isJobHighlighted(jobStage) ? "ring-2 ring-green-500 rounded-lg transition" : ""}`}
                    onClick={() => onSelectJob && jobStage.production_job?.id && onSelectJob(jobStage.production_job.id)}
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="absolute left-2 top-2 flex items-center z-10">
                      <span
                        className="inline-block rounded-full mr-1"
                        style={{ width: 12, height: 12, background: dueMeta.color, border: dueMeta.warning ? "2px dashed #F59E42" : undefined }}
                        title={dueMeta.label}
                      />
                    </div>
                    <JobStageCard jobStage={jobStage} onStageAction={onStageAction} />
                    <div className="absolute right-2 top-2">
                      {jobStage.production_job?.due_date ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                          style={{
                            background: dueMeta.color,
                            minWidth: 60,
                            display: 'inline-block',
                            textAlign: 'center'
                          }}
                          title={`Due: ${jobStage.production_job.due_date}`}
                        >
                          {jobStage.production_job.due_date}
                        </span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white"
                          style={{
                            minWidth: 60,
                            display: 'inline-block',
                            textAlign: 'center'
                          }}
                          title="No due date: will be automatically set soon or needs repair"
                        >No Due</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {stageJobStages.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-xs">No jobs</div>
              )}
            </div>
          </div>
        </div>
      </SortableContext>
    );
  }

  // --- Table/List view ---
  return (
    <div
      className="bg-gray-50 rounded-lg p-2 min-w-[350px] max-w-full flex flex-col h-[calc(80vh-90px)]"
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
        <table className="w-auto text-[13px] min-w-max" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="text-xs text-gray-500 border-b">
              <th className="text-left px-1 py-1 font-normal whitespace-nowrap">WO</th>
              <th className="text-left px-1 py-1 font-normal whitespace-nowrap w-[160px] max-w-[220px]">Customer</th>
              <th className="text-left px-1 py-1 font-normal whitespace-nowrap">Due</th>
              <th className="text-left px-1 py-1 font-normal whitespace-nowrap">Status</th>
              <th className="text-left px-1 py-1 font-normal whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {stageJobStages.map(jobStage => {
              const dueMeta = getDueInfo(jobStage);
              const woNo = jobStage.production_job?.wo_no ?? "Orphaned";
              const customer = jobStage.production_job?.customer ?? "Unknown";
              return (
                <tr
                  key={jobStage.id}
                  className={
                    "hover:bg-green-50 transition group " +
                    (isJobHighlighted(jobStage) ? "ring-2 ring-green-500 rounded" : "")
                  }
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectJob && jobStage.production_job?.id && onSelectJob(jobStage.production_job.id)}
                  tabIndex={0}
                >
                  <td className="px-1 whitespace-nowrap flex items-center gap-2">
                    <span
                      className="inline-block rounded-full"
                      style={{ width: 10, height: 10, background: dueMeta.color, border: dueMeta.warning ? "2px dashed #F59E42" : undefined }}
                      title={dueMeta.label}
                    />
                    {woNo}
                  </td>
                  <td className="px-1 whitespace-nowrap max-w-[220px] truncate" style={{ width: "160px" }}>
                    {customer}
                  </td>
                  <td className="px-1 whitespace-nowrap">
                    {jobStage.production_job?.due_date ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{
                          background: dueMeta.color,
                          minWidth: 60,
                          display: 'inline-block',
                          textAlign: 'center'
                        }}
                        title={`Due: ${jobStage.production_job.due_date}`}
                      >
                        {jobStage.production_job.due_date}
                      </span>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white"
                        style={{
                          minWidth: 60,
                          display: 'inline-block',
                          textAlign: 'center'
                        }}
                        title="No due date: will be automatically set soon or needs repair"
                      >No Due</span>
                    )}
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
              );
            })}
            {stageJobStages.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-6 text-xs text-gray-400">No jobs</td>
              </tr>
            )}
          </tbody>
        </table>
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
