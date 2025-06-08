import React, { useState, useCallback, useMemo } from "react";
import { AlertTriangle, FileText, CheckCircle, RefreshCw } from "lucide-react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { DtpKanbanColumnWithBoundary } from "./DtpKanbanColumnWithBoundary";
import { DtpJobModal } from "./DtpJobModal";
import { DtpDashboardHeader } from "./DtpDashboardHeader";
import { DtpDashboardStats } from "./DtpDashboardStats";
import { DtpDashboardFilters } from "./DtpDashboardFilters";
import { TrackerErrorBoundary } from "../error-boundaries/TrackerErrorBoundary";
import { DataLoadingFallback } from "../error-boundaries/DataLoadingFallback";
import { ViewToggle } from "../common/ViewToggle";
import { JobListView } from "../common/JobListView";
import { categorizeJobs, sortJobsByPriority } from "@/utils/tracker/jobProcessing";
import { calculateDashboardMetrics } from "@/hooks/tracker/useAccessibleJobs/dashboardUtils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { JobListLoading, JobErrorState } from "../common/JobLoadingStates";

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
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const dashboardMetrics = useMemo(() => {
    return calculateDashboardMetrics(jobs);
  }, [jobs]);

  const { dtpJobs, proofJobs } = useMemo(() => {
    if (!jobs || jobs.length === 0) {
      return { dtpJobs: [], proofJobs: [] };
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
      
      return {
        dtpJobs: sortJobsByPriority(categories.dtpJobs),
        proofJobs: sortJobsByPriority(categories.proofJobs)
      };
    } catch (categorizationError) {
      console.error("❌ Error categorizing jobs:", categorizationError);
      toast.error("Error processing jobs data");
      return { dtpJobs: [], proofJobs: [] };
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

  const handleScanSuccess = useCallback((data: string) => {
    const allJobs = [...dtpJobs, ...proofJobs];
    const job = allJobs.find(j => {
      const woMatch = j.wo_no?.toLowerCase().includes(data.toLowerCase());
      const referenceMatch = j.reference && j.reference.toLowerCase().includes(data.toLowerCase());
      return woMatch || referenceMatch;
    });
    
    if (job) {
      setSearchQuery(data);
      toast.success(`Found job: ${job.wo_no}`);
    } else {
      toast.warning(`No job found for: ${data}`);
    }
  }, [dtpJobs, proofJobs]);

  const handleJobClick = useCallback((job) => {
    setSelectedJob(job);
    setShowJobModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowJobModal(false);
    setSelectedJob(null);
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
    <div className="p-4 space-y-4 h-full overflow-hidden bg-gray-50">
      <TrackerErrorBoundary componentName="DTP Dashboard Header">
        <DtpDashboardHeader 
          onNavigation={handleNavigation}
          onLogout={handleLogout}
        />
      </TrackerErrorBoundary>

      <div className="flex flex-col gap-4">
        <TrackerErrorBoundary componentName="DTP Dashboard Filters">
          <div className="flex items-center justify-between">
            <DtpDashboardFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefresh={handleRefresh}
              onScanSuccess={handleScanSuccess}
              refreshing={refreshing}
              dtpJobsCount={dtpJobs.length}
              proofJobsCount={proofJobs.length}
            />
            <ViewToggle 
              view={viewMode} 
              onViewChange={setViewMode}
            />
          </div>
        </TrackerErrorBoundary>

        <TrackerErrorBoundary componentName="DTP Dashboard Stats">
          <DtpDashboardStats
            dtpJobs={dtpJobs}
            proofJobs={proofJobs}
            metrics={dashboardMetrics}
          />
        </TrackerErrorBoundary>

        {(hasOptimisticUpdates || hasPendingUpdates()) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-blue-700">
              {hasOptimisticUpdates ? 'Processing updates...' : 'Syncing changes...'}
            </span>
          </div>
        )}
      </div>

      {viewMode === 'card' ? (
        <div className="flex gap-4 h-full overflow-hidden">
          <DtpKanbanColumnWithBoundary
            title="DTP Jobs"
            jobs={dtpJobs}
            onStart={startJob}
            onComplete={completeJob}
            onJobClick={handleJobClick}
            colorClass="bg-blue-600"
            icon={<FileText className="h-4 w-4" />}
          />
          
          <DtpKanbanColumnWithBoundary
            title="Proofing Jobs"
            jobs={proofJobs}
            onStart={startJob}
            onComplete={completeJob}
            onJobClick={handleJobClick}
            colorClass="bg-purple-600"
            icon={<CheckCircle className="h-4 w-4" />}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md">
              <FileText className="h-4 w-4" />
              <span className="font-medium text-sm">DTP Jobs ({dtpJobs.length})</span>
            </div>
            <div className="h-full overflow-y-auto">
              <JobListView
                jobs={dtpJobs}
                onStart={startJob}
                onComplete={completeJob}
                onJobClick={handleJobClick}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium text-sm">Proofing Jobs ({proofJobs.length})</span>
            </div>
            <div className="h-full overflow-y-auto">
              <JobListView
                jobs={proofJobs}
                onStart={startJob}
                onComplete={completeJob}
                onJobClick={handleJobClick}
              />
            </div>
          </div>
        </div>
      )}

      {selectedJob && (
        <TrackerErrorBoundary componentName="DTP Job Modal">
          <DtpJobModal
            job={selectedJob}
            isOpen={showJobModal}
            onClose={handleCloseModal}
            onStart={startJob}
            onComplete={completeJob}
          />
        </TrackerErrorBoundary>
      )}
    </div>
  );
};
