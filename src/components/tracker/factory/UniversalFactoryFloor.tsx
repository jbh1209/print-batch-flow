
import React, { useState, useMemo } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useSmartPermissionDetection } from "@/hooks/tracker/useSmartPermissionDetection";
import { usePrintingOperatorStages, useContextAwareStages } from "@/hooks/tracker/useContextAwareStages";
import { OperatorHeader } from "./OperatorHeader";
import { QueueFilters } from "./QueueFilters";
import { JobGroupsDisplay } from "./JobGroupsDisplay";
import { DtpJobModal } from "./DtpJobModal";
import { JobListLoading, JobErrorState } from "../common/JobLoadingStates";
import { categorizeJobs, sortJobsByWONumber } from "@/utils/tracker/jobProcessing";
import { applyContextJobFiltering } from "@/utils/tracker/contextJobFiltering";
import { toast } from "sonner";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

export const UniversalFactoryFloor = () => {
  const { isDtpOperator, isOperator } = useUserRole();
  const { highestPermission, isLoading: permissionLoading } = useSmartPermissionDetection();
  
  // Get context-aware stages to determine what the user should see
  const { contextStages, userContext, isAdmin } = useContextAwareStages();
  
  // Use smart permission detection for optimal job access
  const { jobs, isLoading, error, refreshJobs } = useAccessibleJobs({
    permissionType: highestPermission
  });
  
  const { startJob, completeJob } = useJobActions(refreshJobs);

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

  // Context-aware filtering and categorization based on user role
  const { dtpJobs, proofJobs, hp12000Jobs, hp7900Jobs, hpT250Jobs, finishingJobs, otherJobs } = useMemo(() => {
    console.log('🔄 Processing jobs with context-aware filtering:', {
      jobCount: jobs?.length || 0,
      userContext,
      stageCount: contextStages.length,
      permissionUsed: highestPermission,
      isAdmin
    });
    
    if (!jobs || jobs.length === 0) {
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

    let filtered = jobs;
    console.log('📋 Starting with jobs:', filtered.length, 'Context:', userContext, 'Stages:', contextStages.length);

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

        // Non-printing jobs are always shown
        return true;
      });
      console.log('🎯 After queue filter:', filtered.length);
    }

    // Apply context-aware job filtering based on user role - already filtered by database
    // Jobs coming from database are already permission-filtered
    console.log('✅ Jobs already filtered by database permissions:', filtered.length);
    
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

    console.log('✅ Context-aware job categorization complete:', {
      userContext,
      stagesAvailable: contextStages.length,
      permission: highestPermission,
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
  }, [jobs, searchQuery, activeQueueFilters, userContext, contextStages, highestPermission, isAdmin]);

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

  // Show loading state while detecting permissions
  if (permissionLoading || isLoading) {
    return (
      <JobListLoading 
        message="Loading your work queue with smart permissions..."
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

  // Context-aware job groups configuration based on filtered stages
  const jobGroups = [];
  
  // Only show job groups that match the user's context and have jobs
  if (userContext === 'dtp' || userContext === 'admin') {
    if (dtpJobs.length > 0) {
      jobGroups.push({ title: "DTP Jobs", jobs: dtpJobs, color: "bg-blue-600" });
    }
    if (proofJobs.length > 0) {
      jobGroups.push({ title: "Proofing Jobs", jobs: proofJobs, color: "bg-purple-600" });
    }
  }
  
  if (userContext === 'printing' || userContext === 'admin') {
    if (hp12000Jobs.length > 0) {
      jobGroups.push({ title: "HP 12000", jobs: hp12000Jobs, color: "bg-green-600" });
    }
    if (hp7900Jobs.length > 0) {
      jobGroups.push({ title: "HP 7900", jobs: hp7900Jobs, color: "bg-emerald-600" });
    }
    if (hpT250Jobs.length > 0) {
      jobGroups.push({ title: "HP T250", jobs: hpT250Jobs, color: "bg-teal-600" });
    }
  }
  
  if (userContext === 'finishing' || userContext === 'admin') {
    if (finishingJobs.length > 0) {
      jobGroups.push({ title: "Finishing Jobs", jobs: finishingJobs, color: "bg-orange-600" });
    }
  }
  
  // Other jobs shown only to admins or when context allows
  if (userContext === 'admin' && otherJobs.length > 0) {
    jobGroups.push({ title: "Other Jobs", jobs: otherJobs, color: "bg-gray-600" });
  }

  console.log('🎨 Rendering context-aware job groups:', {
    userContext,
    permission: highestPermission,
    groups: jobGroups.map(g => ({ title: g.title, count: g.jobs.length }))
  });

  const totalJobs = dtpJobs.length + proofJobs.length + hp12000Jobs.length + hp7900Jobs.length + hpT250Jobs.length + finishingJobs.length + otherJobs.length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <OperatorHeader 
        title={
          userContext === 'dtp' ? "DTP & Proofing Dashboard" :
          userContext === 'printing' ? "Printing Operations Dashboard" :
          userContext === 'batch_allocation' ? "Batch Allocation Dashboard" :
          userContext === 'finishing' ? "Finishing Operations Dashboard" :
          `Factory Floor - ${userContext} (${highestPermission})`
        }
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
