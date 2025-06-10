
import { useMemo } from "react";
import { useUserStagePermissions } from "./useUserStagePermissions";
import { useAuth } from "@/hooks/useAuth";
import { UnifiedJobFilteringOptions } from "./filtering/types";
import { applyJobFilters } from "./filtering/jobFilteringLogic";
import { calculateJobStats } from "./filtering/jobStatsCalculator";
import { filterActiveJobs, isJobCompleted } from "@/utils/tracker/jobCompletionUtils";

export const useUnifiedJobFiltering = ({
  jobs,
  statusFilter,
  searchQuery,
  categoryFilter,
  stageFilter
}: UnifiedJobFilteringOptions) => {
  const { user } = useAuth();
  const { accessibleStages, isLoading: permissionsLoading, isAdmin } = useUserStagePermissions(user?.id);

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

    console.log("🔍 Unified Job Filtering Debug:", {
      userId: user.id,
      isAdmin,
      totalJobs: jobs.length,
      accessibleStages: accessibleStages.length,
      statusFilter,
      searchQuery,
      categoryFilter,
      stageFilter
    });

    // ALWAYS filter out completed jobs first, unless specifically filtering for completed status
    let jobsToFilter = jobs;
    if (statusFilter !== 'completed') {
      jobsToFilter = filterActiveJobs(jobs);
      console.log(`🔍 Filtered out completed jobs: ${jobs.length} -> ${jobsToFilter.length}`);
    }

    // If user is admin, show filtered jobs with basic filtering only
    if (isAdmin) {
      console.log("👑 Admin user detected - showing filtered jobs with basic filtering");
      
      return jobsToFilter.filter(job => {
        // Apply basic filters for admins - no stage/permission restrictions
        if (statusFilter && statusFilter !== 'completed' && job.status?.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }

        if (categoryFilter && job.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }

        if (stageFilter && job.current_stage?.toLowerCase() !== stageFilter.toLowerCase()) {
          return false;
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const searchFields = [
            job.wo_no,
            job.customer,
            job.reference,
            job.category,
            job.status,
            job.current_stage
          ].filter(Boolean);

          const matchesSearch = searchFields.some(field => 
            field?.toLowerCase().includes(query)
          );

          if (!matchesSearch) {
            return false;
          }
        }

        return true;
      });
    }

    // For non-admin users, use the existing permission-based filtering
    return applyJobFilters(
      jobsToFilter, // Use already filtered jobs (no completed)
      accessibleStageIds,
      accessibleStageNames,
      statusFilter,
      searchQuery,
      categoryFilter,
      stageFilter
    );
  }, [jobs, accessibleStageIds, accessibleStageNames, statusFilter, searchQuery, categoryFilter, stageFilter, permissionsLoading, user, isAdmin]);

  // Calculate job statistics based on filtered jobs
  const jobStats = useMemo(() => calculateJobStats(filteredJobs), [filteredJobs]);

  console.log("🔍 Final Results (Admin-Aware + Completion Filtering):", {
    totalJobsInput: jobs.length,
    filteredJobsOutput: filteredJobs.length,
    isAdmin,
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
