
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

  // Group accessible stages by master queue
  const consolidatedAccessibleStages = useMemo(() => {
    const stageMap = new Map();
    
    accessibleStages.forEach(stage => {
      // If this stage has a master queue, group it under the master
      const groupKey = stage.master_queue_id || stage.stage_id;
      const groupName = stage.master_queue_name || stage.stage_name;
      
      if (!stageMap.has(groupKey)) {
        stageMap.set(groupKey, {
          stage_id: groupKey,
          stage_name: groupName,
          stage_color: stage.stage_color,
          can_view: stage.can_view,
          can_edit: stage.can_edit,
          can_work: stage.can_work,
          can_manage: stage.can_manage,
          subsidiaryStages: []
        });
      }
      
      // If this is a subsidiary stage, add it to the group
      if (stage.master_queue_id) {
        stageMap.get(groupKey).subsidiaryStages.push(stage);
      }
    });
    
    return Array.from(stageMap.values());
  }, [accessibleStages]);

  // Extract accessible stage information for filtering
  const accessibleStageIds = useMemo(() => {
    // Include both master queue IDs and individual stage IDs for comprehensive access checking
    const ids = new Set<string>();
    
    accessibleStages.forEach(stage => {
      ids.add(stage.stage_id);
      if (stage.master_queue_id) {
        ids.add(stage.master_queue_id);
      }
    });
    
    return Array.from(ids);
  }, [accessibleStages]);
  
  const accessibleStageNames = useMemo(() => {
    const names = new Set<string>();
    
    accessibleStages.forEach(stage => {
      names.add(stage.stage_name.toLowerCase());
      if (stage.master_queue_name) {
        names.add(stage.master_queue_name.toLowerCase());
      }
    });
    
    return Array.from(names);
  }, [accessibleStages]);

  const filteredJobs = useMemo(() => {
    if (permissionsLoading || !user) {
      return [];
    }

    console.log("🔍 Unified Job Filtering Debug (Master Queue Aware):", {
      userId: user.id,
      isAdmin,
      totalJobs: jobs.length,
      accessibleStages: accessibleStages.length,
      consolidatedStages: consolidatedAccessibleStages.length,
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

    // For non-admin users, use the existing permission-based filtering with master queue support
    return applyJobFilters(
      jobsToFilter,
      accessibleStageIds,
      accessibleStageNames,
      statusFilter,
      searchQuery,
      categoryFilter,
      stageFilter
    );
  }, [jobs, accessibleStageIds, accessibleStageNames, statusFilter, searchQuery, categoryFilter, stageFilter, permissionsLoading, user, isAdmin, consolidatedAccessibleStages]);

  // Calculate job statistics based on filtered jobs
  const jobStats = useMemo(() => calculateJobStats(filteredJobs), [filteredJobs]);

  console.log("🔍 Final Results (Master Queue Aware):", {
    totalJobsInput: jobs.length,
    filteredJobsOutput: filteredJobs.length,
    isAdmin,
    accessibleStagesCount: accessibleStages.length,
    consolidatedStagesCount: consolidatedAccessibleStages.length,
    jobStats: {
      total: jobStats.total,
      pending: jobStats.pending,
      inProgress: jobStats.inProgress
    }
  });

  return {
    filteredJobs,
    jobStats,
    accessibleStages: consolidatedAccessibleStages, // Return consolidated stages for UI
    isLoading: permissionsLoading
  };
};
