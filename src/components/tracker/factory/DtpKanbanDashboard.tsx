
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

  console.log("🎯 DTP Dashboard - Raw Jobs:", {
    totalJobs: jobs.length,
    jobsSample: jobs.slice(0, 3).map(j => ({
      wo_no: j.wo_no,
      current_stage_name: j.current_stage_name,
      current_stage_status: j.current_stage_status,
      user_can_work: j.user_can_work
    }))
  });

  // Simplified job categorization based on stage names
  const { dtpJobs, proofJobs } = useMemo(() => {
    let filtered = jobs;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(job =>
        job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.customer && job.customer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (job.reference && job.reference.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Categorize jobs based on current stage name
    const dtpJobs = filtered.filter(job => {
      if (!job.current_stage_name) return false;
      return job.current_stage_name.toLowerCase().includes('dtp');
    });

    const proofJobs = filtered.filter(job => {
      if (!job.current_stage_name) return false;
      return job.current_stage_name.toLowerCase().includes('proof');
    });

    // Sort jobs: pending first, then active
    const sortJobs = (jobsList: typeof filtered) => {
      return jobsList.sort((a, b) => {
        // Pending jobs first
        if (a.current_stage_status === 'pending' && b.current_stage_status !== 'pending') return -1;
        if (b.current_stage_status === 'pending' && a.current_stage_status !== 'pending') return 1;
        
        // Active jobs second
        if (a.current_stage_status === 'active' && b.current_stage_status !== 'active') return -1;
        if (b.current_stage_status === 'active' && a.current_stage_status !== 'active') return 1;
        
        // Then by due date
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        
        return 0;
      });
    };

    console.log("📊 Job categorization:", {
      totalFiltered: filtered.length,
      dtpCount: dtpJobs.length,
      proofCount: proofJobs.length,
      dtpJobNumbers: dtpJobs.map(j => j.wo_no),
      proofJobNumbers: proofJobs.map(j => j.wo_no)
    });

    return {
      dtpJobs: sortJobs(dtpJobs),
      proofJobs: sortJobs(proofJobs)
    };
  }, [jobs, searchQuery]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleScanSuccess = useCallback((data: string) => {
    const allJobs = [...dtpJobs, ...proofJobs];
    const job = allJobs.find(j => 
      j.wo_no.toLowerCase().includes(data.toLowerCase()) ||
      (j.reference && j.reference.toLowerCase().includes(data.toLowerCase()))
    );
    
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
          <button onClick={handleRefresh} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <DtpDashboardHeader 
        onNavigation={handleNavigation}
        onLogout={handleLogout}
      />

      {/* Content */}
      <div className="flex flex-col gap-4">
        {/* Filters */}
        <DtpDashboardFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          onScanSuccess={handleScanSuccess}
          refreshing={refreshing}
          dtpJobsCount={dtpJobs.length}
          proofJobsCount={proofJobs.length}
        />

        {/* Stats */}
        <DtpDashboardStats
          dtpJobs={dtpJobs}
          proofJobs={proofJobs}
        />
      </div>

      {/* Kanban Columns */}
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

      {/* Job Detail Modal */}
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
