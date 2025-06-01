
import React, { useState, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FilteredJobsView } from "@/components/tracker/production/FilteredJobsView";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductionHeader } from "@/components/tracker/production/ProductionHeader";
import { ProductionStats } from "@/components/tracker/production/ProductionStats";
import { ProductionSorting } from "@/components/tracker/production/ProductionSorting";
import { CategoryInfoBanner } from "@/components/tracker/production/CategoryInfoBanner";

interface TrackerProductionContext {
  activeTab: string;
  filters: any;
  selectedStageId?: string;
  onStageSelect?: (stageId: string | null) => void;
  onFilterChange?: (filters: any) => void;
}

const TrackerProduction = () => {
  const context = useOutletContext<TrackerProductionContext>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { 
    jobs, 
    isLoading, 
    refreshJobs, 
    startStage, 
    completeStage, 
    recordQRScan 
  } = useEnhancedProductionJobs();
  
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Use context filters or local filters
  const currentFilters = context?.filters || activeFilters;

  // Filter and sort jobs based on selected stage or other filters
  const filteredJobs = useMemo(() => {
    let filtered = jobs;

    // Apply stage filter
    if (currentFilters.stage) {
      filtered = filtered.filter(job => job.current_stage === currentFilters.stage);
    } else if (currentFilters.status) {
      filtered = filtered.filter(job => 
        job.status?.toLowerCase() === currentFilters.status.toLowerCase()
      );
    }
    // If no filters are applied, show all jobs

    // Sort the filtered jobs
    filtered = [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'wo_no') {
        aValue = a.wo_no || '';
        bValue = b.wo_no || '';
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'asc' ? comparison : -comparison;
      } else if (sortBy === 'due_date') {
        aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
        bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

    return filtered;
  }, [jobs, currentFilters, sortBy, sortOrder]);

  // Get jobs without categories (need category assignment instead of workflow init)
  const jobsWithoutCategory = useMemo(() => {
    return jobs.filter(job => !job.category_id);
  }, [jobs]);

  const handleFilterChange = (filters: any) => {
    setActiveFilters(filters);
    context?.onFilterChange?.(filters);
  };

  const handleStageAction = async (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => {
    try {
      console.log(`Stage action: ${action} for job ${jobId}, stage ${stageId}`);
      
      let success = false;
      
      switch (action) {
        case 'start':
          success = await startStage(jobId, stageId);
          break;
        case 'complete':
          success = await completeStage(jobId, stageId);
          break;
        case 'qr-scan':
          success = await recordQRScan(jobId, stageId);
          break;
      }

      if (success) {
        // Refresh will happen automatically via the hook's real-time subscription
      }
    } catch (error) {
      console.error('Error performing stage action:', error);
      toast.error('Failed to perform stage action');
    }
  };

  const handleQRScan = (data: any) => {
    if (data?.jobId && data?.stageId) {
      handleStageAction(data.jobId, data.stageId, data.action || 'qr-scan');
    }
  };

  const handleConfigureStages = () => {
    navigate('/tracker/admin');
  };

  const handleQRScanner = () => {
    if (isMobile) {
      toast.info('QR scanner is available in the header');
    } else {
      toast.info('QR scanner functionality - to be implemented');
    }
  };

  const handleSort = (field: 'wo_no' | 'due_date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <ProductionHeader
        isMobile={isMobile}
        onQRScan={handleQRScan}
        onStageAction={handleStageAction}
        onConfigureStages={handleConfigureStages}
        onQRScanner={handleQRScanner}
      />

      {/* Statistics */}
      <ProductionStats 
        jobs={jobs}
        jobsWithoutCategory={jobsWithoutCategory}
      />

      {/* Info Banner */}
      <CategoryInfoBanner 
        jobsWithoutCategoryCount={jobsWithoutCategory.length}
      />

      {/* Sorting Controls */}
      <ProductionSorting
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
      />

      {/* Main Content - Now takes full width */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto bg-white rounded-lg border">
          <FilteredJobsView
            jobs={filteredJobs}
            selectedStage={currentFilters.stage}
            isLoading={isLoading}
            onStageAction={handleStageAction}
          />
        </div>
      </div>
    </div>
  );
};

export default TrackerProduction;
