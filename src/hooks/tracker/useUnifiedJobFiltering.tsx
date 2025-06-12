import { useMemo } from "react";
import { useUserStagePermissions } from "./useUserStagePermissions";
import { useAuth } from "@/hooks/useAuth";
import { UnifiedJobFilteringOptions } from "./filtering/types";
import { applyJobFilters } from "./filtering/jobFilteringLogic";
import { calculateJobStats } from "./filtering/jobStatsCalculator";
import { filterActiveJobs, isJobCompleted } from "@/utils/tracker/jobCompletionUtils";
import { consolidateStagesByMasterQueue, getStageDisplayName, isStageAccessible } from "@/utils/tracker/stageConsolidation";

export const useUnifiedJobFiltering = ({
  jobs,
  statusFilter,
  searchQuery,
  categoryFilter,
  stageFilter
}: UnifiedJobFilteringOptions) => {
  const { user } = useAuth();
  const { accessibleStages, consolidatedStages, isLoading: permissionsLoading, isAdmin } = useUserStagePermissions(user?.id);

  // Use consolidated stages for stage IDs and names for filtering
  const accessibleStageIds = useMemo(() => {
    const ids = new Set<string>();
    
    // Add master queue IDs and subsidiary stage IDs
    consolidatedStages.forEach(stage => {
      ids.add(stage.stage_id);
      // Add all subsidiary stage IDs for comprehensive access checking
      stage.subsidiary_stages.forEach(sub => {
        ids.add(sub.stage_id);
      });
    });
    
    return Array.from(ids);
  }, [consolidatedStages]);
  
  const accessibleStageNames = useMemo(() => {
    const names = new Set<string>();
    
    // Add consolidated stage names (master queue names and standalone names)
    consolidatedStages.forEach(stage => {
      names.add(stage.stage_name.toLowerCase());
      // Also add subsidiary stage names for fallback
      stage.subsidiary_stages.forEach(sub => {
        names.add(sub.stage_name.toLowerCase());
      });
    });
    
    return Array.from(names);
  }, [consolidatedStages]);

  const filteredJobs = useMemo(() => {
    if (permissionsLoading || !user) {
      return [];
    }

    console.log("🔍 Unified Job Filtering Debug (Master Queue Consolidated):", {
      userId: user.id,
      isAdmin,
      totalJobs: jobs.length,
      accessibleStages: accessibleStages.length,
      consolidatedStages: consolidatedStages.length,
      statusFilter,
      searchQuery,
      categoryFilter,
      stageFilter
    });

    // COMPLETION FILTERING: Apply completion filter first based on status filter
    let jobsToFilter = jobs;
    if (statusFilter === 'completed') {
      jobsToFilter = jobs.filter(job => isJobCompleted(job));
      console.log(`🔍 Showing completed jobs only: ${jobs.length} -> ${jobsToFilter.length}`);
    } else {
      jobsToFilter = filterActiveJobs(jobs);
      console.log(`🔍 Filtered out completed jobs: ${jobs.length} -> ${jobsToFilter.length}`);
    }

    // If user is admin, show filtered jobs with basic filtering only
    if (isAdmin) {
      console.log("👑 Admin user detected - showing filtered jobs with master queue awareness");
      
      return jobsToFilter.filter(job => {
        // Apply basic filters for admins - no stage/permission restrictions
        if (statusFilter && statusFilter !== 'completed' && job.status !== statusFilter) {
          return false;
        }

        if (categoryFilter && job.category_name?.toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }

        // Use display_stage_name for master queue filtering, fallback to current_stage_name
        const stageNameForFiltering = job.display_stage_name || job.current_stage_name;
        if (stageFilter && stageNameForFiltering?.toLowerCase() !== stageFilter.toLowerCase()) {
          return false;
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const searchFields = [
            job.wo_no,
            job.customer,
            job.reference,
            job.category_name,
            job.status,
            job.current_stage_name,
            job.display_stage_name
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

    // For non-admin users, use consolidated stage filtering
    return jobsToFilter.filter(job => {
      // Check if job's current stage is accessible through consolidated stages
      const currentStageId = job.current_stage_id;
      const currentStageName = job.current_stage_name;
      const displayStageName = job.display_stage_name;

      // Use display stage name if available (master queue aware), otherwise use current stage name
      const effectiveStageDisplay = displayStageName || currentStageName;

      // Check accessibility through consolidated stages
      const isAccessible = currentStageId && isStageAccessible(currentStageId, consolidatedStages, 'view');
      
      console.log(`  Job ${job.wo_no}:`, {
        currentStageId,
        currentStageName,
        displayStageName,
        effectiveStageDisplay,
        isAccessible
      });

      if (!isAccessible) {
        return false;
      }

      // Apply other filters
      if (statusFilter && statusFilter !== 'completed' && job.status !== statusFilter) {
        return false;
      }

      if (categoryFilter && job.category_name?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // Stage filtering now uses consolidated stage names
      if (stageFilter && effectiveStageDisplay?.toLowerCase() !== stageFilter.toLowerCase()) {
        return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [
          job.wo_no,
          job.customer,
          job.reference,
          job.category_name,
          job.status,
          currentStageName,
          displayStageName,
          effectiveStageDisplay
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
  }, [jobs, consolidatedStages, accessibleStageIds, accessibleStageNames, statusFilter, searchQuery, categoryFilter, stageFilter, permissionsLoading, user, isAdmin]);

  // Calculate job statistics based on filtered jobs
  const jobStats = useMemo(() => calculateJobStats(filteredJobs), [filteredJobs]);

  console.log("🔍 Final Results (Master Queue Consolidated):", {
    totalJobsInput: jobs.length,
    filteredJobsOutput: filteredJobs.length,
    isAdmin,
    consolidatedStagesCount: consolidatedStages.length,
    jobStats: {
      total: jobStats.total,
      pending: jobStats.pending,
      inProgress: jobStats.inProgress
    }
  });

  return {
    filteredJobs,
    jobStats,
    accessibleStages: consolidatedStages, // Return consolidated stages for UI
    isLoading: permissionsLoading
  };
};
