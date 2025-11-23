import React, { useState, useMemo, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJobStageInstancesMap } from "@/hooks/tracker/useJobStageInstancesMap";
import { getJobWorkflowStages, shouldJobAppearInWorkflowStage } from "@/utils/productionWorkflowUtils";
import { ProductionHeader } from "@/components/tracker/production/ProductionHeader";
import { ProductionStats } from "@/components/tracker/production/ProductionStats";
import { ProductionSorting } from "@/components/tracker/production/ProductionSorting";
import { CategoryInfoBanner } from "@/components/tracker/production/CategoryInfoBanner";
import { ProductionJobsView } from "@/components/tracker/production/ProductionJobsView";
import { DynamicProductionSidebar } from "@/components/tracker/production/DynamicProductionSidebar";
import { MasterOrderModal } from "@/components/tracker/modals/MasterOrderModal";
import { TrackerErrorBoundary } from "@/components/tracker/error-boundaries/TrackerErrorBoundary";
import { DataLoadingFallback } from "@/components/tracker/error-boundaries/DataLoadingFallback";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import JobPartAssignmentManager from "@/components/jobs/JobPartAssignmentManager";
// Removed complex workflow utilities - using direct stage fields instead
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
  
  // Cache key to force fresh data fetching on mount
  const [cacheKey] = useState(() => Date.now());
  
  const { 
    jobs, 
    isLoading, 
    error,
    startJob,
    completeJob,
    refreshJobs,
    invalidateCache
  } = useAccessibleJobs({
    permissionType: 'manage'
  });

  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [partAssignmentJob, setPartAssignmentJob] = useState<AccessibleJob | null>(null);
  const [lastUpdate] = useState<Date>(new Date());

  // Get visible job IDs for stage instance fetching
  const visibleJobIds = useMemo(() => {
    const filtered = jobs
      .filter(job => 
        job.status !== 'completed' && 
        job.status !== 'cancelled' &&
        !job.is_in_batch_processing
      )
      .map(job => job.job_id);
    
    // Debug: Check if D428201 is in the list
    const d428201 = jobs.find(j => j.wo_no === 'D428201');
    console.log('[VisibleJobIds] D428201 found:', d428201?.job_id);
    console.log('[VisibleJobIds] D428201 included:', filtered.includes(d428201?.job_id || ''));
    console.log('[VisibleJobIds] Total jobs:', filtered.length);
    
    return filtered;
  }, [jobs]);

  // Fetch stage instances for all jobs to enable parallel stage computation
  const { data: jobStageInstancesMap } = useJobStageInstancesMap(
    visibleJobIds,
    visibleJobIds.length > 0,
    cacheKey
  );

  // Enhance jobs with parallel stage data when available
  const enhancedJobs = useMemo(() => {
    if (!jobStageInstancesMap || jobStageInstancesMap.size === 0) {
      return jobs;
    }

    return jobs.map(job => {
      const stageInstances = jobStageInstancesMap.get(job.job_id);
      if (!stageInstances) return job;

      const workflowStages = getJobWorkflowStages(stageInstances, job.job_id);
      
      // Debug: Log D428201 processing
      if (job.wo_no === 'D428201') {
        console.log('[TrackerProd] D428201 stage instances:', stageInstances.map(s => ({
          name: s.production_stage?.name,
          order: s.stage_order,
          part: s.part_assignment,
          status: s.status
        })));
        console.log('[TrackerProd] D428201 workflow stages:', workflowStages);
      }
      
      return {
        ...job,
        parallel_stages: workflowStages
      };
    });
  }, [jobs, jobStageInstancesMap]);

  // Build map of jobs by stage (including parallel stages)
  const jobsByStage = useMemo(() => {
    const map = new Map<string, AccessibleJob[]>();
    
    enhancedJobs.forEach(job => {
      // If job has parallel stages computed, use them
      if (job.parallel_stages && job.parallel_stages.length > 0) {
        job.parallel_stages.forEach(parallelStage => {
          const stageJobs = map.get(parallelStage.stage_id) || [];
          stageJobs.push(job);
          map.set(parallelStage.stage_id, stageJobs);
        });
      } else {
        // Fallback: use current stage only
        if (job.current_stage_id) {
          const stageJobs = map.get(job.current_stage_id) || [];
          stageJobs.push(job);
          map.set(job.current_stage_id, stageJobs);
        }
      }
    });
    
    return map;
  }, [enhancedJobs]);

  // Filter jobs based on selected stage
  const filteredJobs = useMemo(() => {
    if (!selectedStageId) return enhancedJobs;
    return jobsByStage.get(selectedStageId) || [];
  }, [enhancedJobs, selectedStageId, jobsByStage]);
  // Enhanced sorting with batch processing awareness
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
    return enhancedJobs.filter(job => !job.category_id);
  }, [enhancedJobs]);

  // Build consolidated stages with accurate counts from current stages only
  const consolidatedStages = useMemo(() => {
    const stageCounts = new Map<string, { stage_id: string; stage_name: string; stage_color: string; job_count: number }>();
    
    // Use jobsByStage map to build accurate stage counts
    jobsByStage.forEach((stageJobs, stageId) => {
      if (stageJobs.length === 0) return;
      
      // Try to get stage info from parallel_stages first, then fallback to current stage
      let stageName = null;
      let stageColor = null;
      
      for (const job of stageJobs) {
        // Check parallel_stages first for matching stage
        if (job.parallel_stages && job.parallel_stages.length > 0) {
          const matchingParallelStage = job.parallel_stages.find(
            ps => ps.stage_id === stageId
          );
          if (matchingParallelStage) {
            stageName = matchingParallelStage.stage_name;
            stageColor = matchingParallelStage.stage_color;
            break;
          }
        }
        // Fallback: if this is the job's current stage
        if (job.current_stage_id === stageId && job.current_stage_name) {
          stageName = job.current_stage_name;
          stageColor = job.current_stage_color;
          break;
        }
      }
      
      if (stageName) {
        stageCounts.set(stageId, {
          stage_id: stageId,
          stage_name: stageName,
          stage_color: stageColor || '#6B7280',
          job_count: stageJobs.length
        });
      }
    });
    
    return Array.from(stageCounts.values()).sort((a, b) => 
      a.stage_name.localeCompare(b.stage_name)
    );
  }, [jobsByStage]);
  const handleSidebarStageSelect = (stageId: string | null) => {
    if (!stageId) {
      setSelectedStageId(null);
      setSelectedStageName(null);
      return;
    }
    const stage = (consolidatedStages as any[]).find((s: any) => s.stage_id === stageId);
    setSelectedStageId(stageId);
    setSelectedStageName(stage?.stage_name ?? null);
  };

  const handleJobClick = (job: AccessibleJob) => {
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
      } else if (action === 'qr-scan') {
        toast.info('QR scan action triggered');
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
    console.log("🔄 TrackerProduction refresh triggered");
    invalidateCache();
    await refreshJobs();
  };

  const handleModalRefresh = async () => {
    console.log("🔄 Modal refresh triggered - updating main view");
    await handleRefresh();
  };

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
      <div className="flex h-full">
        <div className="w-64 border-r bg-white overflow-y-auto">
          <DynamicProductionSidebar
            selectedStageId={selectedStageId ?? undefined}
            onStageSelect={handleSidebarStageSelect}
            consolidatedStages={consolidatedStages}
            activeJobs={jobs}
          />
        </div>

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
                  jobs={jobs}
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
                    <div className="flex gap-4 items-center text-xs font-bold px-2 py-1 border-b bg-gray-50">
                      <span className="w-8 text-center">Due</span>
                      <span className="flex-1">Job Name / Number</span>
                      <span className="w-32">Due Date</span>
                      <span className="w-40">Current Stage</span>
                      <span className="w-24">Progress</span>
                      <span className="w-24 text-right">Actions</span>
                    </div>
                    <ProductionJobsView
                      jobs={sortedJobs}
                      selectedStage={selectedStageName}
                      isLoading={isLoading}
                      onJobClick={handleJobClick}
                      onStageAction={handleStageAction}
                      disableSpecifications={!selectedStageId}
                    />
                  </TrackerErrorBoundary>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedJob && (
        <MasterOrderModal
          isOpen={true}
          onClose={handleCloseModal}
          job={selectedJob}
          onRefresh={handleModalRefresh}
        />
      )}

      {partAssignmentJob && (
        <JobPartAssignmentManager
          jobId={partAssignmentJob.id}
          jobTableName="production_jobs"
          open={true}
          onClose={() => setPartAssignmentJob(null)}
        />
      )}
    </>
  );
};

export default TrackerProduction;
