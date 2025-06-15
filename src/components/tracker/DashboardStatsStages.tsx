
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Actual stats table grouped by real, active stages
const DashboardStatsStages = ({ stages, jobs, isLoading }: { stages: any[]; jobs: any[]; isLoading: boolean }) => {
  if (isLoading) {
    // ... loading skeletons ...
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array(8)
          .fill(0)
          .map((_, i) => (
            <div key={i}>
              <Skeleton className="h-5 w-24 mb-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
      </div>
    );
  }

  // Group jobs by current/display stage (skip "Pre-Press" or stages not in system)
  const stageJobMap = stages
    .filter(stage => stage.stage_name) // Only real stages
    .map(stage => ({
      name: stage.stage_name,
      color: stage.stage_color || "#D1D5DB",
      count: jobs.filter(job =>
        (job.display_stage_name || job.current_stage_name) === stage.stage_name
      ).length,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stageJobMap.map(({ name, color, count }) => (
        <div key={name} className="flex flex-col items-center">
          <span
            className="px-2 py-1 rounded-full text-xs font-semibold"
            style={{ background: color, color: "#fff" }}
          >
            {name}
          </span>
          <span className="mt-1 text-sm font-bold">{count} jobs</span>
        </div>
      ))}
    </div>
  );
};

export default DashboardStatsStages;
