import React, { useState, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FilteredJobsView } from "@/components/tracker/production/FilteredJobsView";
import { useUnifiedProductionData } from "@/hooks/tracker/useUnifiedProductionData";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductionHeader } from "@/components/tracker/production/ProductionHeader";
import { ProductionStats } from "@/components/tracker/production/ProductionStats";
import { ProductionSorting } from "@/components/tracker/production/ProductionSorting";
import { CategoryInfoBanner } from "@/components/tracker/production/CategoryInfoBanner";
import { TrackerErrorBoundary } from "@/components/tracker/error-boundaries/TrackerErrorBoundary";
import { DataLoadingFallback } from "@/components/tracker/error-boundaries/DataLoadingFallback";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import { ProductionDataProvider } from "@/contexts/ProductionDataContext";

interface TrackerProductionContext {
  activeTab: string;
  filters: any;
  selectedStageId?: string;
  onStageSelect?: (stageId: string | null) => void;
  onFilterChange?: (filters: any) => void;
}

const TrackerProduction = () => {
  const context = useOutletContext<TrackerProductionContext & {setSidebarData?: (data: any) => void}>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Use unified production data
  const { 
    jobs, 
    activeJobs,
    orphanedJobs,
    consolidatedStages,
    isLoading, 
    isRefreshing,
    lastUpdated,
    error,
    getFilteredJobs,
    getJobStats,
    refreshJobs,
    getTimeSinceLastUpdate
  } = useUnifiedProductionData();
  
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  // Use context filters or local filters
  const currentFilters = context?.filters || activeFilters;

  // Get filtered jobs using the unified hook
  const filteredJobs = useMemo(() => {
    return getFilteredJobs({
      statusFilter: currentFilters.status,
      stageFilter: currentFilters.stage,
      categoryFilter: currentFilters.category,
      searchQuery: currentFilters.search
    });
  }, [getFilteredJobs, currentFilters]);

  // Get job statistics
  const jobStats = useMemo(() => {
    return getJobStats(filteredJobs);
  }, [getJobStats, filteredJobs]);

  // Apply sorting to the filtered jobs
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

  // Get jobs without categories
  const jobsWithoutCategory = useMemo(() => {
    return activeJobs.filter(job => !job.category_id);
  }, [activeJobs]);

  const handleFilterChange = (filters: any) => {
    console.log("🔄 Filter change:", filters);
    setActiveFilters(filters);
    context?.onFilterChange?.(filters);
  };

  const handleStageSelect = (stageId: string | null) => {
    console.log("🎯 Stage selected:", stageId);
    setSelectedStageId(stageId);
    
    if (stageId) {
      const stage = consolidatedStages.find(s => s.stage_id === stageId);
      if (stage) {
        handleFilterChange({ stage: stage.stage_name });
      }
    } else {
      handleFilterChange({ stage: null });
    }
  };

  const handleStageAction = async (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => {
    try {
      console.log(`Stage action: ${action} for job ${jobId}, stage ${stageId}`);
      
      toast.info(`${action} action performed - data will refresh automatically`);
      
      // Trigger refresh to get updated data
      setTimeout(() => {
        refreshJobs();
      }, 1000);

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

  console.log("🔍 TrackerProduction - Unified Data:", {
    totalJobs: jobs.length,
    activeJobs: activeJobs.length,
    orphanedJobs: orphanedJobs.length,
    filteredJobs: filteredJobs.length,
    sortedJobs: sortedJobs.length,
    currentFilters,
    consolidatedStages: consolidatedStages.length,
    lastUpdated: lastUpdated?.toLocaleTimeString()
  });

  // --- ADD: Populate sidebar data for layout ---
  React.useEffect(() => {
    if (context?.setSidebarData) {
      context.setSidebarData({
        consolidatedStages,
        activeJobs,
      });
    }
    // Keep this up-to-date as deps change
  }, [consolidatedStages, activeJobs, context?.setSidebarData]);

  if (error) {
    return (
      <div className="flex-1 p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Error loading production data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <RefreshIndicator
              lastUpdated={lastUpdated}
              isRefreshing={isRefreshing}
              onRefresh={refreshJobs}
              getTimeSinceLastUpdate={getTimeSinceLastUpdate}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading production data...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Main Content: condensed to fill space, sidebar removed */}
      <TrackerErrorBoundary componentName="Production Header">
        <div className="border-b bg-white p-2 sm:p-2">
          <div className="flex items-center justify-between">
            <ProductionHeader
              isMobile={isMobile}
              onQRScan={handleQRScan}
              onStageAction={handleStageAction}
              onConfigureStages={handleConfigureStages}
              onQRScanner={handleQRScanner}
            />
            <RefreshIndicator
              lastUpdated={lastUpdated}
              isRefreshing={isRefreshing}
              onRefresh={refreshJobs}
              getTimeSinceLastUpdate={getTimeSinceLastUpdate}
            />
          </div>
        </div>
      </TrackerErrorBoundary>

      <div className="flex-1 overflow-hidden p-1 sm:p-2">
        <div className="h-full flex flex-col space-y-2">
          <TrackerErrorBoundary componentName="Production Stats">
            <ProductionStats 
              jobs={filteredJobs}
              jobsWithoutCategory={jobsWithoutCategory}
            />
          </TrackerErrorBoundary>
          <TrackerErrorBoundary componentName="Category Info Banner">
            <CategoryInfoBanner 
              jobsWithoutCategoryCount={jobsWithoutCategory.length}
            />
          </TrackerErrorBoundary>
          <TrackerErrorBoundary componentName="Production Sorting">
            <ProductionSorting
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          </TrackerErrorBoundary>
          {/* Jobs List */}
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
                {/* Header Row */}
                <div className="flex gap-x-0 items-center text-xs font-bold px-2 py-1 border-b bg-gray-50">
                  <span style={{ width: 26 }} className="text-center">Due</span>
                  <span className="flex-1">Job Name / Number</span>
                  <span className="w-28">Current Stage</span>
                  <span className="w-20">Progress</span>
                </div>
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
      </div>
    </div>
  );
};
export default function TrackerProductionWithProvider() {
  // Use the provider at the page level
  return (
    <ProductionDataProvider>
      <TrackerProduction />
    </ProductionDataProvider>
  );
}
