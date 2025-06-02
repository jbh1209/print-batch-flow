
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

    return jobs.filter(job => {
      console.log(`🔍 Processing job ${job.wo_no}:`, {
        status: job.status,
        currentStage: job.current_stage,
        hasWorkflow: job.has_workflow,
        stagesInfo: job.stages?.map((s: any) => ({
          name: s.stage_name || s.production_stages?.name,
          status: s.status,
          stageId: s.production_stage_id?.substring(0, 8)
        }))
      });

      // Step 1: Check workflow stage instances (now with consolidated stage IDs)
      const hasAccessibleWorkflowStages = job.stages?.some((stage: any) => {
        const stageId = stage.production_stage_id || stage.stage_id;
        const stageName = stage.stage_name || stage.production_stages?.name;
        
        // ID-based check (now using consolidated IDs)
        const hasIdAccess = stageId && accessibleStageIds.includes(stageId);
        
        // Name-based fallback (case-insensitive)
        const hasNameAccess = stageName && accessibleStageNames.includes(stageName.toLowerCase());
        
        // Stage must be active or pending to be workable
        const isWorkableStatus = ['active', 'pending'].includes(stage.status);
        
        const stageAccessible = (hasIdAccess || hasNameAccess) && isWorkableStatus;
        
        if (stageAccessible) {
          console.log(`  ✅ Stage accessible: ${stageName} (ID: ${stageId?.substring(0, 8)}, Status: ${stage.status})`);
        }
        
        return stageAccessible;
      }) || false;

      // Step 2: Check current stage by name for jobs with/without workflows
      const currentStageAccessible = job.current_stage && 
        accessibleStageNames.includes(job.current_stage.toLowerCase());

      // Step 3: Check status field for stage-based access
      const statusBasedAccess = job.status && 
        accessibleStageNames.includes(job.status.toLowerCase());

      // Step 4: Special handling for jobs without workflows
      const noWorkflowAccess = !job.has_workflow && (
        currentStageAccessible || 
        statusBasedAccess ||
        // Default access for DTP users on jobs with no specific stage
        (!job.current_stage && !job.status && accessibleStageNames.includes('dtp'))
      );

      // Combine all access checks
      const isAccessible = hasAccessibleWorkflowStages || 
                          currentStageAccessible || 
                          statusBasedAccess ||
                          noWorkflowAccess;

      // Filter out completed jobs
      const isNotCompleted = !['completed', 'shipped', 'delivered', 'cancelled', 'finished'].includes(
        job.status?.toLowerCase() || ''
      );

      const finalDecision = isAccessible && isNotCompleted;

      console.log(`  Decision for ${job.wo_no}: ${finalDecision ? '✅ INCLUDED' : '❌ EXCLUDED'}`, {
        isAccessible,
        isNotCompleted,
        accessReasons: {
          hasAccessibleWorkflowStages,
          currentStageAccessible,
          statusBasedAccess,
          noWorkflowAccess
        }
      });

      // Apply base accessibility and completion filters
      if (!finalDecision) {
        return false;
      }

      // Apply additional user filters
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
