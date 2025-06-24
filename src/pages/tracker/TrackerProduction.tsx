
import React, { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductionHeader } from "@/components/tracker/production/ProductionHeader";
import { ProductionStats } from "@/components/tracker/production/ProductionStats";
import { ProductionSorting } from "@/components/tracker/production/ProductionSorting";
import { CategoryInfoBanner } from "@/components/tracker/production/CategoryInfoBanner";
import { ProductionJobsView } from "@/components/tracker/production/ProductionJobsView";
import { MasterOrderModal } from "@/components/tracker/modals/MasterOrderModal";
import { TrackerErrorBoundary } from "@/components/tracker/error-boundaries/TrackerErrorBoundary";
import { DataLoadingFallback } from "@/components/tracker/error-boundaries/DataLoadingFallback";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

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
  const isMobile = useIsMobile();
  
  // Use the same data source as the working Kanban page
  const { 
    jobs, 
    isLoading, 
    error,
    startJob,
    completeJob,
    refreshJobs 
  } = useAccessibleJobs({
    permissionType: 'manage' // Get all jobs with manage permissions like ProductionManagerView
  });

  const [activeFilters, setActiveFilters] = useState<any>({});
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [lastUpdate] = useState<Date>(new Date());

  const currentFilters = context?.filters || activeFilters;

  // Simple, direct filtering - just like the working Kanban page
  const filteredJobs = useMemo(() => {
    let filtered = jobs;

    // Filter by selected stage - show jobs that are CURRENTLY IN that stage
    if (selectedStageId && currentFilters.stage) {
      const selectedStageName = currentFilters.stage;
      filtered = filtered.filter(job => 
        job.current_stage_name === selectedStageName ||
        job.display_stage_name === selectedStageName
      );
    }

    // Search filter
    if (currentFilters.search) {
      const q = currentFilters.search.toLowerCase();
      filtered = filtered.filter(job =>
        job.wo_no?.toLowerCase().includes(q) ||
        job.customer?.toLowerCase().includes(q) ||
        job.reference?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [jobs, currentFilters, selectedStageId]);

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
    return jobs.filter(job => !job.category_id);
  }, [jobs]);

  // Get unique stages from the actual job data - like Kanban does
  const consolidatedStages = useMemo(() => {
    const stageMap = new Map();
    
    jobs.forEach(job => {
      if (job.current_stage_id && job.current_stage_name) {
        stageMap.set(job.current_stage_id, {
          stage_id: job.current_stage_id,
          stage_name: job.current_stage_name,
          stage_color: job.current_stage_color || '#6B7280'
        });
      }
    });
    
    return Array.from(stageMap.values());
  }, [jobs]);

  // Prepare sidebar data from the actual AccessibleJob data
  const sidebarData = useMemo(() => {
    return {
      consolidatedStages,
      getJobCountForStage: (stageName: string) => {
        return jobs.filter(job => 
          job.current_stage_name === stageName || 
          job.display_stage_name === stageName
        ).length;
      },
      getJobCountByStatus: (status: string) => {
        return jobs.filter(job => {
          const hasActiveStage = job.current_stage_status === 'active';
          const hasPendingStages = job.current_stage_status === 'pending';
          const allCompleted = job.workflow_progress === 100;
          
          switch (status) {
            case 'completed': return allCompleted;
            case 'in-progress': return hasActiveStage;
            case 'pending': return hasPendingStages;
            case 'overdue':
              if (!job.due_date) return false;
              const dueDate = new Date(job.due_date);
              const today = new Date();
              return dueDate < today && !allCompleted;
            default: return false;
          }
        }).length;
      },
      totalActiveJobs: jobs.length,
    };
  }, [consolidatedStages, jobs]);

  const handleFilterChange = (filters: any) => {
    setActiveFilters(filters);
    context?.onFilterChange?.(filters);
  };

  const handleStageSelect = (stageId: string | null) => {
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

  const handleJobClick = (job: any) => {
    // Use AccessibleJob directly - no conversion needed
    setSelectedJob(job);
  };

  const handleCloseModal = () => {
    setSelectedJob(null);
  };

  const handleStageAction = async (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => {
    try {
      if (action === 'start') {
        const success = await startJob(jobId, stageId);
        if (success) {
          toast.success('Stage started successfully');
        }
      } else if (action === 'complete') {
        const success = await completeJob(jobId, stageId);
        if (success) {
          toast.success('Stage completed successfully');
        }
      }
      
      await refreshJobs();
      
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

  const handleQRScanner = () => {
    if (isMobile) {
      toast.info('QR scanner is available in the header');
    } else {
      toast.info('QR scanner functionality - to be implemented');
    }
  };

  const handleConfigureStages = () => {
    toast.info('Stage configuration - navigate to Admin section');
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
    await refreshJobs();
  };

  // Set sidebar data for context
  React.useEffect(() => {
    if (context?.setSidebarData) {
      context.setSidebarData(sidebarData);
    }
  }, [sidebarData, context?.setSidebarData]);

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
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
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
                    onJobClick={handleJobClick}
                    onStageAction={handleStageAction}
                  />
                </TrackerErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Use the actual Master Order Modal - no copy needed */}
      {selectedJob && (
        <MasterOrderModal
          isOpen={true}
          onClose={handleCloseModal}
          job={selectedJob}
          onRefresh={handleRefresh}
        />
      )}
    </>
  );
};

export default TrackerProduction;
