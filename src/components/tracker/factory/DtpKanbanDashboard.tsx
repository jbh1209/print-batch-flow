
import React, { useState, useCallback, useMemo } from "react";
import { AlertTriangle, FileText, CheckCircle } from "lucide-react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { DtpKanbanColumn } from "./DtpKanbanColumn";
import { DtpJobModal } from "./DtpJobModal";
import { DtpDashboardHeader } from "./DtpDashboardHeader";
import { DtpDashboardStats } from "./DtpDashboardStats";
import { DtpDashboardFilters } from "./DtpDashboardFilters";
import { categorizeJobs, sortJobsByPriority } from "@/utils/tracker/jobProcessing";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const DtpKanbanDashboard = () => {
  const { isDtpOperator, accessibleStages } = useUserRole();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs({
    permissionType: 'work'
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);

  console.log("🎯 DTP Kanban Dashboard - Raw Jobs:", {
    totalJobs: jobs.length,
    jobsSample: jobs.slice(0, 3).map(j => ({
      wo_no: j.wo_no,
      current_stage_name: j.current_stage_name,
      current_stage_status: j.current_stage_status,
      user_can_work: j.user_can_work
    }))
  });

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
        proofCount: categories.proofJobs.length
      });

      return {
        dtpJobs: sortJobsByPriority(categories.dtpJobs),
        proofJobs: sortJobsByPriority(categories.proofJobs)
      };
    } catch (categorizationError) {
      console.error("Error categorizing jobs:", categorizationError);
      return { dtpJobs: [], proofJobs: [] };
    }
  }, [jobs, searchQuery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshJobs();
    } catch (error) {
      console.error("Refresh failed:", error);
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
      console.error('Logout failed:', error);
      toast.error('Logout failed');
    }
  }, [signOut]);

  const handleNavigation = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <AlertTriangle className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading DTP jobs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center p-8 border border-red-200 bg-red-50 rounded-lg">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-red-700">Error Loading Jobs</h2>
          <p className="text-red-600 text-center mb-4">{error}</p>
          <button 
            onClick={handleRefresh} 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            disabled={refreshing}
          >
            {refreshing ? "Retrying..." : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-hidden bg-gray-50">
      <DtpDashboardHeader 
        onNavigation={handleNavigation}
        onLogout={handleLogout}
      />

      <div className="flex flex-col gap-4">
        <DtpDashboardFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          onScanSuccess={handleScanSuccess}
          refreshing={refreshing}
          dtpJobsCount={dtpJobs.length}
          proofJobsCount={proofJobs.length}
        />

        <DtpDashboardStats
          dtpJobs={dtpJobs}
          proofJobs={proofJobs}
        />
      </div>

      <div className="flex gap-4 h-full overflow-hidden">
        <DtpKanbanColumn
          title="DTP Jobs"
          jobs={dtpJobs}
          onStart={startJob}
          onComplete={completeJob}
          onJobClick={handleJobClick}
          colorClass="bg-blue-600"
          icon={<FileText className="h-4 w-4" />}
        />
        
        <DtpKanbanColumn
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
        <DtpJobModal
          job={selectedJob}
          isOpen={showJobModal}
          onClose={handleCloseModal}
          onStart={startJob}
          onComplete={completeJob}
        />
      )}
    </div>
  );
};
