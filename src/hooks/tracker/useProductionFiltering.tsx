
import { useMemo } from "react";
import { useUserStagePermissions } from "./useUserStagePermissions";

interface UseProductionFilteringOptions {
  jobs: any[];
  statusFilter?: string | null;
  stageFilter?: string | null;
  categoryFilter?: string | null;
  searchQuery?: string;
}

export const useProductionFiltering = ({
  jobs,
  statusFilter,
  stageFilter,
  categoryFilter,
  searchQuery
}: UseProductionFilteringOptions) => {
  const { consolidatedStages, isLoading: stagesLoading } = useUserStagePermissions();

  // Get accessible stage names for filtering
  const accessibleStageNames = useMemo(() => {
    return consolidatedStages.map(stage => stage.stage_name.toLowerCase());
  }, [consolidatedStages]);

  // Apply all filters
  const filteredJobs = useMemo(() => {
    let filtered = jobs;

    // Filter by user stage permissions - only show jobs in stages user can access
    filtered = filtered.filter(job => {
      if (!job.current_stage_name && !job.display_stage_name) return false;
      
      const stageNameForCheck = (job.display_stage_name || job.current_stage_name).toLowerCase();
      return accessibleStageNames.includes(stageNameForCheck);
    });

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(job => {
        if (statusFilter === 'completed') {
          return job.status === 'Completed' || job.is_completed;
        }
        return job.status?.toLowerCase() === statusFilter.toLowerCase();
      });
    }

    // Apply stage filter (using display name for master queue awareness)
    if (stageFilter) {
      filtered = filtered.filter(job => {
        const stageNameForFiltering = job.display_stage_name || job.current_stage_name;
        return stageNameForFiltering?.toLowerCase() === stageFilter.toLowerCase();
      });
    }

    // Apply category filter
    if (categoryFilter) {
      filtered = filtered.filter(job => 
        job.category_name?.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    // Apply search query
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(job => {
        const searchFields = [
          job.wo_no,
          job.customer,
          job.reference,
          job.category_name,
          job.status,
          job.current_stage_name,
          job.display_stage_name
        ].filter(Boolean);

        return searchFields.some(field => 
          field?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [jobs, statusFilter, stageFilter, categoryFilter, searchQuery, accessibleStageNames]);

  // Calculate job statistics
  const jobStats = useMemo(() => {
    return {
      total: filteredJobs.length,
      pending: filteredJobs.filter(job => job.is_pending).length,
      active: filteredJobs.filter(job => job.is_active).length,
      completed: filteredJobs.filter(job => job.is_completed).length,
      urgent: filteredJobs.filter(job => {
        if (!job.due_date) return false;
        const dueDate = new Date(job.due_date);
        const today = new Date();
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 2; // Due within 2 days
      }).length
    };
  }, [filteredJobs]);

  return {
    filteredJobs,
    jobStats,
    accessibleStages: consolidatedStages,
    isLoading: stagesLoading
  };
};
