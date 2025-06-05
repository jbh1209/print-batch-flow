
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
import { categorizeJobs, sortJobsByPriority } from "@/utils/tracker/jobProcessing";
import { calculateDashboardMetrics } from "@/hooks/tracker/useAccessibleJobs/dashboardUtils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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

  console.log("🎯 DTP Kanban Dashboard - Raw Jobs:", {
    totalJobs: jobs.length,
    hasOptimistic: hasOptimisticUpdates,
    hasPending: hasPendingUpdates(),
    jobsSample: jobs.slice(0, 3).map(j => ({
      wo_no: j.wo_no,
      current_stage_name: j.current_stage_name,
      current_stage_status: j.current_stage_status,
      user_can_work: j.user_can_work
    }))
  });

  // Calculate dashboard metrics for better insights
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
      
      console.log("📊 Job categorization:", {
        totalFiltered: filtered.length,
        dtpCount: categories.dtpJobs.length,
        proofCount: categories.proofJobs.length,
        dashboardMetrics
      });

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

  // Enhanced loading state with progress indication
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <div className="text-center">
          <span className="text-lg font-medium">Loading DTP jobs...</span>
          <p className="text-sm text-gray-600 mt-2">
            Fetching your accessible jobs and real-time updates
          </p>
        </div>
      </div>
    );
  }

  // Enhanced error handling with recovery options
  if (error) {
    return (
      <DataLoadingFallback
        error={error}
        componentName="DTP Kanban Dashboard"
        onRetry={handleRefresh}
        onRefresh={refreshJobs}
        showDetails={true}
        additionalActions={
          <button
            onClick={() => navigate('/tracker')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Go to Main Dashboard
          </button>
        }
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
          <DtpDashboardFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={handleRefresh}
            onScanSuccess={handleScanSuccess}
            refreshing={refreshing}
            dtpJobsCount={dtpJobs.length}
            proofJobsCount={proofJobs.length}
          />
        </TrackerErrorBoundary>

        <TrackerErrorBoundary componentName="DTP Dashboard Stats">
          <DtpDashboardStats
            dtpJobs={dtpJobs}
            proofJobs={proofJobs}
            metrics={dashboardMetrics}
          />
        </TrackerErrorBoundary>

        {/* Real-time status indicators */}
        {(hasOptimisticUpdates || hasPendingUpdates()) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-blue-700">
              {hasOptimisticUpdates ? 'Processing updates...' : 'Syncing changes...'}
            </span>
          </div>
        )}
      </div>

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
