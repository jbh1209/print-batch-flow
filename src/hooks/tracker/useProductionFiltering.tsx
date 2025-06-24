
import { useMemo } from "react";

interface ProductionFilteringProps {
  enrichedJobs: any[];
  filters: any;
  selectedStageId?: string | null;
}

export const useProductionFiltering = ({ enrichedJobs, filters, selectedStageId }: ProductionFilteringProps) => {
  
  const filteredJobs = useMemo(() => {
    let filtered = enrichedJobs;

    // Filter by selected stage - show jobs that have ACTIVE stages for the selected production stage
    if (selectedStageId && filters.stage) {
      filtered = filtered.filter(job => 
        job.stages.some(stage => 
          stage.stage_name === filters.stage && stage.status === 'active'
        )
      );
    }

    // Filter by status
    if (filters.status) {
      if (filters.status === 'completed') {
        filtered = filtered.filter(job => job.stage_status === 'completed');
      } else if (filters.status === 'in-progress') {
        filtered = filtered.filter(job => job.stage_status === 'active');
      } else if (filters.status === 'pending') {
        filtered = filtered.filter(job => job.stage_status === 'pending');
      } else {
        filtered = filtered.filter(job => job.status === filters.status);
      }
    }

    // Filter by category
    if (filters.category) {
      filtered = filtered.filter(job => job.category_name === filters.category);
    }

    // Filter by search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(job =>
        job.wo_no?.toLowerCase().includes(q) ||
        job.customer?.toLowerCase().includes(q) ||
        job.reference?.toLowerCase().includes(q) ||
        job.category_name?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [enrichedJobs, filters, selectedStageId]);

  return { filteredJobs };
};
