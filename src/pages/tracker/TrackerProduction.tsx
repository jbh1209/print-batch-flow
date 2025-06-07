
import React, { useState, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FilteredJobsView } from "@/components/tracker/production/FilteredJobsView";
import { useSimpleFactoryJobs } from "@/hooks/tracker/useSimpleFactoryJobs";
import { useSimpleJobActions } from "@/hooks/tracker/useSimpleJobActions";
import { useUnifiedJobFiltering } from "@/hooks/tracker/useUnifiedJobFiltering";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductionHeader } from "@/components/tracker/production/ProductionHeader";
import { ProductionStats } from "@/components/tracker/production/ProductionStats";
import { ProductionSorting } from "@/components/tracker/production/ProductionSorting";
import { CategoryInfoBanner } from "@/components/tracker/production/CategoryInfoBanner";
import { TrackerErrorBoundary } from "@/components/tracker/error-boundaries/TrackerErrorBoundary";
import { DataLoadingFallback } from "@/components/tracker/error-boundaries/DataLoadingFallback";

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
  
  // Use simplified hooks
  const { jobs, isLoading: jobsLoading, refreshJobs } = useSimpleFactoryJobs();
  const { startStage, completeStage, isProcessing } = useSimpleJobActions(refreshJobs);
  
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Use context filters or local filters
  const currentFilters = context?.filters || activeFilters;

  // Convert simple factory jobs to accessible jobs format for filtering
  const accessibleJobs = useMemo(() => {
    return jobs.map(job => ({
      job_id: job.job_id,
      wo_no: job.wo_no,
      customer: job.customer,
      status: job.status,
      due_date: job.due_date,
      reference: '',
      category_id: null,
      category_name: '',
      category_color: '',
      current_stage_id: job.stage_id,
      current_stage_name: job.stage_name,
      current_stage_color: job.stage_color,
      current_stage_status: job.stage_status,
      user_can_view: true,
      user_can_edit: true,
      user_can_work: true,
      user_can_manage: true,
      workflow_progress: 0,
      total_stages: 0,
      completed_stages: 0
    }));
  }, [jobs]);

  // Use unified filtering
  const { 
    filteredJobs, 
    jobStats, 
    isLoading: filteringLoading 
  } = useUnifiedJobFiltering({
    jobs: accessibleJobs,
    statusFilter: currentFilters.status,
    stageFilter: currentFilters.stage,
    categoryFilter: currentFilters.category
  });

  // Apply sorting
  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
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
  }, [filteredJobs, sortBy, sortOrder]);

  const jobsWithoutCategory = useMemo(() => {
    return accessibleJobs.filter(job => !job.category_id);
  }, [accessibleJobs]);

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
          // For now, treat QR scan as a start action
          success = await startStage(jobId, stageId);
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

  const isLoading = jobsLoading || filteringLoading;

  console.log("🔍 TrackerProduction - Simplified System Results:", {
    totalJobs: jobs.length,
    filteredJobs: filteredJobs.length,
    sortedJobs: sortedJobs.length,
    currentFilters
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading production data...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <TrackerErrorBoundary componentName="Production Header">
        <ProductionHeader
          isMobile={isMobile}
          onQRScan={handleQRScan}
          onStageAction={handleStageAction}
          onConfigureStages={handleConfigureStages}
          onQRScanner={handleQRScanner}
        />
      </TrackerErrorBoundary>

      {/* Statistics */}
      <TrackerErrorBoundary componentName="Production Stats">
        <ProductionStats 
          jobs={filteredJobs} 
          jobsWithoutCategory={jobsWithoutCategory}
        />
      </TrackerErrorBoundary>

      {/* Info Banner */}
      <TrackerErrorBoundary componentName="Category Info Banner">
        <CategoryInfoBanner 
          jobsWithoutCategoryCount={jobsWithoutCategory.length}
        />
      </TrackerErrorBoundary>

      {/* Sorting Controls */}
      <TrackerErrorBoundary componentName="Production Sorting">
        <ProductionSorting
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      </TrackerErrorBoundary>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto bg-white rounded-lg border">
          <TrackerErrorBoundary 
            componentName="Jobs View"
            fallback={
              <DataLoadingFallback
                componentName="production jobs"
                onRetry={refreshJobs}
                showDetails={false}
              />
            }
          >
            <FilteredJobsView
              jobs={sortedJobs}
              selectedStage={currentFilters.stage}
              isLoading={isLoading}
              onStageAction={handleStageAction}
            />
          </TrackerErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default TrackerProduction;
