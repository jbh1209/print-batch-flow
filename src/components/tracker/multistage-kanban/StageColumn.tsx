
// --- STAGE COLUMN REFACTOR (organize by view mode and factor out subcomponents/utils) ---
import React, { useEffect, useState } from "react";
import JobStageCard from "./JobStageCard";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { getDueInfo } from "./getDueInfo";
import { StageColumnProps } from "./StageColumn.types";
import SortableJobStageCard from "./SortableJobStageCard";
import { sortJobStagesByOrder } from "@/utils/tracker/jobOrderingUtils";
import type { DueInfo } from "./StageColumn.types";

const StageColumn: React.FC<StageColumnProps> = ({
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
  // Store due info for each job stage
  const [dueInfoMap, setDueInfoMap] = useState<Record<string, DueInfo>>({});

  // Filter jobs for this stage and apply consistent sorting
  const stageJobStages = React.useMemo(() => {
    const filtered = jobStages.filter(js =>
      js.production_stage_id === stage.id &&
      js.status !== "completed" &&
      js.status !== "skipped"
    );
    
    // Use shared sorting utility for consistent ordering
    return sortJobStagesByOrder(filtered);
  }, [jobStages, stage.id]);

  // Load due info for all job stages
  useEffect(() => {
    const loadDueInfos = async () => {
      const newDueInfoMap: Record<string, DueInfo> = {};
      for (const jobStage of stageJobStages) {
        const dueInfo = await getDueInfo(jobStage);
        newDueInfoMap[jobStage.id] = dueInfo;
      }
      setDueInfoMap(newDueInfoMap);
    };
    
    if (stageJobStages.length > 0) {
      loadDueInfos();
    }
  }, [stageJobStages]);

  useEffect(() => {
    if (enableDnd && registerReorder && onReorder) {
      registerReorder(onReorder);
    }
  }, [enableDnd, onReorder, registerReorder]);

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
          className="bg-gray-50 rounded-lg p-1 min-w-[280px] max-w-full flex flex-col h-[calc(80vh-90px)]"
          style={{ width: 'auto' }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
              <span className="font-medium text-[11px]">{stage.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="bg-gray-100 text-[11px] px-1 rounded">{stageJobStages.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1">
              {stageJobStages.map(jobStage => {
                const dueMeta = dueInfoMap[jobStage.id] || { color: "#9CA3AF", label: "Loading...", code: "gray" as const, warning: false };
                return (
                  <div
                    key={jobStage.id}
                    className={`relative ${isJobHighlighted(jobStage) ? "ring-2 ring-green-500 rounded-lg transition" : ""}`}
                    onClick={() => onSelectJob && jobStage.production_job?.id && onSelectJob(jobStage.production_job.id)}
                    tabIndex={0}
                    style={{ cursor: "pointer", minHeight: 48 }}
                  >
                    <div className="absolute left-2 top-2 flex items-center z-10">
                      <span
                        className="inline-block rounded-full mr-1"
                        style={{ width: 10, height: 10, background: dueMeta.color, border: dueMeta.warning ? "2px dashed #F59E42" : undefined }}
                        title={dueMeta.label}
                      />
                    </div>
                    {/* Use DnD wrapper */}
                    <SortableJobStageCard 
                      jobStage={jobStage}
                      onStageAction={onStageAction}
                      highlighted={!!isJobHighlighted(jobStage)}
                      onClick={() => onSelectJob && jobStage.production_job?.id && onSelectJob(jobStage.production_job.id)}
                    />
                    <div className="absolute right-2 top-2">
                      {jobStage.production_job?.due_date ? (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                          style={{
                            background: dueMeta.color,
                            minWidth: 38,
                            display: 'inline-block',
                            textAlign: 'center',
                            lineHeight: '16px'
                          }}
                          title={`Due: ${jobStage.production_job.due_date}`}
                        >
                          {jobStage.production_job.due_date}
                        </span>
                      ) : (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500 text-white"
                          style={{
                            minWidth: 38,
                            display: 'inline-block',
                            textAlign: 'center',
                            lineHeight: '16px'
                          }}
                          title="No due date: will be automatically set soon or needs repair"
                        >No Due</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {stageJobStages.length === 0 && (
                <div className="text-center py-4 text-gray-400 text-xs">No jobs</div>
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
      className="bg-gray-50 rounded-lg p-1 min-w-[280px] max-w-full flex flex-col h-[calc(80vh-90px)]"
      style={{ width: 'auto' }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="font-medium text-[11px]">{stage.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="bg-gray-100 text-[11px] px-1 rounded">{stageJobStages.length}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-auto text-[12px] min-w-max" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="text-[11px] text-gray-500 border-b">
              <th className="text-left px-1 py-1 font-normal whitespace-nowrap">WO</th>
              <th className="text-left px-0.5 py-1 font-normal whitespace-nowrap w-[100px] max-w-[120px]">Customer</th>
              <th className="text-left px-0.5 py-1 font-normal whitespace-nowrap">Due</th>
              <th className="text-left px-0.5 py-1 font-normal whitespace-nowrap">Status</th>
              <th className="text-left px-0.5 py-1 font-normal whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {stageJobStages.map(jobStage => {
              const dueMeta = dueInfoMap[jobStage.id] || { color: "#9CA3AF", label: "Loading...", code: "gray" as const, warning: false };
              const woNo = jobStage.production_job?.wo_no ?? "Orphaned";
              const customer = jobStage.production_job?.customer ?? "Unknown";
              return (
                <tr
                  key={jobStage.id}
                  className={
                    "hover:bg-green-50 transition group " +
                    (isJobHighlighted(jobStage) ? "ring-2 ring-green-500 rounded" : "")
                  }
                  style={{ cursor: "pointer", minHeight: 34 }}
                  onClick={() => onSelectJob && jobStage.production_job?.id && onSelectJob(jobStage.production_job.id)}
                  tabIndex={0}
                >
                  <td className="px-1 whitespace-nowrap flex items-center gap-1">
                    <span
                      className="inline-block rounded-full"
                      style={{ width: 9, height: 9, background: dueMeta.color, border: dueMeta.warning ? "2px dashed #F59E42" : undefined }}
                      title={dueMeta.label}
                    />
                    <span className="truncate max-w-[65px]">{woNo}</span>
                  </td>
                  <td className="px-0.5 whitespace-nowrap max-w-[120px] truncate" style={{ width: "100px" }}>
                    <span className="truncate">{customer}</span>
                  </td>
                  <td className="px-0.5 whitespace-nowrap">
                    {jobStage.production_job?.due_date ? (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                        style={{
                          background: dueMeta.color,
                          minWidth: 38,
                          display: 'inline-block',
                          textAlign: 'center',
                          lineHeight: '16px'
                        }}
                        title={`Due: ${jobStage.production_job.due_date}`}
                      >
                        {jobStage.production_job.due_date}
                      </span>
                    ) : (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500 text-white"
                        style={{
                          minWidth: 38,
                          display: 'inline-block',
                          textAlign: 'center',
                          lineHeight: '16px'
                        }}
                        title="No due date: will be automatically set soon or needs repair"
                      >No Due</span>
                    )}
                  </td>
                  <td className="px-0.5 whitespace-nowrap">
                    <span className={`inline-flex rounded px-1 text-[11px] ${jobStage.status === "active" ? "bg-blue-100 text-blue-700" : jobStage.status === "pending" ? "bg-yellow-50 text-yellow-800" : "bg-gray-100"}`}>
                      {jobStage.status}
                    </span>
                  </td>
                  <td className="px-0.5">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {jobStage.status === "pending" && (
                        <button title="Start" onClick={e => { e.stopPropagation(); onStageAction(jobStage.id, "start"); }} className="text-green-600 hover:text-green-700">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor" /></svg>
                        </button>
                      )}
                      {jobStage.status === "active" && (
                        <button title="Complete" onClick={e => { e.stopPropagation(); onStageAction(jobStage.id, "complete"); }} className="text-blue-600 hover:text-green-700">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {stageJobStages.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-5 text-xs text-gray-400">No jobs</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StageColumn;
