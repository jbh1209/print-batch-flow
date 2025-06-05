import React, { useState, useMemo } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DtpJobModal } from "./DtpJobModal";
import { EnhancedOperatorJobCard } from "./EnhancedOperatorJobCard";
import { BulkJobOperations } from "@/components/tracker/common/BulkJobOperations";
import { MobileJobCard } from "./mobile/MobileJobCard";
import { MobileFilterTabs } from "./mobile/MobileFilterTabs";
import { MobileHeader } from "./mobile/MobileHeader";
import { SwipeableJobCard } from "./mobile/SwipeableJobCard";
import { calculateFilterCounts } from "@/hooks/tracker/useAccessibleJobs/pureJobProcessor";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

type FilterType = 'all' | 'available' | 'my-active' | 'urgent';

export const ResponsiveOperatorDashboard = () => {
  const { isDtpOperator } = useUserRole();
  const { jobs, isLoading, refreshJobs } = useAccessibleJobs();
  const { startJob, completeJob } = useJobActions(refreshJobs);
  const isMobile = useIsMobile();
  
  const [selectedModal, setSelectedModal] = useState<AccessibleJob | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('available');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter and search jobs
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];

    let filtered = [...jobs];

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

    // Apply status filter
    switch (activeFilter) {
      case 'available':
        filtered = filtered.filter(job => 
          job.current_stage_status === 'pending' && job.user_can_work
        );
        break;
      case 'my-active':
        filtered = filtered.filter(job => 
          job.current_stage_status === 'active' && job.user_can_work
        );
        break;
      case 'urgent':
        const now = new Date();
        const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(job => {
          if (!job.due_date) return false;
          const dueDate = new Date(job.due_date);
          return dueDate < now || (dueDate <= threeDaysFromNow && dueDate >= now);
        });
        break;
    }

    return filtered;
  }, [jobs, searchQuery, activeFilter]);

  const filterCounts = useMemo(() => {
    return calculateFilterCounts(jobs || []);
  }, [jobs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshJobs();
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const handleJobSelection = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleClearSelection = () => {
    setSelectedJobs([]);
    setShowBulkOperations(false);
  };

  const handleHoldJob = async (jobId: string, reason: string) => {
    console.log('Holding job:', jobId, reason);
    // TODO: Implement job hold API call
    return true;
  };

  const handleSwipeActions = (job: AccessibleJob) => ({
    onSwipeLeft: async () => {
      if (job.current_stage_status === 'active' && job.current_stage_id) {
        await completeJob(job.job_id, job.current_stage_id);
      }
    },
    onSwipeRight: async () => {
      if (job.current_stage_status === 'pending' && job.current_stage_id) {
        await startJob(job.job_id, job.current_stage_id);
      }
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader
          title="Factory Floor"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          onQRScan={() => console.log('QR Scan')}
          onBulkActions={() => setShowBulkOperations(true)}
          selectedCount={selectedJobs.length}
          isRefreshing={isRefreshing}
        />

        <div className="p-4 space-y-4">
          <MobileFilterTabs
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={filterCounts}
          />

          <div className="space-y-0">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {searchQuery ? "No jobs match your search." : "No jobs available."}
                </p>
              </div>
            ) : (
              filteredJobs.map(job => (
                <SwipeableJobCard
                  key={job.job_id}
                  job={job}
                  onStart={startJob}
                  onComplete={completeJob}
                  onHold={handleHoldJob}
                  onSelect={handleJobSelection}
                  isSelected={selectedJobs.includes(job.job_id)}
                  onClick={() => setSelectedModal(job)}
                  {...handleSwipeActions(job)}
                />
              ))
            )}
          </div>
        </div>

        {showBulkOperations && selectedJobs.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
            <div className="w-full bg-white rounded-t-lg p-4 max-h-[80vh] overflow-y-auto">
              <BulkJobOperations
                selectedJobs={filteredJobs.filter(job => selectedJobs.includes(job.job_id))}
                onBulkStart={async (jobIds) => {
                  for (const jobId of jobIds) {
                    const job = jobs?.find(j => j.job_id === jobId);
                    if (job && job.current_stage_id) {
                      await startJob(jobId, job.current_stage_id);
                    }
                  }
                  return true;
                }}
                onBulkComplete={async (jobIds) => {
                  for (const jobId of jobIds) {
                    const job = jobs?.find(j => j.job_id === jobId);
                    if (job && job.current_stage_id) {
                      await completeJob(jobId, job.current_stage_id);
                    }
                  }
                  return true;
                }}
                onBulkHold={async (jobIds, reason) => {
                  for (const jobId of jobIds) {
                    await handleHoldJob(jobId, reason);
                  }
                  return true;
                }}
                onClearSelection={handleClearSelection}
              />
              <button
                onClick={() => setShowBulkOperations(false)}
                className="w-full mt-4 p-3 bg-gray-100 rounded-lg text-center font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {selectedModal && (
          <DtpJobModal
            job={selectedModal}
            isOpen={true}
            onClose={() => setSelectedModal(null)}
            onStart={startJob}
            onComplete={completeJob}
          />
        )}
      </div>
    );
  }

  // Desktop view - use existing EnhancedOperatorDashboard layout
  return (
    <div className="p-4 space-y-6">
      {/* Header with Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search jobs by WO, customer, reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {selectedJobs.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowBulkOperations(!showBulkOperations)}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Bulk Operations ({selectedJobs.length})
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All Jobs', count: filterCounts.all },
    { key: 'available', label: 'Available', count: filterCounts.available },
    { key: 'my-active', label: 'My Active', count: filterCounts['my-active'] },
    { key: 'urgent', label: 'Urgent', count: filterCounts.urgent }
  ];
          {filters.map(filter => (
            <Button
              key={filter.key}
              variant={activeFilter === filter.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(filter.key)}
              className="flex items-center gap-2"
            >
              {filter.label}
              <Badge 
                variant="secondary" 
                className={cn(
                  "ml-1",
                  activeFilter === filter.key ? "bg-white/20" : ""
                )}
              >
                {filter.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Bulk Selection Controls */}
        {filteredJobs.length > 0 && (
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={
                  selectedJobs.length === filteredJobs.length && filteredJobs.length > 0
                }
                onCheckedChange={handleSelectAll}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">
                Select All ({filteredJobs.length} jobs)
              </span>
            </div>
            
            {selectedJobs.length > 0 && (
              <Badge variant="secondary">
                {selectedJobs.length} selected
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Bulk Operations Panel */}
      {showBulkOperations && selectedJobObjects.length > 0 && (
        <BulkJobOperations
          selectedJobs={selectedJobObjects}
          onBulkStart={handleBulkStart}
          onBulkComplete={handleBulkComplete}
          onBulkHold={handleBulkHold}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Jobs List */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {searchQuery ? "No jobs match your search criteria." : "No jobs available."}
            </p>
          </div>
        ) : (
          filteredJobs.map(job => (
            <div key={job.job_id} className="relative">
              {/* Selection Checkbox */}
              <div className="absolute top-4 left-4 z-10">
                <Checkbox
                  checked={selectedJobs.includes(job.job_id)}
                  onCheckedChange={(checked) => 
                    handleJobSelection(job.job_id, checked as boolean)
                  }
                  className="h-4 w-4 bg-white border-2"
                />
              </div>

              {/* Job Card */}
              <div 
                className={cn(
                  "ml-8 cursor-pointer transition-all",
                  selectedJobs.includes(job.job_id) && "ring-2 ring-blue-500"
                )}
                onClick={() => setSelectedModal(job)}
              >
                <EnhancedOperatorJobCard
                  job={job}
                  onStart={startJob}
                  onComplete={completeJob}
                  onHold={handleHoldJob}
                  onRelease={handleReleaseJob}
                  onNotesUpdate={handleNotesUpdate}
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* DTP Job Modal */}
      {selectedModal && (
        <DtpJobModal
          job={selectedModal}
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          onStart={startJob}
          onComplete={completeJob}
        />
      )}
    </div>
  );
};
