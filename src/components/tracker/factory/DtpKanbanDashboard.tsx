import React, { useState, useCallback, useMemo } from "react";
import { AlertTriangle, FileText, CheckCircle, RefreshCw, Package } from "lucide-react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { DtpKanbanColumnWithBoundary } from "./DtpKanbanColumnWithBoundary";
import { DtpJobModal } from "./DtpJobModal";
import { DtpDashboardHeader } from "./DtpDashboardHeader";
import { DtpDashboardStats } from "./DtpDashboardStats";
import { DtpDashboardFilters } from "./DtpDashboardFilters";
import { TrackerErrorBoundary } from "../error-boundaries/TrackerErrorBoundary";
import { GlobalBarcodeListener } from "./GlobalBarcodeListener";
import { ViewToggle } from "../common/ViewToggle";
import { JobListView } from "../common/JobListView";
import { categorizeJobs, sortJobsByWONumber } from "@/utils/tracker/jobProcessing";
import { calculateDashboardMetrics } from "@/hooks/tracker/useAccessibleJobs/dashboardUtils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { JobListLoading, JobErrorState } from "../common/JobLoadingStates";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

export const DtpKanbanDashboard = () => {
  const { isDtpOperator, accessibleStages } = useUserRole();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  
  const { 
    jobs, 
    isLoading, 
    error, 
    startJob, 
    completeJob, 
    refreshJobs,
    hasOptimisticUpdates,
    hasPendingUpdates
  } = useAccessibleJobs({
    permissionType: 'work'
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const dashboardMetrics = useMemo(() => {
    return calculateDashboardMetrics(jobs);
  }, [jobs]);

  const { dtpJobs, proofJobs, batchAllocationJobs } = useMemo(() => {
    if (!jobs || jobs.length === 0) {
      return { dtpJobs: [], proofJobs: [], batchAllocationJobs: [] };
    }

    try {
      let filtered = jobs;

      if (searchQuery) {
        filtered = filtered.filter(job => {
          const woMatch = job.wo_no?.toLowerCase().includes(searchQuery.toLowerCase());
          const customerMatch = job.customer && job.customer.toLowerCase().includes(searchQuery.toLowerCase());
          const referenceMatch = job.reference && job.reference.toLowerCase().includes(searchQuery.toLowerCase());
          
          return woMatch || customerMatch || referenceMatch;
        });
      }

      const categories = categorizeJobs(filtered);
      
      // Extract batch allocation jobs
      const batchJobs = filtered.filter(job => {
        const stageName = job.current_stage_name?.toLowerCase() || '';
        return stageName.includes('batch allocation') || stageName.includes('batch_allocation');
      });
      
      return {
        dtpJobs: sortJobsByWONumber(categories.dtpJobs),
        proofJobs: sortJobsByWONumber(categories.proofJobs),
        batchAllocationJobs: sortJobsByWONumber(batchJobs)
      };
    } catch (categorizationError) {
      console.error("❌ Error categorizing jobs:", categorizationError);
      toast.error("Error processing jobs data");
      return { dtpJobs: [], proofJobs: [], batchAllocationJobs: [] };
    }
  }, [jobs, searchQuery, dashboardMetrics]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshJobs();
      toast.success("Jobs refreshed successfully");
    } catch (error) {
      console.error("❌ Refresh failed:", error);
      toast.error("Failed to refresh jobs");
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  }, [refreshJobs]);

  const handleJobClick = useCallback((job: AccessibleJob) => {
    setSelectedJob(job);
    setShowJobModal(true);
    setScanCompleted(false); // Reset scan state for new job
  }, []);

  // Modal handlers for start/complete actions - now just open modal
  const openModalForStart = useCallback(async (jobId: string, _stageId: string) => {
    const jobToOpen = jobs.find(j => j.job_id === jobId);
    if (jobToOpen) {
      setSelectedJob(jobToOpen);
      setShowJobModal(true);
      setScanCompleted(false); // Reset scan state
    }
    return true;
  }, [jobs]);

  const openModalForComplete = useCallback(async (jobId: string, _stageId: string) => {
    const jobToOpen = jobs.find(j => j.job_id === jobId);
    if (jobToOpen) {
      setSelectedJob(jobToOpen);
      setShowJobModal(true);
      setScanCompleted(false); // Reset scan state
    }
    return true;
  }, [jobs]);

  const handleCloseModal = useCallback(() => {
    setShowJobModal(false);
    setSelectedJob(null);
    setScanCompleted(false); // Reset scan state
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('❌ Logout failed:', error);
      toast.error('Logout failed');
    }
  }, [signOut]);

  const handleNavigation = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Global barcode handler - strict D###### verification
  const handleBarcodeDetected = (barcodeData: string) => {
    if (!selectedJob) return;
    
    console.log('🔍 Barcode detected in DTP:', barcodeData, 'Expected:', selectedJob.wo_no);
    
    // Strict D###### token extraction and verification
    const tokenMatch = barcodeData.match(/D\d{6}/i);
    const scannedToken = tokenMatch ? tokenMatch[0].toUpperCase() : '';
    const expectedToken = selectedJob.wo_no?.toUpperCase() || '';
    
    if (scannedToken && scannedToken === expectedToken) {
      setScanCompleted(true);
      toast.success(`Work order ${scannedToken} verified - ready to proceed`);
    } else {
      toast.error(`Wrong barcode scanned. Expected: ${expectedToken}, Got: ${barcodeData}`);
    }
  };

  if (isLoading) {
    return (
      <JobListLoading 
        message="Loading DTP jobs..."
        showProgress={true}
      />
    );
  }

  if (error) {
    return (
      <JobErrorState
        error={error}
        onRetry={handleRefresh}
        onRefresh={refreshJobs}
        title="DTP Kanban Dashboard Error"
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Global Barcode Listener - Only active when modal is open */}
      {showJobModal && selectedJob && (
        <GlobalBarcodeListener onBarcodeDetected={handleBarcodeDetected} minLength={5} />
      )}
      
      <div className="flex-shrink-0 p-3 sm:p-4 space-y-3 sm:space-y-4 bg-white border-b">
        <TrackerErrorBoundary componentName="DTP Dashboard Filters">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <DtpDashboardFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefresh={handleRefresh}
              onScanSuccess={() => {}}
              refreshing={refreshing}
              dtpJobsCount={dtpJobs.length}
              proofJobsCount={proofJobs.length}
            />
            <div className="flex-shrink-0 w-full sm:w-auto">
              <ViewToggle 
                view={viewMode} 
                onViewChange={setViewMode}
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        </TrackerErrorBoundary>

        <TrackerErrorBoundary componentName="DTP Dashboard Stats">
          <DtpDashboardStats
            dtpJobs={dtpJobs}
            proofJobs={proofJobs}
            batchAllocationJobs={batchAllocationJobs}
            metrics={dashboardMetrics}
          />
        </TrackerErrorBoundary>

        {(hasOptimisticUpdates || hasPendingUpdates()) && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
            <span className="text-sm text-blue-700 truncate">
              {hasOptimisticUpdates ? 'Processing updates...' : 'Syncing changes...'}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden px-3 sm:px-4 pb-3 sm:pb-4">
        {viewMode === 'card' ? (
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 h-full overflow-hidden">
            <div className="flex-1 min-h-0">
              <DtpKanbanColumnWithBoundary
                title="DTP Jobs"
                jobs={dtpJobs}
                onStart={openModalForStart}
                onComplete={openModalForComplete}
                onJobClick={handleJobClick}
                colorClass="bg-blue-600"
                icon={<FileText className="h-4 w-4" />}
              />
            </div>
            
            <div className="flex-1 min-h-0">
              <DtpKanbanColumnWithBoundary
                title="Proofing Jobs"
                jobs={proofJobs}
                onStart={openModalForStart}
                onComplete={openModalForComplete}
                onJobClick={handleJobClick}
                colorClass="bg-purple-600"
                icon={<CheckCircle className="h-4 w-4" />}
              />
            </div>

            <div className="flex-1 min-h-0">
              <DtpKanbanColumnWithBoundary
                title="Batch Allocation"
                jobs={batchAllocationJobs}
                onStart={openModalForStart}
                onComplete={openModalForComplete}
                onJobClick={handleJobClick}
                colorClass="bg-orange-600"
                icon={<Package className="h-4 w-4" />}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 h-full overflow-hidden">
            <div className="flex flex-col space-y-2 min-h-0">
              <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-sm truncate">DTP Jobs ({dtpJobs.length})</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="pr-4">
                  <JobListView
                    jobs={dtpJobs}
                    onStart={openModalForStart}
                    onComplete={openModalForComplete}
                    onJobClick={handleJobClick}
                  />
                </div>
              </ScrollArea>
            </div>
            
            <div className="flex flex-col space-y-2 min-h-0">
              <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-sm truncate">Proofing Jobs ({proofJobs.length})</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="pr-4">
                  <JobListView
                    jobs={proofJobs}
                    onStart={openModalForStart}
                    onComplete={openModalForComplete}
                    onJobClick={handleJobClick}
                  />
                </div>
              </ScrollArea>
            </div>

            <div className="flex flex-col space-y-2 min-h-0">
              <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-md">
                <Package className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-sm truncate">Batch Allocation ({batchAllocationJobs.length})</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="pr-4">
                  <JobListView
                    jobs={batchAllocationJobs}
                    onStart={openModalForStart}
                    onComplete={openModalForComplete}
                    onJobClick={handleJobClick}
                  />
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {selectedJob && (
        <TrackerErrorBoundary componentName="DTP Job Modal">
          <DtpJobModal
            job={selectedJob}
            isOpen={showJobModal}
            onClose={handleCloseModal}
            onRefresh={handleRefresh}
            scanCompleted={scanCompleted}
            onStartJob={startJob}
            onCompleteJob={completeJob}
          />
        </TrackerErrorBoundary>
      )}
    </div>
  );
};