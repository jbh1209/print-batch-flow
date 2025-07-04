import { useMemo } from "react";
import { useUserStagePermissions } from "./useUserStagePermissions";
import { useAuth } from "@/hooks/useAuth";
import { UnifiedJobFilteringOptions } from "./filtering/types";
import { calculateJobStats } from "./filtering/jobStatsCalculator";
import { filterActiveJobs, isJobCompleted } from "@/utils/tracker/jobCompletionUtils";
import { consolidateStagesByMasterQueue, isStageAccessible } from "@/utils/tracker/stageConsolidation";
import type { AccessibleJob } from "./useAccessibleJobs/types";

interface BatchAwareFilteringOptions extends UnifiedJobFilteringOptions {
  batchFilter?: string | null; // 'individual', 'batched', 'batch_master', or null for all
  includeBatchContext?: boolean; // Whether to include batch information in search
}

export const useBatchAwareJobFiltering = ({
  jobs,
  statusFilter,
  searchQuery,
  categoryFilter,
  stageFilter,
  batchFilter,
  includeBatchContext = true
}: BatchAwareFilteringOptions) => {
  const { user } = useAuth();
  const { accessibleStages, consolidatedStages, isLoading: permissionsLoading, isAdmin } = useUserStagePermissions(user?.id);

  // Enhanced filtering logic with batch awareness
  const filteredJobs = useMemo(() => {
    if (permissionsLoading || !user) {
      return [];
    }

    console.log("🔍 Batch-Aware Job Filtering Debug:", {
      userId: user.id,
      isAdmin,
      totalJobs: jobs.length,
      statusFilter,
      searchQuery,
      categoryFilter,
      stageFilter,
      batchFilter,
      includeBatchContext
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

    return jobsToFilter.filter(job => {
      // BATCH FILTERING: Apply batch-specific filters
      if (batchFilter) {
        switch (batchFilter) {
          case 'individual':
            // Show only individual jobs (not batch masters, not in batch processing)
            if (job.is_batch_master || job.is_in_batch_processing) {
              return false;
            }
            break;
          case 'batched':
            // Show only jobs currently in batch processing
            if (!job.is_in_batch_processing) {
              return false;
            }
            break;
          case 'batch_master':
            // Show only batch master jobs
            if (!job.is_batch_master) {
              return false;
            }
            break;
        }
      }

      // PERMISSION FILTERING: Check stage access for non-admin users
      if (!isAdmin) {
        const currentStageId = job.current_stage_id;
        const isAccessible = currentStageId && isStageAccessible(currentStageId, consolidatedStages, 'view');
        
        if (!isAccessible) {
          return false;
        }
      }

      // STATUS FILTERING
      if (statusFilter && statusFilter !== 'completed' && job.status !== statusFilter) {
        return false;
      }

      // CATEGORY FILTERING
      if (categoryFilter && job.category_name?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // STAGE FILTERING
      const effectiveStageDisplay = job.display_stage_name || job.current_stage_name;
      if (stageFilter && effectiveStageDisplay?.toLowerCase() !== stageFilter.toLowerCase()) {
        return false;
      }

      // ENHANCED SEARCH FILTERING (with batch context)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const baseSearchFields = [
          job.wo_no,
          job.customer,
          job.reference,
          job.category_name,
          job.status,
          job.current_stage_name,
          job.display_stage_name
        ];

        // Add batch-specific search fields if batch context is enabled
        const batchSearchFields = includeBatchContext ? [
          job.batch_name,
          job.batch_category,
          job.is_batch_master ? 'batch master' : null,
          job.is_in_batch_processing ? 'in batch' : null,
          job.is_in_batch_processing ? 'batch processing' : null
        ] : [];

        const allSearchFields = [...baseSearchFields, ...batchSearchFields].filter(Boolean);

        const matchesSearch = allSearchFields.some(field => 
          field?.toLowerCase().includes(query)
        );

        if (!matchesSearch) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, consolidatedStages, statusFilter, searchQuery, categoryFilter, stageFilter, batchFilter, includeBatchContext, permissionsLoading, user, isAdmin]);

  // Enhanced job statistics with batch context
  const jobStats = useMemo(() => {
    const baseStats = calculateJobStats(filteredJobs);
    
    // Add batch-specific statistics
    const batchStats = {
      individualJobs: filteredJobs.filter(job => !job.is_batch_master && !job.is_in_batch_processing).length,
      batchMasterJobs: filteredJobs.filter(job => job.is_batch_master).length,
      jobsInBatchProcessing: filteredJobs.filter(job => job.is_in_batch_processing).length,
      batchReadyJobs: filteredJobs.filter(job => job.batch_ready).length
    };

    return {
      ...baseStats,
      ...batchStats
    };
  }, [filteredJobs]);

  console.log("🔍 Batch-Aware Filtering Results:", {
    totalJobsInput: jobs.length,
    filteredJobsOutput: filteredJobs.length,
    isAdmin,
    jobStats: {
      total: jobStats.total,
      pending: jobStats.pending,
      inProgress: jobStats.inProgress,
      individualJobs: jobStats.individualJobs,
      batchMasterJobs: jobStats.batchMasterJobs,
      jobsInBatchProcessing: jobStats.jobsInBatchProcessing
    }
  });

  return {
    filteredJobs,
    jobStats,
    accessibleStages: consolidatedStages,
    isLoading: permissionsLoading
  };
};