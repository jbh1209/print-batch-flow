import React, { useState, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { useRealTimeJobStages } from "@/hooks/tracker/useRealTimeJobStages";
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

  const [activeFilters, setActiveFilters] = useState<any>({});
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const currentFilters = context?.filters || activeFilters;
  const isLoading = jobsLoading || stagesLoading;
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

  // Simple sidebar data - direct counting like Master Order Modal
  const sidebarData = useMemo(() => {
    const stageMap = new Map();
    
    // Build stages from actual job stage instances
    jobStages.forEach(stage => {
      if (stage.production_stage && !stageMap.has(stage.production_stage_id)) {
        stageMap.set(stage.production_stage_id, {
          stage_id: stage.production_stage_id,
          stage_name: stage.production_stage.name,
          stage_color: stage.production_stage.color,
        });
      }
    });
    
    const consolidatedStages = Array.from(stageMap.values()).sort((a, b) => a.stage_name.localeCompare(b.stage_name));

    // Simple counting - jobs with ACTIVE stages for each production stage
    const getJobCountForStage = (stageName: string) => {
      return enrichedJobs.filter(job => 
        job.stages.some(stage => 
          stage.stage_name === stageName && stage.status === 'active'
        )
      ).length;
    };

    const getJobCountByStatus = (status: string) => {
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
    };

    return {
      consolidatedStages,
      getJobCountForStage,
      getJobCountByStatus,
      totalActiveJobs: enrichedJobs.length,
    };
  }, [enrichedJobs, jobStages]);

  // Simple filtering - direct like Master Order Modal
  const filteredJobs = useMemo(() => {
    let filtered = enrichedJobs;

    // Filter by selected stage - show jobs that have ACTIVE stages for the selected production stage
    if (selectedStageId && currentFilters.stage) {
      filtered = filtered.filter(job => 
        job.stages.some(stage => 
          stage.stage_name === currentFilters.stage && stage.status === 'active'
        )
      );
    }

    // Other filters
    if (currentFilters.status) {
      // Handle status filtering logic here if needed
    }

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

  const handleFilterChange = (filters: any) => {
    setActiveFilters(filters);
    context?.onFilterChange?.(filters);
  };

  const handleStageSelect = (stageId: string | null) => {
    setSelectedStageId(stageId);
    
    if (stageId) {
      const stage = sidebarData.consolidatedStages.find(s => s.stage_id === stageId);
      if (stage) {
        handleFilterChange({ stage: stage.stage_name });
      }
    } else {
      handleFilterChange({ stage: null });
    }
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
