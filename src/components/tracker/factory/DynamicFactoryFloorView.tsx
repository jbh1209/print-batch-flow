import React, { useState, useMemo } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useSmartPermissionDetection } from "@/hooks/tracker/useSmartPermissionDetection";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
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
  const { isDtpOperator, isOperator } = useUserRole();
  const { highestPermission, isLoading: permissionLoading } = useSmartPermissionDetection();
  
  // Get user's stage permissions to create dynamic job groups
  const {
    consolidatedStages,
    isLoading: stagesLoading
  } = useUserStagePermissions(user?.id);
  
  // Use smart permission detection for optimal job access
  const { jobs, isLoading, error, refreshJobs } = useAccessibleJobs({
    permissionType: highestPermission // Let the database function handle all the filtering
  });
  
  const { startJob, completeJob } = useJobActions(refreshJobs);

  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQueueFilters, setActiveQueueFilters] = useState<string[]>([]);
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

  // Create dynamic job groups based on user's accessible stages
  const dynamicJobGroups = useMemo(() => {
    console.log('🔄 Creating dynamic job groups based on user stages:', {
      jobCount: jobs?.length || 0,
      stageCount: consolidatedStages?.length || 0,
      permissionUsed: highestPermission,
      permissionLoading
    });
    
    if (!jobs || jobs.length === 0 || !consolidatedStages) {
      console.log('❌ No jobs or stages available for processing');
      return [];
    }

    let filtered = jobs;
    console.log('📋 Starting with jobs:', filtered.length, 'using permission:', highestPermission);

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

    // Group jobs by stage based on user's accessible stages
    const stageJobGroups = new Map<string, AccessibleJob[]>();
    
    // First, group jobs by their current stage
    filtered.forEach(job => {
      const stageId = job.current_stage_id;
      const stageName = job.current_stage_name || job.display_stage_name || 'Other';
      
      if (!stageJobGroups.has(stageName)) {
        stageJobGroups.set(stageName, []);
      }
      stageJobGroups.get(stageName)!.push(job);
    });

    // Create job groups for each accessible stage that has jobs
    const jobGroups = [];
    
    consolidatedStages.forEach(stage => {
      if (!stage.can_work) return; // Skip stages user can't work on
      
      const stageJobs = stageJobGroups.get(stage.stage_name) || [];
      const masterQueueJobs = stage.is_master_queue 
        ? stage.subsidiary_stages.flatMap(sub => stageJobGroups.get(sub.stage_name) || [])
        : [];
      
      const allStageJobs = [...stageJobs, ...masterQueueJobs];
      
      if (allStageJobs.length > 0 && !hiddenQueues.includes(stage.stage_name)) {
        const stageName = stage.stage_name.toLowerCase();
        let color = "bg-gray-600";
        
        if (stageName.includes('dtp')) {
          color = "bg-blue-600";
        } else if (stageName.includes('proof')) {
          color = "bg-purple-600";
        } else if (stageName.includes('12000')) {
          color = "bg-green-600";
        } else if (stageName.includes('7900')) {
          color = "bg-emerald-600";
        } else if (stageName.includes('t250')) {
          color = "bg-teal-600";
        } else if (stageName.includes('print')) {
          color = "bg-green-600";
        } else if (stageName.includes('finishing')) {
          color = "bg-orange-600";
        }
        
        jobGroups.push({
          title: stage.stage_name,
          jobs: sortJobsByWONumber(allStageJobs),
          color
        });
      }
    });

    console.log('✅ Dynamic job groups created:', {
      permission: highestPermission,
      groups: jobGroups.map(g => ({ title: g.title, count: g.jobs.length }))
    });

    return jobGroups;
  }, [jobs, consolidatedStages, searchQuery, hiddenQueues, highestPermission, permissionLoading]);

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

  // Show loading state while detecting permissions or loading stages
  if (permissionLoading || isLoading || stagesLoading) {
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
        onQueueFiltersChange={setActiveQueueFilters}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        showQueueControls={false} // We'll handle queue toggles differently
        totalJobs={totalJobs}
        jobGroupsCount={dynamicJobGroups.length}
      />

      {/* Queue Toggle Controls */}
      {consolidatedStages && consolidatedStages.length > 0 && (
        <div className="flex-shrink-0 p-2 bg-white border-b">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-600 mr-2">Toggle Queues:</span>
            {consolidatedStages
              .filter(stage => stage.can_work)
              .map(stage => (
                <button
                  key={stage.stage_id}
                  onClick={() => handleQueueToggle(stage.stage_name)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    hiddenQueues.includes(stage.stage_name)
                      ? 'bg-gray-100 text-gray-500 border-gray-300'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  {hiddenQueues.includes(stage.stage_name) ? '👁️‍🗨️' : '👁️'} {stage.stage_name}
                </button>
              ))
            }
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