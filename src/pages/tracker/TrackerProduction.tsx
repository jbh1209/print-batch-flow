import React, { useState, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { useRealTimeJobStages } from "@/hooks/tracker/useRealTimeJobStages";
import { useProductionJobEnrichment } from "@/hooks/tracker/useProductionJobEnrichment";
import { useProductionSidebarData } from "@/hooks/tracker/useProductionSidebarData";
import { useProductionFiltering } from "@/hooks/tracker/useProductionFiltering";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductionHeader } from "@/components/tracker/production/ProductionHeader";
import { ProductionStats } from "@/components/tracker/production/ProductionStats";
import { ProductionSorting } from "@/components/tracker/production/ProductionSorting";
import { CategoryInfoBanner } from "@/components/tracker/production/CategoryInfoBanner";
import { ProductionJobsView } from "@/components/tracker/production/ProductionJobsView";
import { TrackerErrorBoundary } from "@/components/tracker/error-boundaries/TrackerErrorBoundary";
import { DataLoadingFallback } from "@/components/tracker/error-boundaries/DataLoadingFallback";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";

interface TrackerProductionContext {
  activeTab: string;
  filters: any;
  selectedStageId?: string;
  onStageSelect?: (stageId: string | null) => void;
  onFilterChange?: (filters: any) => void;
  setSidebarData?: (data: any) => void;
}

const TrackerProduction = () => {
  const context = useOutletContext<TrackerProductionContext>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Fetch data using the Master Order Modal pattern
  const { 
    jobs, 
    isLoading: jobsLoading, 
    error: jobsError,
    fetchJobs 
  } = useProductionJobs();
  
  const { 
    jobStages, 
    isLoading: stagesLoading, 
    error: stagesError,
    startStage,
    completeStage,
    refreshStages,
    lastUpdate
  } = useRealTimeJobStages(jobs);

  // Enrich jobs with real stage data like Master Order Modal
  const { enrichedJobs } = useProductionJobEnrichment({ jobs, jobStages });
  
  const { 
    consolidatedStages, 
    activeJobs,
    getJobCountForStage,
    getJobCountByStatus 
  } = useProductionSidebarData({ jobStages, enrichedJobs });

  const [activeFilters, setActiveFilters] = useState<any>({});
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  // Use context filters or local filters
  const currentFilters = context?.filters || activeFilters;

  // Filter jobs using production-specific logic
  const { filteredJobs } = useProductionFiltering({ 
    enrichedJobs, 
    filters: currentFilters, 
    selectedStageId 
  });

  const isLoading = jobsLoading || stagesLoading;
  const error = jobsError || stagesError;

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
    return enrichedJobs.filter(job => !job.categories?.id);
  }, [enrichedJobs]);

  const handleFilterChange = (filters: any) => {
    console.log("🔄 Filter change:", filters);
    setActiveFilters(filters);
    context?.onFilterChange?.(filters);
  };

  const handleStageSelect = (stageId: string | null) => {
    console.log("🎯 Stage selected:", stageId);
    setSelectedStageId(stageId);
    
    if (stageId) {
      // Find stage name from consolidated stages
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
      
      if (action === 'start') {
        const success = await startStage(stageId);
        if (success) {
          toast.success('Stage started successfully');
        }
      } else if (action === 'complete') {
        const success = await completeStage(stageId);
        if (success) {
          toast.success('Stage completed successfully');
        }
      }
      
      // Refresh data
      await refreshStages();
      
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

  const handleRefresh = async () => {
    await Promise.all([fetchJobs(), refreshStages()]);
  };

  console.log("🔍 TrackerProduction - Data:", {
    totalJobs: jobs.length,
    enrichedJobs: enrichedJobs.length,
    filteredJobs: filteredJobs.length,
    sortedJobs: sortedJobs.length,
    currentFilters,
    selectedStageId,
    lastUpdate: lastUpdate?.toLocaleTimeString()
  });

  // Populate sidebar data for layout
  React.useEffect(() => {
    if (context?.setSidebarData) {
      context.setSidebarData({
        consolidatedStages,
        getJobCountForStage,
        getJobCountByStatus,
        totalActiveJobs: activeJobs.length,
      });
    }
  }, [consolidatedStages, activeJobs.length, context?.setSidebarData, getJobCountForStage, getJobCountByStatus]);

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
              lastUpdated={lastUpdate}
              isRefreshing={isLoading}
              onRefresh={handleRefresh}
              getTimeSinceLastUpdate={() => lastUpdate ? `${Math.floor((Date.now() - lastUpdate.getTime()) / 60000)}m ago` : null}
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
      {/* Main Content */}
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
              lastUpdated={lastUpdate}
              isRefreshing={isLoading}
              onRefresh={handleRefresh}
              getTimeSinceLastUpdate={() => lastUpdate ? `${Math.floor((Date.now() - lastUpdate.getTime()) / 60000)}m ago` : null}
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
                    onRetry={handleRefresh}
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
                <ProductionJobsView
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

export default TrackerProduction;
