
import React, { useState, useMemo } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { OperatorHeader } from "./OperatorHeader";
import { QueueFilters } from "./QueueFilters";
import { JobGroupsDisplay } from "./JobGroupsDisplay";
import { DtpJobModal } from "./DtpJobModal";
import { JobListLoading, JobErrorState } from "../common/JobLoadingStates";
import { categorizeJobs, sortJobsByWONumber } from "@/utils/tracker/jobProcessing";
import { toast } from "sonner";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

export const UniversalFactoryFloor = () => {
  const { isDtpOperator, isOperator, isAdmin, isManager } = useUserRole();
  
  // Always request 'work' permission - operators should only see jobs they can work on
  const { jobs, isLoading, error, refreshJobs } = useAccessibleJobs({
    permissionType: 'work',
    statusFilter: null
  });
  
  const { startJob, completeJob } = useJobActions(refreshJobs);

  // Filter to workable jobs for operators (not admins/managers)
  const filteredJobs = useMemo(() => {
    console.log('🔍 Total jobs from DB:', jobs.length);
    
    // Admins and managers see all jobs
    if (isAdmin || isManager) {
      console.log('👑 Admin/Manager: showing all jobs');
      return jobs;
    }
    
    // Operators only see jobs they can work on
    if (isOperator || isDtpOperator) {
      const workableJobs = jobs.filter(job => job.user_can_work === true);
      console.log('👷 Operator: filtered to workable jobs:', workableJobs.length);
      return workableJobs;
    }
    
    return jobs;
  }, [jobs, isAdmin, isManager, isOperator, isDtpOperator]);

  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQueueFilters, setActiveQueueFilters] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try {
      return (localStorage.getItem('factory-floor-view-mode') as 'card' | 'list') || 'card';
    } catch {
      return 'card';
    }
  });

  const handleViewModeChange = (mode: 'card' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('factory-floor-view-mode', mode);
    } catch {
      // Ignore localStorage errors
    }
  };

  // Filtering and categorization using workable jobs only
  const { dtpJobs, proofJobs, hp12000Jobs, hp7900Jobs, hpT250Jobs, finishingJobs, otherJobs } = useMemo(() => {
    console.log('📊 Starting job categorization, filtered jobs:', filteredJobs.length);
    console.log('🔐 User permissions:', { isAdmin, isManager, isOperator, isDtpOperator });
    
    if (!filteredJobs || filteredJobs.length === 0) {
      console.log('❌ No jobs available for processing');
      return { 
        dtpJobs: [], 
        proofJobs: [], 
        hp12000Jobs: [], 
        hp7900Jobs: [], 
        hpT250Jobs: [], 
        finishingJobs: [], 
        otherJobs: [] 
      };
    }

    let filtered = filteredJobs;
    console.log('📋 Starting with filtered jobs:', filtered.length);

    // Apply simple search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job => 
        job.wo_no?.toLowerCase().includes(query) ||
        job.customer?.toLowerCase().includes(query) ||
        job.reference?.toLowerCase().includes(query) ||
        job.current_stage_name?.toLowerCase().includes(query) ||
        job.display_stage_name?.toLowerCase().includes(query)
      );
      console.log('🔍 After search filter:', filtered.length);
    }

    // Apply simple queue filters for printing jobs
    if (activeQueueFilters.length > 0) {
      console.log('🎯 Applying queue filters:', activeQueueFilters);
      filtered = filtered.filter(job => {
        const stageName = (job.current_stage_name || '').toLowerCase();
        const displayStageName = (job.display_stage_name || '').toLowerCase();
        const effectiveStageName = displayStageName || stageName;

        // Check if it's a printing job and matches filters
        const isPrintingJob = effectiveStageName.includes('print') ||
                             effectiveStageName.includes('hp') ||
                             effectiveStageName.includes('12000') ||
                             effectiveStageName.includes('7900') ||
                             effectiveStageName.includes('t250');

        if (isPrintingJob) {
          return activeQueueFilters.some(filter => {
            const filterLower = filter.toLowerCase();
            return effectiveStageName.includes(filterLower);
          });
        }

        // Non-printing jobs remain visible regardless of print queue filters
        return true;
      });
      console.log('🎯 After queue filter:', filtered.length);
    }

    // Categorize the filtered jobs
    const categories = categorizeJobs(filtered);
    
    const result = {
      dtpJobs: sortJobsByWONumber(categories.dtpJobs),
      proofJobs: sortJobsByWONumber(categories.proofJobs),
      hp12000Jobs: sortJobsByWONumber(categories.hp12000Jobs),
      hp7900Jobs: sortJobsByWONumber(categories.hp7900Jobs),
      hpT250Jobs: sortJobsByWONumber(categories.hpT250Jobs),
      finishingJobs: sortJobsByWONumber(categories.finishingJobs),
      otherJobs: sortJobsByWONumber(categories.otherJobs)
    };

    console.log('✅ Final categorization:', {
      dtp: result.dtpJobs.length,
      proof: result.proofJobs.length,
      hp12000: result.hp12000Jobs.length,
      hp7900: result.hp7900Jobs.length,
      hpT250: result.hpT250Jobs.length,
      finishing: result.finishingJobs.length,
      other: result.otherJobs.length,
      total: Object.values(result).reduce((acc, arr) => acc + arr.length, 0)
    });

    return result;
  }, [filteredJobs, searchQuery, activeQueueFilters, isAdmin, isManager, isOperator, isDtpOperator]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshJobs();
      toast.success("Jobs refreshed successfully");
    } catch (error) {
      console.error("❌ Refresh failed:", error);
      toast.error("Failed to refresh jobs");
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const handleJobClick = (job: AccessibleJob) => {
    setSelectedJob(job);
  };

  const handleCloseModal = () => {
    setSelectedJob(null);
  };

  // Show loading state
  if (isLoading) {
    return (
      <JobListLoading 
        message="Loading your work queue..."
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
        title="Factory Floor Error"
      />
    );
  }

  // Simple job groups configuration
  const jobGroups = [];
  
  if (isDtpOperator || dtpJobs.length > 0) {
    jobGroups.push({ title: "DTP Jobs", jobs: dtpJobs, color: "bg-blue-600" });
  }
  
  if (isDtpOperator || proofJobs.length > 0) {
    jobGroups.push({ title: "Proofing Jobs", jobs: proofJobs, color: "bg-purple-600" });
  }
  
  if (hp12000Jobs.length > 0) {
    jobGroups.push({ title: "HP 12000 Master Queue", jobs: hp12000Jobs, color: "bg-green-600" });
  }
  
  if (hp7900Jobs.length > 0) {
    jobGroups.push({ title: "HP 7900 Master Queue", jobs: hp7900Jobs, color: "bg-emerald-600" });
  }
  
  if (hpT250Jobs.length > 0) {
    jobGroups.push({ title: "HP T250 Master Queue", jobs: hpT250Jobs, color: "bg-teal-600" });
  }
  
  if (finishingJobs.length > 0) {
    jobGroups.push({ title: "Finishing Jobs", jobs: finishingJobs, color: "bg-orange-600" });
  }
  
  if (otherJobs.length > 0) {
    jobGroups.push({ title: "Other Jobs", jobs: otherJobs, color: "bg-gray-600" });
  }

  console.log('🎨 Rendering job groups:', {
    groups: jobGroups.map(g => ({ title: g.title, count: g.jobs.length }))
  });

  const totalJobs = dtpJobs.length + proofJobs.length + hp12000Jobs.length + hp7900Jobs.length + hpT250Jobs.length + finishingJobs.length + otherJobs.length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <OperatorHeader 
        title={isDtpOperator ? "DTP & Proofing Jobs" : "Factory Floor"}
      />

      {/* Controls */}
      <QueueFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onQueueFiltersChange={setActiveQueueFilters}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        showQueueControls={hp12000Jobs.length > 0 || hp7900Jobs.length > 0 || hpT250Jobs.length > 0}
        totalJobs={totalJobs}
        jobGroupsCount={jobGroups.length}
      />

      {/* Job Groups - Simplified Display */}
      <div className="flex-1 overflow-hidden">
        <JobGroupsDisplay
          jobGroups={jobGroups}
          viewMode={viewMode}
          searchQuery={searchQuery}
          onJobClick={handleJobClick}
          onStart={startJob}
          onComplete={completeJob}
        />
      </div>

      {/* Job Modal */}
      {selectedJob && (
        <DtpJobModal
          job={selectedJob}
          isOpen={true}
          onClose={handleCloseModal}
          onStart={startJob}
          onComplete={completeJob}
          onRefresh={refreshJobs}
        />
      )}
    </div>
  );
};
