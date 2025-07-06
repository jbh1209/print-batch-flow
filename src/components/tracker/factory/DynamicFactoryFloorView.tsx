import React, { useState, useMemo } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useSmartPermissionDetection } from "@/hooks/tracker/useSmartPermissionDetection";
import { useAuth } from "@/hooks/useAuth";
import { OperatorHeader } from "./OperatorHeader";
import { QueueFilters } from "./QueueFilters";
import { JobGroupsDisplay } from "./JobGroupsDisplay";
import { DtpJobModal } from "./DtpJobModal";
import { JobListLoading, JobErrorState } from "../common/JobLoadingStates";
import { categorizeJobs, sortJobsByWONumber } from "@/utils/tracker/jobProcessing";
import { toast } from "sonner";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";

export const DynamicFactoryFloorView = () => {
  const { user } = useAuth();
  const { highestPermission, isLoading: permissionLoading } = useSmartPermissionDetection();
  
  // Use smart permission detection for optimal job access
  const { jobs, isLoading, error, refreshJobs } = useAccessibleJobs({
    permissionType: highestPermission // Let the database function handle all the filtering
  });
  
  const { startJob, completeJob } = useJobActions(refreshJobs);

  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenQueues, setHiddenQueues] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('factory-floor-hidden-queues') || '[]');
    } catch {
      return [];
    }
  });
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

  // Master queue consolidation - group jobs by consolidated stage names
  const dynamicJobGroups = useMemo(() => {
    console.log('🔄 Creating master queue consolidated job groups:', {
      jobCount: jobs?.length || 0,
      permissionUsed: highestPermission
    });
    
    if (!jobs || jobs.length === 0) {
      console.log('❌ No jobs available');
      return [];
    }

    console.log('🔍 Sample job data with master queue info:', jobs.slice(0, 3).map(job => ({
      wo_no: job.wo_no,
      current_stage_name: job.current_stage_name,
      display_stage_name: job.display_stage_name,
      is_subsidiary_stage: job.is_subsidiary_stage,
      master_queue_stage_id: job.master_queue_stage_id
    })));

    let filtered = jobs;

    // Apply search filter
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

    // Group jobs by their consolidated stage ID (master queue if subsidiary, otherwise regular stage)
    const stageJobGroups = new Map<string, AccessibleJob[]>();
    
    filtered.forEach(job => {
      // Use display_stage_id for accurate grouping - this contains master queue ID for subsidiary stages
      const stageId = job.display_stage_id || job.current_stage_id || 'unknown';
      const stageName = job.display_stage_name || job.current_stage_name || 'Unknown Stage';
      
      // Use stage ID as the key for accurate grouping, but display with stage name
      const groupKey = `${stageId}:${stageName}`;
      if (!stageJobGroups.has(groupKey)) {
        stageJobGroups.set(groupKey, []);
      }
      stageJobGroups.get(groupKey)!.push(job);
    });

    console.log('📊 Master queue consolidated groups:', Array.from(stageJobGroups.entries()).map(([name, jobs]) => ({
      stageName: name,
      jobCount: jobs.length,
      subsidiaryJobs: jobs.filter(j => j.is_subsidiary_stage).length,
      regularJobs: jobs.filter(j => !j.is_subsidiary_stage).length
    })));

    // Create job groups for each consolidated stage that has jobs and isn't hidden
    const jobGroups = [];
    
    Array.from(stageJobGroups.entries())
      .filter(([groupKey]) => {
        const stageName = groupKey.split(':')[1];
        return !hiddenQueues.includes(stageName);
      })
      .forEach(([groupKey, stageJobs]) => {
        const stageName = groupKey.split(':')[1];
        const stageNameLower = stageName.toLowerCase();
        let color = "bg-gray-600";
        
        // Assign colors based on stage name patterns - prioritize master queue names
        if (stageNameLower.includes('dtp')) {
          color = "bg-blue-600";
        } else if (stageNameLower.includes('proof')) {
          color = "bg-purple-600";
        } else if (stageNameLower.includes('hp 12000') || stageNameLower.includes('12000')) {
          color = "bg-green-600";
        } else if (stageNameLower.includes('hp 7900') || stageNameLower.includes('7900')) {
          color = "bg-emerald-600";
        } else if (stageNameLower.includes('hp t250') || stageNameLower.includes('t250')) {
          color = "bg-teal-600";
        } else if (stageNameLower.includes('print')) {
          color = "bg-green-600";
        } else if (stageNameLower.includes('finishing')) {
          color = "bg-orange-600";
        } else if (stageNameLower.includes('master queue')) {
          color = "bg-indigo-600";
        }
        
        // Sort jobs by WO number for consistent ordering within each master queue
        const sortedJobs = sortJobsByWONumber(stageJobs);
        
        jobGroups.push({
          title: stageName,
          jobs: sortedJobs,
          color,
          // Add metadata for master queue information
          hasSubsidiaryJobs: stageJobs.some(job => job.is_subsidiary_stage),
          subsidiaryCount: stageJobs.filter(job => job.is_subsidiary_stage).length,
          totalJobs: stageJobs.length
        });
        
        console.log('✅ Created consolidated job group:', {
          stageName,
          totalJobs: stageJobs.length,
          subsidiaryJobs: stageJobs.filter(job => job.is_subsidiary_stage).length,
          regularJobs: stageJobs.filter(job => !job.is_subsidiary_stage).length
        });
      });

    console.log('✅ Final master queue consolidated groups:', {
      totalGroups: jobGroups.length,
      groups: jobGroups.map(g => ({ 
        title: g.title, 
        totalJobs: g.totalJobs,
        subsidiaryJobs: g.subsidiaryCount,
        hasSubsidiaryJobs: g.hasSubsidiaryJobs
      }))
    });

    return jobGroups;
  }, [jobs, searchQuery, hiddenQueues, highestPermission]);

  // Listen for job updates from action components
  React.useEffect(() => {
    const handleJobUpdate = () => {
      console.log('🔄 Job updated event received, refreshing jobs...');
      refreshJobs();
    };

    window.addEventListener('job-updated', handleJobUpdate);
    return () => window.removeEventListener('job-updated', handleJobUpdate);
  }, [refreshJobs]);

  // Get list of unique stage names for toggle controls
  const availableStages = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];
    
    const stageNames = new Set<string>();
    jobs.forEach(job => {
      const stageName = job.display_stage_name || job.current_stage_name || 'Unknown Stage';
      stageNames.add(stageName);
    });
    
    return Array.from(stageNames).sort();
  }, [jobs]);

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

  const handleQueueToggle = (queueName: string) => {
    const newHiddenQueues = hiddenQueues.includes(queueName)
      ? hiddenQueues.filter(q => q !== queueName)
      : [...hiddenQueues, queueName];
    
    setHiddenQueues(newHiddenQueues);
    try {
      localStorage.setItem('factory-floor-hidden-queues', JSON.stringify(newHiddenQueues));
    } catch {
      // Ignore localStorage errors
    }
  };

  // Show loading state while detecting permissions
  if (permissionLoading || isLoading) {
    return (
      <JobListLoading 
        message="Loading your personalized factory floor..."
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

  const totalJobs = dynamicJobGroups.reduce((acc, group) => acc + group.jobs.length, 0);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <OperatorHeader 
        title={`Factory Floor - Personalized View (${totalJobs} jobs)`}
      />

      {/* Controls */}
      <QueueFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onQueueFiltersChange={() => {}} // Not used in simplified version
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        showQueueControls={false}
        totalJobs={totalJobs}
        jobGroupsCount={dynamicJobGroups.length}
      />

      {/* Queue Toggle Controls */}
      {availableStages.length > 0 && (
        <div className="flex-shrink-0 p-2 bg-white border-b">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-600 mr-2">Toggle Queues:</span>
            {availableStages.map(stageName => (
              <button
                key={stageName}
                onClick={() => handleQueueToggle(stageName)}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  hiddenQueues.includes(stageName)
                    ? 'bg-gray-100 text-gray-500 border-gray-300'
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
              >
                {hiddenQueues.includes(stageName) ? '👁️‍🗨️' : '👁️'} {stageName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Job Groups - Responsive Layout */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'card' ? (
          <div className="h-full overflow-x-auto">
            <div className="flex gap-4 p-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <JobGroupsDisplay
                jobGroups={dynamicJobGroups}
                viewMode={viewMode}
                searchQuery={searchQuery}
                onJobClick={handleJobClick}
                onStart={startJob}
                onComplete={completeJob}
              />
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 p-4 max-w-none">
              <JobGroupsDisplay
                jobGroups={dynamicJobGroups}
                viewMode={viewMode}
                searchQuery={searchQuery}
                onJobClick={handleJobClick}
                onStart={startJob}
                onComplete={completeJob}
              />
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
          onRefresh={refreshJobs}
        />
      )}
    </div>
  );
};