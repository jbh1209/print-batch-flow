
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

    console.log("🔍 Unified Job Filtering Debug (Admin Check):", {
      userId: user.id,
      isAdmin,
      totalJobs: jobs.length,
      accessibleStages: accessibleStages.length,
      statusFilter,
      searchQuery,
      categoryFilter,
      stageFilter
    });

    // If user is admin, show all jobs with minimal filtering
    if (isAdmin) {
      console.log("👑 Admin user detected - showing all jobs");
      
      return jobs.filter(job => {
        // Apply only basic filters for admins - no stage/permission restrictions
        if (statusFilter && job.status?.toLowerCase() !== statusFilter.toLowerCase()) {
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
      jobs,
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

  console.log("🔍 Final Results (Admin-Aware Filtering):", {
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
