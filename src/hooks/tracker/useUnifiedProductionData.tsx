import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserStagePermissions } from "./useUserStagePermissions";
import { toast } from "sonner";
import { formatWONumber } from "@/utils/woNumberFormatter";
import { useProductionDataContext } from "@/contexts/ProductionDataContext";

export const useUnifiedProductionData = () => {
  // Use the context for all data retrieval and functions
  const {
    jobs,
    activeJobs,
    orphanedJobs,
    consolidatedStages,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
    getTimeSinceLastUpdate,
  } = useProductionDataContext();

  // Filter and stats functions pass-through
  const getFilteredJobs = ({
    statusFilter,
    stageFilter,
    categoryFilter,
    searchQuery,
  }: {
    statusFilter?: string | null;
    stageFilter?: string | null;
    categoryFilter?: string | null;
    searchQuery?: string;
  }) => {
    let filtered = activeJobs;
    if (statusFilter) {
      filtered = filtered.filter(j => (statusFilter === 'completed' ? j.is_completed : j.status === statusFilter));
    }
    if (stageFilter) {
      filtered = filtered.filter(j => j.display_stage_name === stageFilter || j.current_stage_name === stageFilter);
    }
    if (categoryFilter) {
      filtered = filtered.filter(j => j.category_name === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(j =>
        (j.wo_no?.toLowerCase().includes(q) ||
          j.customer?.toLowerCase().includes(q) ||
          j.reference?.toLowerCase().includes(q) ||
          j.category_name?.toLowerCase().includes(q))
      );
    }
    return filtered;
  };

  const getJobStats = (filteredJobs: any[]) => ({
    total: filteredJobs.length,
    pending: filteredJobs.filter(j => j.is_pending).length,
    active: filteredJobs.filter(j => j.is_active).length,
    completed: filteredJobs.filter(j => j.is_completed).length,
    orphaned: filteredJobs.filter(j => j.is_orphaned).length,
  });

  return {
    jobs,
    activeJobs,
    orphanedJobs,
    consolidatedStages,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    getFilteredJobs,
    getJobStats,
    refreshJobs: refresh,
    getTimeSinceLastUpdate,
  };
};
