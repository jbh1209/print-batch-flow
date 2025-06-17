import React, { useState, useMemo } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DtpJobModal } from "./DtpJobModal";
import { EnhancedOperatorJobCard } from "./EnhancedOperatorJobCard";
import { BulkJobOperations } from "@/components/tracker/common/BulkJobOperations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter,
  Users,
  CheckSquare,
  Square
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateFilterCounts } from "@/hooks/tracker/useAccessibleJobs/pureJobProcessor";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

type FilterType = 'all' | 'available' | 'my-active' | 'urgent';

export const EnhancedOperatorDashboard = () => {
  const { isDtpOperator } = useUserRole();
  const { jobs, isLoading, refreshJobs } = useAccessibleJobs();
  const { startJob, completeJob } = useJobActions(refreshJobs);
  
  const [selectedModal, setSelectedModal] = useState<AccessibleJob | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [showBulkOperations, setShowBulkOperations] = useState(false);

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
      case 'all':
      default:
        // No additional filtering
        break;
    }

    return filtered;
  }, [jobs, searchQuery, activeFilter]);

  const filterCounts = useMemo(() => {
    return calculateFilterCounts(jobs || []);
  }, [jobs]);

  const selectedJobObjects = useMemo(() => {
    return filteredJobs.filter(job => selectedJobs.includes(job.job_id));
  }, [filteredJobs, selectedJobs]);

  const handleJobSelection = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(filteredJobs.map(job => job.job_id));
    } else {
      setSelectedJobs([]);
    }
  };

  const handleClearSelection = () => {
    setSelectedJobs([]);
    setShowBulkOperations(false);
  };

  // Single job operation handlers
  const handleNotesUpdate = async (jobId: string, notes: string) => {
    console.log('Updating notes for job:', jobId, notes);
    // TODO: Implement notes update API call
  };

  const handleTimeUpdate = async (jobId: string, timeData: any) => {
    console.log('Updating time for job:', jobId, timeData);
    // TODO: Implement time tracking API call
  };

  const handleHoldJob = async (jobId: string, reason: string, notes?: string) => {
    console.log('Holding job:', jobId, reason, notes);
    // TODO: Implement job hold API call
    return true;
  };

  const handleReleaseJob = async (jobId: string, notes?: string) => {
    console.log('Releasing job:', jobId, notes);
    // TODO: Implement job release API call
    return true;
  };

  // Bulk operation handlers that handle arrays of job IDs
  const handleBulkStart = async (jobIds: string[]) => {
    console.log('Bulk starting jobs:', jobIds);
    try {
      for (const jobId of jobIds) {
        // For bulk start, we need to get the current stage ID for each job
        const job = jobs?.find(j => j.job_id === jobId);
        if (job && job.current_stage_id) {
          await startJob(jobId, job.current_stage_id);
        }
      }
      await refreshJobs();
      return true;
    } catch (error) {
      console.error('Failed to bulk start jobs:', error);
      return false;
    }
  };

  const handleBulkComplete = async (jobIds: string[]) => {
    console.log('Bulk completing jobs:', jobIds);
    try {
      for (const jobId of jobIds) {
        // For bulk complete, we need to get the current stage ID for each job
        const job = jobs?.find(j => j.job_id === jobId);
        if (job && job.current_stage_id) {
          await completeJob(jobId, job.current_stage_id);
        }
      }
      await refreshJobs();
      return true;
    } catch (error) {
      console.error('Failed to bulk complete jobs:', error);
      return false;
    }
  };

  const handleBulkHold = async (jobIds: string[], reason: string, notes?: string) => {
    console.log('Bulk holding jobs:', jobIds, reason, notes);
    try {
      for (const jobId of jobIds) {
        await handleHoldJob(jobId, reason, notes);
      }
      await refreshJobs();
      return true;
    } catch (error) {
      console.error('Failed to bulk hold jobs:', error);
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All Jobs', count: filterCounts.all },
    { key: 'available', label: 'Available', count: filterCounts.available },
    { key: 'my-active', label: 'My Active', count: filterCounts['my-active'] },
    { key: 'urgent', label: 'Urgent', count: filterCounts.urgent }
  ];

  return (
    <div className="p-2 sm:p-4 space-y-4 sm:space-y-6 h-full overflow-hidden">
      {/* Header with Search and Filters - Mobile Optimized */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search jobs by WO, customer, reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
            />
          </div>
          
          {selectedJobs.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowBulkOperations(!showBulkOperations)}
              className="flex items-center gap-2 h-12 sm:h-10 touch-manipulation"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Bulk Operations</span>
              <span className="sm:hidden">Actions</span>
              <Badge variant="secondary" className="ml-1">
                {selectedJobs.length}
              </Badge>
            </Button>
          )}
        </div>

        {/* Filter Tabs - Responsive */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible">
          {filters.map(filter => (
            <Button
              key={filter.key}
              variant={activeFilter === filter.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(filter.key)}
              className={cn(
                "flex-shrink-0 h-10 sm:h-8 px-3 sm:px-2 touch-manipulation",
                "flex items-center gap-2"
              )}
            >
              <span className="text-sm sm:text-xs">{filter.label}</span>
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-xs px-1.5 py-0",
                  activeFilter === filter.key ? "bg-white/20 text-white" : ""
                )}
              >
                {filter.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Bulk Selection Controls - Mobile Optimized */}
        {filteredJobs.length > 0 && (
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={
                  selectedJobs.length === filteredJobs.length && filteredJobs.length > 0
                }
                onCheckedChange={handleSelectAll}
                className="h-5 w-5 sm:h-4 sm:w-4 touch-manipulation"
              />
              <span className="text-sm font-medium">
                <span className="hidden sm:inline">Select All</span>
                <span className="sm:hidden">All</span>
                ({filteredJobs.length})
              </span>
            </div>
            
            {selectedJobs.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {selectedJobs.length} selected
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Bulk Operations Panel - Mobile Optimized */}
      {showBulkOperations && selectedJobObjects.length > 0 && (
        <div className="sm:block">
          <div className="hidden sm:block">
            <BulkJobOperations
              selectedJobs={selectedJobObjects}
              onBulkStart={handleBulkStart}
              onBulkComplete={handleBulkComplete}
              onBulkHold={handleBulkHold}
              onClearSelection={handleClearSelection}
            />
          </div>
          
          {/* Mobile bulk operations overlay */}
          <div className="sm:hidden fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
            <div className="w-full bg-white rounded-t-lg p-4 max-h-[80vh] overflow-y-auto">
              <BulkJobOperations
                selectedJobs={selectedJobObjects}
                onBulkStart={handleBulkStart}
                onBulkComplete={handleBulkComplete}
                onBulkHold={handleBulkHold}
                onClearSelection={handleClearSelection}
              />
              <button
                onClick={() => setShowBulkOperations(false)}
                className="w-full mt-4 p-3 bg-gray-100 rounded-lg text-center font-medium touch-manipulation"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jobs List - Mobile Optimized */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto space-y-2 sm:space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchQuery ? "No jobs match your search criteria." : "No jobs available."}
              </p>
            </div>
          ) : (
            filteredJobs.map(job => (
              <div key={job.job_id} className="relative">
                {/* Selection Checkbox - Touch Optimized */}
                <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10">
                  <Checkbox
                    checked={selectedJobs.includes(job.job_id)}
                    onCheckedChange={(checked) => 
                      handleJobSelection(job.job_id, checked as boolean)
                    }
                    className="h-5 w-5 sm:h-4 sm:w-4 bg-white border-2 touch-manipulation"
                  />
                </div>

                {/* Job Card - Touch Optimized */}
                <div 
                  className={cn(
                    "ml-10 sm:ml-8 cursor-pointer transition-all touch-manipulation",
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
