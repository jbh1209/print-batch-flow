
import React, { useEffect, useState } from "react";
import { getDueInfo } from "./getDueInfo";
import type { DueInfo } from "./StageColumn.types";

interface JobStageCardProps {
  jobStage: any;
  onStageAction: (stageId: string, action: "start" | "complete" | "scan") => void;
  highlighted?: boolean;
  onClick?: () => void;
}

const JobStageCard: React.FC<JobStageCardProps> = ({
  jobStage,
  onStageAction,
  highlighted = false,
  onClick,
}) => {
  const [dueMeta, setDueMeta] = useState<DueInfo>({
    color: "#9CA3AF",
    label: "Loading...",
    code: "gray",
    warning: false
  });

  useEffect(() => {
    const loadDueInfo = async () => {
      const info = await getDueInfo(jobStage);
      setDueMeta(info);
    };
    loadDueInfo();
  }, [jobStage]);

  const wo_no = jobStage.production_job?.wo_no ?? "Unknown";
  const customer = jobStage.production_job?.customer ?? "Unknown Customer";
  const batchName = jobStage.production_job?.batch_name;

  const handleStartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStageAction(jobStage.id, "start");
  };

  const handleCompleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStageAction(jobStage.id, "complete");
  };

  const handleScanClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStageAction(jobStage.id, "scan");
  };

  return (
    <div className={`relative rounded-lg shadow-md bg-white min-h-[116px] flex flex-col justify-between ${highlighted ? "ring-2 ring-green-500" : ""}`}>
      {/* Due Date chip at top-right */}
      <div className="absolute top-2 right-2 z-10">
        {jobStage.production_job?.due_date && (
          <span className="px-2 py-1 rounded-full text-[12px] font-semibold text-white shadow"
            style={{
              background: dueMeta.color,
              minWidth: 56,
              display: 'inline-block',
              textAlign: 'center',
            }}
            title={`Due: ${jobStage.production_job.due_date}`}
          >
            {jobStage.production_job.due_date}
          </span>
        )}
      </div>
      {/* Main Content */}
      <div className="px-4 pt-4 pb-2 flex flex-col flex-1 space-y-1">
        <div className="font-semibold text-sm truncate">{wo_no}</div>
        <div className="text-xs text-gray-500 truncate">{customer}</div>
        <div className="flex items-center mt-1 flex-wrap gap-1">
          <span
            className={`inline-flex rounded px-1.5 py-0.5 text-[11px] ${
              jobStage.status === "active"
                ? "bg-blue-100 text-blue-700"
                : jobStage.status === "pending"
                ? "bg-yellow-50 text-yellow-800"
                : "bg-gray-100"
            }`}
          >
            {jobStage.status}
          </span>
          {jobStage.production_job?.category_name && (
            <span className="bg-gray-100 text-gray-700 text-[11px] px-1.5 py-0.5 rounded">
              {jobStage.production_job.category_name}
            </span>
          )}
          {batchName && (
            <span className="bg-blue-100 text-blue-700 text-[11px] px-1.5 py-0.5 rounded border border-blue-200">
              Batch: {batchName}
            </span>
          )}
        </div>
      </div>
      {/* Buttons/CTAs at bottom, spaced from chip */}
      <div className="px-4 pb-3 pt-2 flex justify-end items-center space-x-2">
        {jobStage.status === "pending" && (
          <button
            onClick={handleStartClick}
            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            Start
          </button>
        )}
        {jobStage.status === "active" && (
          <button
            onClick={handleCompleteClick}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Complete
          </button>
        )}
        <button
          onClick={handleScanClick}
          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Scan
        </button>
      </div>
    </div>
  );
};

export default JobStageCard;
