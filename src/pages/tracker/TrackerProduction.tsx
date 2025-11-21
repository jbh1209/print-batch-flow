import React, { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useActionableStages } from "@/hooks/tracker/useActionableStages";
import { useRealTimeJobStages } from "@/hooks/tracker/useRealTimeJobStages";
import { useIsMobile } from "@/hooks/use-mobile";
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

  // Get actionable stages map (prevents showing jobs in all future stages)
  const { data: actionableStagesMap, isLoading: stagesLoading } = useActionableStages(jobs);
  
  // Get full stage data for display purposes
  const { jobStages } = useRealTimeJobStages(jobs);
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [partAssignmentJob, setPartAssignmentJob] = useState<AccessibleJob | null>(null);
  const [lastUpdate] = useState<Date>(new Date());

  // Build map of jobs by ACTIONABLE stages only (not all future pending stages)
  const jobsByStage = useMemo(() => {
    const map = new Map<string, AccessibleJob[]>();
    
    if (!actionableStagesMap) return map;
    
    jobs.forEach(job => {
      const actionableStageIds = actionableStagesMap.get(job.id) || [];
      
      // Add job to each of its actionable stages
      actionableStageIds.forEach(stageId => {
        const stageJobs = map.get(stageId) || [];
        stageJobs.push(job);
        map.set(stageId, stageJobs);
      });
    });
    
    return map;
  }, [jobs, actionableStagesMap]);

  // Filter jobs based on selected stage
  const filteredJobs = useMemo(() => {
    if (!selectedStageId) return jobs;
    return jobsByStage.get(selectedStageId) || [];
  }, [jobs, selectedStageId, jobsByStage]);
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
    return jobs.filter(job => !job.category_id);
  }, [jobs]);

  // Build consolidated stages with accurate counts from jobsByStage map
  const consolidatedStages = useMemo(() => {
    const stageCounts = new Map<string, { stage_id: string; stage_name: string; stage_color: string; job_count: number }>();
    
    // Use jobsByStage map to build accurate stage counts
    jobsByStage.forEach((jobs, stageId) => {
      // Get stage details from first job's stage instance
      const firstJob = jobs[0];
      const stageInstance = jobStages.find(
        s => s.production_stage_id === stageId && s.job_id === firstJob.id
      );
      
      if (stageInstance) {
        stageCounts.set(stageId, {
          stage_id: stageId,
          stage_name: stageInstance.production_stage.name,
          stage_color: stageInstance.production_stage.color || '#6B7280',
          job_count: jobs.length
        });
      }
    });
    
    return Array.from(stageCounts.values()).sort((a, b) => 
      a.stage_name.localeCompare(b.stage_name)
    );
  }, [jobsByStage, jobStages]);
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
                  jobStages={jobStages}
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
