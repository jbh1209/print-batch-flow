
import React, { useState, useMemo } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { OperatorHeader } from "./OperatorHeader";
import { QueueToggleControls } from "./QueueToggleControls";
import { OperatorJobCard } from "./OperatorJobCard";
import { DtpJobModal } from "./DtpJobModal";
import { JobListLoading, JobErrorState } from "../common/JobLoadingStates";
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

  // Filter and categorize jobs
  const { dtpJobs, proofJobs, printingJobs, finishingJobs, otherJobs } = useMemo(() => {
    if (!jobs || jobs.length === 0) {
      return { dtpJobs: [], proofJobs: [], printingJobs: [], finishingJobs: [], otherJobs: [] };
    }

    let filtered = jobs;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job => 
        job.wo_no?.toLowerCase().includes(query) ||
        job.customer?.toLowerCase().includes(query) ||
        job.reference?.toLowerCase().includes(query) ||
        job.current_stage_name?.toLowerCase().includes(query)
      );
    }

    // Apply queue filters for printing jobs
    if (activeQueueFilters.length > 0) {
      filtered = filtered.filter(job => {
        const stageName = (job.current_stage_name || '').toLowerCase();
        const displayStageName = (job.display_stage_name || '').toLowerCase();
        const effectiveStageName = displayStageName || stageName;

        // If it's a printing job, check if it matches active queue filters
        const isPrintingJob = effectiveStageName.includes('print') ||
                             effectiveStageName.includes('hp') ||
                             effectiveStageName.includes('t250') ||
                             effectiveStageName.includes('12000') ||
                             effectiveStageName.includes('7900') ||
                             effectiveStageName.includes('press');

        if (isPrintingJob) {
          return activeQueueFilters.some(filter => 
            effectiveStageName.includes(filter.toLowerCase())
          );
        }

        // Non-printing jobs are always shown
        return true;
      });
    }

    const categories = categorizeJobs(filtered);
    
    return {
      dtpJobs: sortJobsByWONumber(categories.dtpJobs),
      proofJobs: sortJobsByWONumber(categories.proofJobs),
      printingJobs: sortJobsByWONumber(categories.printingJobs),
      finishingJobs: sortJobsByWONumber(categories.finishingJobs),
      otherJobs: sortJobsByWONumber(categories.otherJobs)
    };
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
  
  if (printingJobs.length > 0) {
    jobGroups.push({ title: "Printing Jobs", jobs: printingJobs, color: "bg-green-600" });
  }
  
  if (finishingJobs.length > 0) {
    jobGroups.push({ title: "Finishing Jobs", jobs: finishingJobs, color: "bg-orange-600" });
  }
  
  if (otherJobs.length > 0) {
    jobGroups.push({ title: "Other Jobs", jobs: otherJobs, color: "bg-gray-600" });
  }

  const totalJobs = dtpJobs.length + proofJobs.length + printingJobs.length + finishingJobs.length + otherJobs.length;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <OperatorHeader 
        title={isDtpOperator ? "DTP & Proofing Jobs" : "Factory Floor"}
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
            {/* Queue Toggle Controls - only show for print operators */}
            {printingJobs.length > 0 && (
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

        {/* Job Count */}
        <div className="text-sm text-gray-600">
          {totalJobs} job{totalJobs !== 1 ? 's' : ''} available
          {searchQuery && ` (filtered)`}
        </div>
      </div>

      {/* Job Groups */}
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
            {/* Single column for mobile, grid for desktop */}
            <div className="h-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4 overflow-hidden">
              {jobGroups.map(group => (
                <div key={group.title} className="flex flex-col min-h-0">
                  {/* Column Header */}
                  <div className={`${group.color} text-white px-4 py-3 rounded-t-lg flex-shrink-0`}>
                    <h2 className="font-semibold">
                      {group.title} ({group.jobs.length})
                    </h2>
                  </div>

                  {/* Job Cards */}
                  <div className="flex-1 border-l border-r border-b border-gray-200 rounded-b-lg overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="p-3 space-y-3">
                        {group.jobs.map(job => (
                          <OperatorJobCard
                            key={job.job_id}
                            job={job}
                            onStart={startJob}
                            onComplete={completeJob}
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
        />
      )}
    </div>
  );
};
