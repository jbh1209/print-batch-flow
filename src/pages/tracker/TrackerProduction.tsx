
import React, { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { useRealTimeJobStages } from "@/hooks/tracker/useRealTimeJobStages";
import { useProductionStageCounts } from "@/hooks/tracker/useProductionStageCounts";
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
  
  // Simple data fetching - like Master Order Modal
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

  const {
    stageCounts,
    isLoading: countsLoading,
    refreshCounts
  } = useProductionStageCounts();

  const [activeFilters, setActiveFilters] = useState<any>({});
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);

  const currentFilters = context?.filters || activeFilters;
  const isLoading = jobsLoading || stagesLoading || countsLoading;
  const error = jobsError || stagesError;

  // Simple job enrichment - directly map like Master Order Modal does
  const enrichedJobs = useMemo(() => {
    return jobs.map(job => {
      const stages = jobStages.filter(stage => stage.job_id === job.id);
      const activeStage = stages.find(stage => stage.status === 'active');
      const totalStages = stages.length;
      const completedStages = stages.filter(stage => stage.status === 'completed').length;
      const workflowProgress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

      return {
        ...job,
        job_id: job.id, // For Master Order Modal compatibility
        stages: stages.map(stage => ({
          ...stage,
          stage_name: stage.production_stage?.name || 'Unknown Stage',
          stage_color: stage.production_stage?.color || '#6B7280',
        })),
        current_stage_name: activeStage?.production_stage?.name || 'No Active Stage',
        active_stage_id: activeStage?.production_stage_id || null,
        workflow_progress: workflowProgress,
        total_stages: totalStages,
        completed_stages: completedStages
      };
    });
  }, [jobs, jobStages]);

  // Simple filtering based on selected stage
  const filteredJobs = useMemo(() => {
    let filtered = enrichedJobs;

    // Filter by selected stage - show jobs that have ACTIVE or PENDING stages for the selected production stage
    if (selectedStageId && currentFilters.stage) {
      filtered = filtered.filter(job => 
        job.stages.some(stage => 
          stage.production_stage_id === selectedStageId && 
          (stage.status === 'active' || stage.status === 'pending')
        )
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
  }, [enrichedJobs, currentFilters, selectedStageId]);

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
    return enrichedJobs.filter(job => !job.categories?.id);
  }, [enrichedJobs]);

  // Prepare sidebar data from stage counts
  const sidebarData = useMemo(() => {
    return {
      consolidatedStages: stageCounts.map(count => ({
        stage_id: count.stage_id,
        stage_name: count.stage_name,
        stage_color: count.stage_color,
      })),
      getJobCountForStage: (stageName: string) => {
        const stage = stageCounts.find(s => s.stage_name === stageName);
        return stage ? stage.total_jobs : 0;
      },
      getJobCountByStatus: (status: string) => {
        return enrichedJobs.filter(job => {
          const hasActiveStage = job.stages.some(stage => stage.status === 'active');
          const hasPendingStages = job.stages.some(stage => stage.status === 'pending');
          const allCompleted = job.stages.length > 0 && job.stages.every(stage => stage.status === 'completed');
          
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
      totalActiveJobs: enrichedJobs.length,
    };
  }, [stageCounts, enrichedJobs]);

  const handleFilterChange = (filters: any) => {
    setActiveFilters(filters);
    context?.onFilterChange?.(filters);
  };

  const handleStageSelect = (stageId: string | null) => {
    setSelectedStageId(stageId);
    
    if (stageId) {
      const stage = stageCounts.find(s => s.stage_id === stageId);
      if (stage) {
        handleFilterChange({ stage: stage.stage_name });
      }
    } else {
      handleFilterChange({ stage: null });
    }
  };

  const handleJobClick = (job: any) => {
    setSelectedJob(job);
  };

  const handleCloseModal = () => {
    setSelectedJob(null);
  };

  const handleStageAction = async (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => {
    try {
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
      
      await Promise.all([refreshStages(), refreshCounts()]);
      
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
    await Promise.all([fetchJobs(), refreshStages(), refreshCounts()]);
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

      {/* Master Order Modal */}
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
