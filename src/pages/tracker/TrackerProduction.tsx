import React, { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
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
import { getJobWorkflowStages, shouldJobAppearInWorkflowStage } from "@/utils/productionWorkflowUtils";
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

  // Get real-time stage data
  const { jobStages, isLoading: stagesLoading } = useRealTimeJobStages(jobs);

  // Build per-job stage map for workflow computation
  const jobStagesMap = useMemo(() => {
    const map = new Map<string, any[]>();
    (jobStages ?? []).forEach((s: any) => {
      const arr = map.get(s.job_id) || [];
      arr.push(s);
      map.set(s.job_id, arr);
    });
    return map;
  }, [jobStages]);

  // Compute actionable workflow stages per job (parallel-aware)
  const actionableStagesByJob = useMemo(() => {
    const map = new Map<string, any[]>();
    (jobs ?? []).forEach((job: any) => {
      const stagesForJob = jobStagesMap.get(job.id) || [];
      try {
        const workflowStages = getJobWorkflowStages(stagesForJob, job.id);
        map.set(job.id, workflowStages);
      } catch (e) {
        console.warn('⚠️ Failed to compute workflow stages for job', job?.id, e);
        map.set(job.id, []);
      }
    });
    return map;
  }, [jobs, jobStagesMap]);
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [partAssignmentJob, setPartAssignmentJob] = useState<AccessibleJob | null>(null);
  const [lastUpdate] = useState<Date>(new Date());

  // Filter jobs by selected queue using actionable workflow stages
  const filteredJobs = useMemo(() => {
    if (!selectedStageId) return jobs;
    return jobs.filter((job: any) => {
      const workflowStages = actionableStagesByJob.get(job.id) || [];
      try {
        return shouldJobAppearInWorkflowStage(workflowStages as any[], selectedStageId);
      } catch {
        return false;
      }
    });
  }, [jobs, selectedStageId, actionableStagesByJob]);
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

  // Build consolidated queues from actionable workflow stages (with accurate counts)
  const consolidatedStages = useMemo(() => {
    const agg = new Map<string, { stage_id: string; stage_name: string; stage_color: string; job_count: number }>();
    actionableStagesByJob.forEach((workflowStages) => {
      (workflowStages as any[]).forEach((ws: any) => {
        const id: string =
          ws.stage_id ?? ws.production_stage_id ?? ws.unique_stage_key ?? ws.name ?? ws.stage_name;
        const name: string = ws.stage_name ?? ws.name ?? 'Unknown Stage';
        const color: string = ws.stage_color ?? '#6B7280';
        const existing = agg.get(id);
        if (existing) {
          existing.job_count += 1;
        } else {
          agg.set(id, { stage_id: id, stage_name: name, stage_color: color, job_count: 1 });
        }
      });
    });
    return Array.from(agg.values()).sort((a, b) => a.stage_name.localeCompare(b.stage_name));
  }, [actionableStagesByJob]);
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
