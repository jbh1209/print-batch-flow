
import { useMemo } from "react";
import { useUserStagePermissions } from "./useUserStagePermissions";
import { useAuth } from "@/hooks/useAuth";

interface UnifiedJobFilteringOptions {
  jobs: any[];
  statusFilter?: string | null;
  searchQuery?: string;
  categoryFilter?: string | null;
  stageFilter?: string | null;
}

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

    console.log("🔍 Unified Job Filtering Debug:", {
      userId: user.id,
      totalJobs: jobs.length,
      accessibleStages: accessibleStages.length,
      accessibleStageIds: accessibleStageIds.slice(0, 3).map(id => id.substring(0, 8)),
      accessibleStageNames
    });

    return jobs.filter(job => {
      // Step 1: Check if job is accessible based on user's stage permissions
      const hasAccessibleStageInstances = job.stages?.some((stage: any) => {
        const stageId = stage.production_stage_id || stage.stage_id;
        const hasAccess = accessibleStageIds.includes(stageId);
        const isActiveOrPending = ['active', 'pending'].includes(stage.status);
        return hasAccess && isActiveOrPending;
      });

      // Step 2: Check jobs by current stage name (case-insensitive)
      const hasAccessibleCurrentStage = job.current_stage && 
        accessibleStageNames.includes(job.current_stage.toLowerCase());

      // Step 3: Check jobs by status matching accessible stage names
      const statusMatchesAccessibleStage = job.status && 
        accessibleStageNames.includes(job.status.toLowerCase());

      // Step 4: Include job if it matches any accessibility criteria
      const isAccessible = hasAccessibleStageInstances || 
                          hasAccessibleCurrentStage || 
                          statusMatchesAccessibleStage;

      // Step 5: Check if job is not completed
      const isNotCompleted = !['completed', 'shipped'].includes(job.status?.toLowerCase() || '');

      // Base accessibility check
      if (!isAccessible || !isNotCompleted) {
        return false;
      }

      // Apply additional filters
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
  }, [jobs, accessibleStageIds, accessibleStageNames, statusFilter, searchQuery, categoryFilter, stageFilter, permissionsLoading, user]);

  // Calculate job statistics based on filtered jobs
  const jobStats = useMemo(() => {
    const stats = {
      total: filteredJobs.length,
      pending: 0,
      inProgress: 0,
      completedToday: 0,
      byStage: {} as Record<string, number>
    };

    const today = new Date().toDateString();

    filteredJobs.forEach(job => {
      // Count by status patterns
      if (job.status?.toLowerCase() === 'pending' || 
          job.current_stage?.toLowerCase() === 'dtp' ||
          job.stages?.some((s: any) => s.status === 'pending')) {
        stats.pending++;
      }

      if (['in-progress', 'active'].includes(job.status?.toLowerCase() || '') ||
          job.stages?.some((s: any) => s.status === 'active')) {
        stats.inProgress++;
      }

      // Count completed today
      if (job.stages?.some((s: any) => 
        s.status === 'completed' &&
        s.completed_at &&
        new Date(s.completed_at).toDateString() === today
      )) {
        stats.completedToday++;
      }

      // Count by current stage
      if (job.current_stage) {
        stats.byStage[job.current_stage] = (stats.byStage[job.current_stage] || 0) + 1;
      }
    });

    return stats;
  }, [filteredJobs]);

  return {
    filteredJobs,
    jobStats,
    accessibleStages,
    isLoading: permissionsLoading
  };
};
