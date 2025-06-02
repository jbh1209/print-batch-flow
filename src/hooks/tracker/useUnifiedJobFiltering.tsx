
import { useMemo } from "react";
import { useUserStagePermissions } from "./useUserStagePermissions";
import { useAuth } from "@/hooks/useAuth";
import { UnifiedJobFilteringOptions } from "./filtering/types";
import { applyJobFilters } from "./filtering/jobFilteringLogic";
import { calculateJobStats } from "./filtering/jobStatsCalculator";

export const useUnifiedJobFiltering = ({
  jobs,
  statusFilter,
  searchQuery,
  categoryFilter,
  stageFilter
}: UnifiedJobFilteringOptions) => {
  const { user } = useAuth();
  const { accessibleStages, isLoading: permissionsLoading } = useUserStagePermissions(user?.id);

  // Extract accessible stage information outside of useMemo
  const accessibleStageIds = useMemo(() => 
    accessibleStages.map(stage => stage.stage_id), 
    [accessibleStages]
  );
  
  const accessibleStageNames = useMemo(() => 
    accessibleStages.map(stage => stage.stage_name.toLowerCase()), 
    [accessibleStages]
  );

  const filteredJobs = useMemo(() => {
    if (permissionsLoading || !user) {
      return [];
    }

    console.log("🔍 Unified Job Filtering Debug (Post-Consolidation):", {
      userId: user.id,
      totalJobs: jobs.length,
      accessibleStages: accessibleStages.length,
      accessibleStageIds: accessibleStageIds.slice(0, 3).map(id => id.substring(0, 8)),
      accessibleStageNames,
      sampleJobs: jobs.slice(0, 2).map(job => ({
        woNo: job.wo_no,
        status: job.status,
        currentStage: job.current_stage,
        hasWorkflow: job.has_workflow,
        stagesCount: job.stages?.length || 0
      }))
    });

    return applyJobFilters(
      jobs,
      accessibleStageIds,
      accessibleStageNames,
      statusFilter,
      searchQuery,
      categoryFilter,
      stageFilter
    );
  }, [jobs, accessibleStageIds, accessibleStageNames, statusFilter, searchQuery, categoryFilter, stageFilter, permissionsLoading, user]);

  // Calculate job statistics based on filtered jobs
  const jobStats = useMemo(() => calculateJobStats(filteredJobs), [filteredJobs]);

  console.log("🔍 Final Results (Post-Stage-Consolidation):", {
    totalJobsInput: jobs.length,
    filteredJobsOutput: filteredJobs.length,
    accessibleStagesCount: accessibleStages.length,
    jobStats: {
      total: jobStats.total,
      pending: jobStats.pending,
      inProgress: jobStats.inProgress
    }
  });

  return {
    filteredJobs,
    jobStats,
    accessibleStages,
    isLoading: permissionsLoading
  };
};
