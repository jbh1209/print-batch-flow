
import React, { useState, useMemo, useCallback } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { FactoryFloorHeader } from "./FactoryFloorHeader";
import { UniversalKanbanColumn } from "./UniversalKanbanColumn";
import { DtpJobModal } from "./DtpJobModal";
import { MobileFactoryView } from "./MobileFactoryView";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

export const UniversalFactoryFloor = () => {
  const { jobs, isLoading, refreshJobs } = useAccessibleJobs();
  const { startJob, completeJob } = useJobActions(refreshJobs);
  const { accessibleStages, isLoading: stagesLoading } = useUserStagePermissions();
  const isMobile = useIsMobile();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get stages where user can work
  const workableStages = useMemo(() => {
    return accessibleStages.filter(stage => stage.can_work);
  }, [accessibleStages]);

  // Filter jobs by search
  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    
    const query = searchQuery.toLowerCase();
    return jobs.filter(job => 
      job.wo_no?.toLowerCase().includes(query) ||
      job.customer?.toLowerCase().includes(query) ||
      job.reference?.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  // Group jobs by stage
  const jobsByStage = useMemo(() => {
    const grouped: Record<string, AccessibleJob[]> = {};
    
    // Initialize empty arrays for all workable stages
    workableStages.forEach(stage => {
      grouped[stage.stage_id] = [];
    });
    
    // Group filtered jobs by current stage
    filteredJobs.forEach(job => {
      if (job.current_stage_id && grouped[job.current_stage_id]) {
        grouped[job.current_stage_id].push(job);
      }
    });
    
    return grouped;
  }, [filteredJobs, workableStages]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshJobs();
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [refreshJobs]);

  const handleJobClick = useCallback((job: AccessibleJob) => {
    setSelectedJob(job);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedJob(null);
  }, []);

  if (isLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileFactoryView
          workableStages={workableStages}
          jobsByStage={jobsByStage}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          onJobClick={handleJobClick}
          onStart={startJob}
          onComplete={completeJob}
          isRefreshing={isRefreshing}
        />
      </div>
    );
  }

  // Determine responsive grid classes based on column count
  const getGridClass = (columnCount: number) => {
    if (columnCount === 1) return "grid-cols-1";
    if (columnCount === 2) return "grid-cols-1 lg:grid-cols-2";
    if (columnCount === 3) return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
    if (columnCount === 4) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";
  };

  const gridClass = getGridClass(workableStages.length);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <FactoryFloorHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-hidden">
        {workableStages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-lg">No accessible stages found</p>
              <p className="text-sm">Contact your administrator for access permissions.</p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto p-4">
            <div className={`grid ${gridClass} gap-4 min-h-full`}>
              {workableStages.map(stage => (
                <div key={stage.stage_id} className="min-h-0">
                  <UniversalKanbanColumn
                    stage={stage}
                    jobs={jobsByStage[stage.stage_id] || []}
                    onStart={startJob}
                    onComplete={completeJob}
                    onJobClick={handleJobClick}
                  />
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
          onClose={handleModalClose}
          onStart={startJob}
          onComplete={completeJob}
        />
      )}
    </div>
  );
};
