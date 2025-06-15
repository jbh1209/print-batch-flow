
import React from "react";
import JobStageCard from "./JobStageCard";
import ColumnViewToggle from "./ColumnViewToggle";

const StageColumn: React.FC<{
  stage: any;
  jobStages: any[];
  onStageAction: (stageId: string, action: "start" | "complete" | "scan") => void;
  viewMode: "card" | "list";
  onViewModeChange: (mode: "card" | "list") => void;
}> = ({
  stage,
  jobStages,
  onStageAction,
  viewMode,
  onViewModeChange,
}) => {
  const stageJobStages = jobStages.filter(js => js.production_stage_id === stage.id);
  const activeStages = stageJobStages.filter(js => js.status === "active");
  const pendingStages = stageJobStages.filter(js => js.status === "pending");
  const completedStages = stageJobStages.filter(js => js.status === "completed");

  return (
    <div className="bg-gray-50 rounded-lg p-2 min-w-[210px] max-w-[240px] flex flex-col h-[calc(80vh-90px)]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="font-medium text-xs">{stage.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="bg-gray-100 text-xs px-1 rounded">{stageJobStages.length}</span>
          <ColumnViewToggle viewMode={viewMode} onChange={onViewModeChange} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {viewMode === "card" ? (
          <div className="space-y-2">
            {activeStages.map(jobStage => (
              <JobStageCard key={jobStage.id} jobStage={jobStage} onStageAction={onStageAction} />
            ))}
            {pendingStages.map(jobStage => (
              <JobStageCard key={jobStage.id} jobStage={jobStage} onStageAction={onStageAction} />
            ))}
            {completedStages.slice(0, 3).map(jobStage => (
              <JobStageCard key={jobStage.id} jobStage={jobStage} onStageAction={onStageAction} />
            ))}
            {stageJobStages.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs">No jobs</div>
            )}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left px-1 py-1 font-normal">WO</th>
                <th className="text-left px-1 py-1 font-normal">Customer</th>
                <th className="text-left px-1 py-1 font-normal">Status</th>
                <th className="text-left px-1 py-1 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {[...activeStages, ...pendingStages, ...completedStages.slice(0,3)].map(jobStage => (
                <tr key={jobStage.id} className="hover:bg-green-50 transition group">
                  <td className="px-1">{jobStage.production_job?.wo_no}</td>
                  <td className="px-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{jobStage.production_job?.customer}</td>
                  <td className="px-1">
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

export default StageColumn;
