
import React, { useState, useMemo, useCallback } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search } from "lucide-react";
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
    );
  }

  return (
    <div className="h-full flex flex-col p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search jobs by WO, customer, reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden">
        {workableStages.map(stage => (
          <UniversalKanbanColumn
            key={stage.stage_id}
            stage={stage}
            jobs={jobsByStage[stage.stage_id] || []}
            onStart={startJob}
            onComplete={completeJob}
            onJobClick={handleJobClick}
          />
        ))}
        
        {workableStages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            No accessible stages found. Contact your administrator.
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
