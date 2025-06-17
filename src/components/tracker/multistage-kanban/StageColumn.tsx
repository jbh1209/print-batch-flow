
// --- STAGE COLUMN REFACTOR (organize by view mode and factor out subcomponents/utils) ---
import React, { useEffect } from "react";
import JobStageCard from "./JobStageCard";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { getDueInfo } from "./getDueInfo";
import SortableJobStageCard from "./SortableJobStageCard";

interface StageColumnProps {
  stage: any;
  jobs: any[];
  onStageAction: (jobId: string, stageId: string, action: "start" | "complete" | "scan") => void;
  viewMode: "card" | "list";
  enableDnd: boolean;
  onReorder: (newOrder: string[]) => void;
  registerReorder: (handler: (newOrder: string[]) => void) => void;
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

const StageColumn: React.FC<StageColumnProps> = ({
  stage,
  jobs,
  onStageAction,
  viewMode,
  enableDnd,
  onReorder,
  registerReorder,
  selectedJobId,
  onSelectJob,
}) => {
  // Filter jobs for this stage - show all jobs that have this stage and haven't completed it yet
  const stageJobs = jobs
    .filter(job => {
      // Show jobs that have a stage instance for this stage that is either pending or active
      const stageInstance = job.job_stage_instances?.find(jsi => 
        jsi.production_stage_id === stage.id && jsi.status !== 'completed'
      );
      return !!stageInstance;
    })
    .sort((a, b) => {
      // Sort by job order if available, otherwise by wo_no
      const aOrder = a.job_stage_instances?.find(jsi => jsi.production_stage_id === stage.id)?.job_order_in_stage || 0;
      const bOrder = b.job_stage_instances?.find(jsi => jsi.production_stage_id === stage.id)?.job_order_in_stage || 0;
      
      if (aOrder && bOrder) {
        return aOrder - bOrder;
      }
      return a.wo_no.localeCompare(b.wo_no, undefined, { numeric: true });
    });

  useEffect(() => {
    if (enableDnd && registerReorder && onReorder) {
      registerReorder(onReorder);
    }
  }, [enableDnd, onReorder, registerReorder]);

  const isJobHighlighted = (job: any) => (
    selectedJobId && job.id === selectedJobId
  );

  // Format due date as MM-DD
  const formatDueDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}-${day}`;
    } catch {
      return null;
    }
  };

  // Get stage instance for a job in this stage
  const getStageInstance = (job: any) => {
    return job.job_stage_instances?.find(
      jsi => jsi.production_stage_id === stage.id && jsi.status !== 'completed'
    );
  };

  // --- Card & DnD view ---
  if (viewMode === "card" && enableDnd) {
    return (
      <SortableContext
        items={stageJobs.map(job => job.id)}
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
              <span className="bg-gray-100 text-[11px] px-1 rounded">{stageJobs.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1">
              {stageJobs.map(job => {
                const stageInstance = getStageInstance(job);
                const dueMeta = getDueInfo({ production_job: job });
                const formattedDueDate = formatDueDate(job.due_date);
                
                return (
                  <div
                    key={job.id}
                    className={`relative ${isJobHighlighted(job) ? "ring-2 ring-green-500 rounded-lg transition" : ""}`}
                    onClick={() => onSelectJob && onSelectJob(job.id)}
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
                    {/* Create a mock job stage for the card */}
                    <SortableJobStageCard 
                      jobStage={{
                        id: job.id,
                        production_job: job,
                        status: stageInstance?.status || 'pending'
                      }}
                      onStageAction={(_, action) => onStageAction(job.id, stage.id, action)}
                      highlighted={!!isJobHighlighted(job)}
                      onClick={() => onSelectJob && onSelectJob(job.id)}
                    />
                    <div className="absolute right-2 top-2">
                      {formattedDueDate ? (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                          style={{
                            background: dueMeta.color,
                            minWidth: 38,
                            display: 'inline-block',
                            textAlign: 'center',
                            lineHeight: '16px'
                          }}
                          title={`Due: ${job.due_date}`}
                        >
                          {formattedDueDate}
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
              {stageJobs.length === 0 && (
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
          <span className="bg-gray-100 text-[11px] px-1 rounded">{stageJobs.length}</span>
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
            {stageJobs.map(job => {
              const stageInstance = getStageInstance(job);
              const dueMeta = getDueInfo({ production_job: job });
              const woNo = job.wo_no ?? "Orphaned";
              const customer = job.customer ?? "Unknown";
              const formattedDueDate = formatDueDate(job.due_date);
              const status = stageInstance?.status || 'pending';
              
              return (
                <tr
                  key={job.id}
                  className={
                    "hover:bg-green-50 transition group " +
                    (isJobHighlighted(job) ? "ring-2 ring-green-500 rounded" : "")
                  }
                  style={{ cursor: "pointer", minHeight: 34 }}
                  onClick={() => onSelectJob && onSelectJob(job.id)}
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
                    {formattedDueDate ? (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                        style={{
                          background: dueMeta.color,
                          minWidth: 38,
                          display: 'inline-block',
                          textAlign: 'center',
                          lineHeight: '16px'
                        }}
                        title={`Due: ${job.due_date}`}
                      >
                        {formattedDueDate}
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
                    <span className={`inline-flex rounded px-1 text-[11px] ${status === "active" ? "bg-blue-100 text-blue-700" : status === "pending" ? "bg-yellow-50 text-yellow-800" : "bg-gray-100"}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-0.5">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {status === "pending" && (
                        <button title="Start" onClick={e => { e.stopPropagation(); onStageAction(job.id, stage.id, "start"); }} className="text-green-600 hover:text-green-700">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor" /></svg>
                        </button>
                      )}
                      {status === "active" && (
                        <button title="Complete" onClick={e => { e.stopPropagation(); onStageAction(job.id, stage.id, "complete"); }} className="text-blue-600 hover:text-green-700">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {stageJobs.length === 0 && (
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
