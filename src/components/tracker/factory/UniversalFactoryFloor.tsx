import React, { useState, useMemo } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { OperatorHeader } from "./OperatorHeader";
import { QueueToggleControls } from "./QueueToggleControls";
import { OperatorJobCard } from "./OperatorJobCard";
import { DtpJobModal } from "./DtpJobModal";
import { JobListLoading, JobErrorState } from "../common/JobLoadingStates";
import { JobListView } from "../common/JobListView";
import { ViewToggle } from "../common/ViewToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { categorizeJobs, sortJobsByWONumber } from "@/utils/tracker/jobProcessing";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

export const UniversalFactoryFloor = () => {
  const { isDtpOperator, isOperator } = useUserRole();
  const { jobs, isLoading, error, refreshJobs } = useAccessibleJobs({
    permissionType: 'work'
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

  // Filter and categorize jobs with enhanced master queue debugging
  const { dtpJobs, proofJobs, hp12000Jobs, hp7900Jobs, hpT250Jobs, finishingJobs, otherJobs } = useMemo(() => {
    console.log('🔄 Processing jobs in UniversalFactoryFloor with master queue logic:', jobs?.length || 0);
    
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
    console.log('📋 Starting with jobs:', filtered.length);

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job => 
        job.wo_no?.toLowerCase().includes(query) ||
        job.customer?.toLowerCase().includes(query) ||
        job.reference?.toLowerCase().includes(query) ||
        job.current_stage_name?.toLowerCase().includes(query)
      );
      console.log('🔍 After search filter:', filtered.length);
    }

    // Apply queue filters for printing jobs with master queue awareness
    if (activeQueueFilters.length > 0) {
      console.log('🎯 Applying master queue filters:', activeQueueFilters);
      filtered = filtered.filter(job => {
        const stageName = (job.current_stage_name || '').toLowerCase();
        const displayStageName = (job.display_stage_name || '').toLowerCase();
        const effectiveStageName = displayStageName || stageName;

        // Check if it's a printing job and matches master queue filters
        const isPrintingJob = effectiveStageName.includes('print') ||
                             effectiveStageName.includes('hp') ||
                             effectiveStageName.includes('12000') ||
                             effectiveStageName.includes('7900') ||
                             effectiveStageName.includes('t250');

        if (isPrintingJob) {
          return activeQueueFilters.some(filter => {
            const filterLower = filter.toLowerCase();
            // Match against master queue names
            if (filterLower.includes('12000') && (effectiveStageName.includes('12000'))) return true;
            if (filterLower.includes('7900') && (effectiveStageName.includes('7900'))) return true;
            if (filterLower.includes('t250') && (effectiveStageName.includes('t250') || effectiveStageName.includes('t 250'))) return true;
            return effectiveStageName.includes(filterLower);
          });
        }

        // Non-printing jobs are always shown
        return true;
      });
      console.log('🎯 After master queue filter:', filtered.length);
    }

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

    console.log('✅ Final master queue groups:', {
      dtp: result.dtpJobs.length,
      proof: result.proofJobs.length,
      hp12000: result.hp12000Jobs.length,
      hp7900: result.hp7900Jobs.length,
      hpT250: result.hpT250Jobs.length,
      finishing: result.finishingJobs.length,
      other: result.otherJobs.length
    });

    return result;
  }, [jobs, searchQuery, activeQueueFilters]);

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

  // Determine which job groups to show based on user role and available jobs
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

  console.log('🎨 Rendering master queue job groups:', jobGroups.map(g => ({ title: g.title, count: g.jobs.length })));

  const totalJobs = dtpJobs.length + proofJobs.length + hp12000Jobs.length + hp7900Jobs.length + hpT250Jobs.length + finishingJobs.length + otherJobs.length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <OperatorHeader 
        title={isDtpOperator ? "DTP & Proofing Jobs" : "Factory Floor - Master Queues"}
      />

      {/* Controls */}
      <div className="flex-shrink-0 p-4 bg-white border-b space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search jobs by WO, customer, reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <ViewToggle view={viewMode} onViewChange={handleViewModeChange} />

            {/* Queue Toggle Controls - only show for print operators */}
            {(hp12000Jobs.length > 0 || hp7900Jobs.length > 0 || hpT250Jobs.length > 0) && (
              <div className="relative">
                <QueueToggleControls 
                  onQueueFiltersChange={setActiveQueueFilters}
                />
              </div>
            )}

            {/* Refresh Button */}
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Job Count with Master Queue Info */}
        <div className="text-sm text-gray-600">
          {totalJobs} job{totalJobs !== 1 ? 's' : ''} available across {jobGroups.length} queue{jobGroups.length !== 1 ? 's' : ''}
          {searchQuery && ` (filtered)`}
        </div>
      </div>

      {/* Job Groups - Master Queue Display */}
      <div className="flex-1 overflow-hidden">
        {jobGroups.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 text-lg mb-2">No jobs available</p>
              <p className="text-gray-400 text-sm">
                {searchQuery ? "Try adjusting your search or filters" : "Check back later for new jobs"}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full">
            {viewMode === 'card' ? (
              /* Card View - Responsive Grid */
              <div className="h-full overflow-x-auto">
                <div className="flex gap-4 p-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {jobGroups.map(group => (
                    <div key={group.title} className="flex flex-col min-h-0 w-80 lg:w-auto">
                      {/* Column Header */}
                      <div className={`${group.color} text-white px-4 py-3 rounded-t-lg flex-shrink-0`}>
                        <h2 className="font-semibold">
                          {group.title} ({group.jobs.length})
                        </h2>
                      </div>

                      {/* Job Cards */}
                      <div className="flex-1 border-l border-r border-b border-gray-200 rounded-b-lg overflow-hidden bg-white">
                        <ScrollArea className="h-full max-h-96 lg:max-h-none">
                          <div className="p-3 space-y-3">
                            {group.jobs.map(job => (
                              <OperatorJobCard
                                key={job.job_id}
                                job={job}
                                onClick={() => handleJobClick(job)}
                              />
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* List View - Single Column with ALL Master Queue Groups */
              <ScrollArea className="h-full">
                <div className="p-4 space-y-6">
                  {jobGroups.map(group => {
                    console.log('🎨 Rendering list group:', group.title, 'Jobs:', group.jobs.length);
                    return (
                      <div key={group.title}>
                        {/* Section Header */}
                        <div className={`${group.color} text-white px-4 py-3 rounded-t-lg`}>
                          <h2 className="font-semibold">
                            {group.title} ({group.jobs.length})
                          </h2>
                        </div>
                        
                        {/* Job List */}
                        <JobListView
                          jobs={group.jobs}
                          onStart={startJob}
                          onComplete={completeJob}
                          onJobClick={handleJobClick}
                          className="rounded-t-none border-t-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
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
