import React, { useState, useMemo } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useSmartPermissionDetection } from "@/hooks/tracker/useSmartPermissionDetection";
import { useAuth } from "@/hooks/useAuth";
import { useDivision } from "@/contexts/DivisionContext";
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
  const { selectedDivision } = useDivision();
  const { highestPermission, isLoading: permissionLoading } = useSmartPermissionDetection();
  
  // Use smart permission detection for optimal job access with division filtering
  const { jobs, isLoading, error, refreshJobs } = useAccessibleJobs({
    permissionType: highestPermission,
    divisionFilter: selectedDivision
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

  // Simplified job grouping - group by stage name directly from jobs
  const dynamicJobGroups = useMemo(() => {
    console.log('🔄 Creating simplified job groups:', {
      jobCount: jobs?.length || 0,
      permissionUsed: highestPermission
    });
    
    if (!jobs || jobs.length === 0) {
      console.log('❌ No jobs available');
      return [];
    }

    console.log('🔍 Sample job data:', jobs.slice(0, 3).map(job => ({
      wo_no: job.wo_no,
      current_stage_name: job.current_stage_name,
      display_stage_name: job.display_stage_name
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

    // Group jobs by their display stage name (use display_stage_name for master queues)
    const stageJobGroups = new Map<string, AccessibleJob[]>();
    
    filtered.forEach(job => {
      const stageName = job.display_stage_name || job.current_stage_name || 'Unknown Stage';
      
      if (!stageJobGroups.has(stageName)) {
        stageJobGroups.set(stageName, []);
      }
      stageJobGroups.get(stageName)!.push(job);
    });

    console.log('📊 Stage job groups:', Array.from(stageJobGroups.entries()).map(([name, jobs]) => ({
      stageName: name,
      jobCount: jobs.length
    })));

    // Create job groups for each stage that has jobs and isn't hidden
    const jobGroups = [];
    
    Array.from(stageJobGroups.entries())
      .filter(([stageName]) => !hiddenQueues.includes(stageName))
      .forEach(([stageName, stageJobs]) => {
        const stageNameLower = stageName.toLowerCase();
        let color = "bg-gray-600";
        
        // Assign colors based on stage name patterns
        if (stageNameLower.includes('dtp')) {
          color = "bg-blue-600";
        } else if (stageNameLower.includes('proof')) {
          color = "bg-purple-600";
        } else if (stageNameLower.includes('12000')) {
          color = "bg-green-600";
        } else if (stageNameLower.includes('7900')) {
          color = "bg-emerald-600";
        } else if (stageNameLower.includes('t250')) {
          color = "bg-teal-600";
        } else if (stageNameLower.includes('print')) {
          color = "bg-green-600";
        } else if (stageNameLower.includes('finishing')) {
          color = "bg-orange-600";
        }
        
        jobGroups.push({
          title: stageName,
          jobs: sortJobsByWONumber(stageJobs),
          color
        });
        
        console.log('✅ Created job group:', stageName, 'with', stageJobs.length, 'jobs');
      });

    console.log('✅ Final job groups created:', {
      totalGroups: jobGroups.length,
      groups: jobGroups.map(g => ({ title: g.title, count: g.jobs.length }))
    });

    return jobGroups;
  }, [jobs, searchQuery, hiddenQueues, highestPermission]);

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

      {/* Job Groups - Vertical Queues with Max 3 Columns */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-x-auto">
          <div className="flex gap-4 p-4 min-w-max" style={{ 
            maxWidth: viewMode === 'card' ? 'none' : '100%',
            gridTemplateColumns: viewMode === 'card' ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'none',
            display: viewMode === 'card' ? 'grid' : 'flex'
          }}>
            <div className={`${viewMode === 'card' ? 'contents' : 'flex gap-4'} ${dynamicJobGroups.length > 3 ? 'overflow-x-auto' : ''}`}>
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
        </div>
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