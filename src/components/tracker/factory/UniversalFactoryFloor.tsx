
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { FactoryFloorHeader } from "./FactoryFloorHeader";
import { UniversalKanbanColumn } from "./UniversalKanbanColumn";
import { DtpJobModal } from "./DtpJobModal";
import { MobileFactoryView } from "./MobileFactoryView";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface StageInstanceData {
  id: string;
  job_id: string;
  production_stage_id: string;
  status: string;
  proof_emailed_at?: string;
  client_email?: string;
  client_name?: string;
  proof_pdf_url?: string;
  updated_at?: string;
  production_stage?: {
    name: string;
  };
}

export const UniversalFactoryFloor = () => {
  const { jobs, isLoading, refreshJobs } = useAccessibleJobs();
  const { startJob, completeJob } = useJobActions(refreshJobs);
  const { accessibleStages, isLoading: stagesLoading } = useUserStagePermissions();
  const isMobile = useIsMobile();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stageInstancesMap, setStageInstancesMap] = useState<Record<string, StageInstanceData>>({});

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

  // Fetch current stage instances for all jobs
  const fetchStageInstances = useCallback(async () => {
    if (jobs.length === 0) return;

    try {
      // Get all job-stage pairs for current active stages
      const jobStagePairs = jobs
        .filter(job => job.current_stage_id)
        .map(job => ({
          job_id: job.job_id,
          stage_id: job.current_stage_id!
        }));

      if (jobStagePairs.length === 0) return;

      // Build query to fetch stage instances for current active stages
      const { data: instances, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          status,
          proof_emailed_at,
          client_email,
          client_name,
          proof_pdf_url,
          updated_at,
          production_stage:production_stages(name)
        `)
        .in('job_id', jobStagePairs.map(pair => pair.job_id))
        .in('production_stage_id', jobStagePairs.map(pair => pair.stage_id))
        .in('status', ['active', 'awaiting_approval']);

      if (error) {
        console.error('Error fetching stage instances:', error);
        return;
      }

      // Create a map keyed by job_id + stage_id for quick lookup
      const instanceMap: Record<string, StageInstanceData> = {};
      instances?.forEach(instance => {
        const key = `${instance.job_id}-${instance.production_stage_id}`;
        instanceMap[key] = instance;
      });

      setStageInstancesMap(instanceMap);
    } catch (error) {
      console.error('Error fetching stage instances:', error);
    }
  }, [jobs]);

  // Get stage instance for a specific job
  const getStageInstanceForJob = useCallback((job: AccessibleJob): StageInstanceData | undefined => {
    if (!job.current_stage_id) return undefined;
    const key = `${job.job_id}-${job.current_stage_id}`;
    return stageInstancesMap[key];
  }, [stageInstancesMap]);

  // Fetch stage instances when jobs change
  useEffect(() => {
    fetchStageInstances();
  }, [fetchStageInstances]);

  // Real-time subscription for stage instance changes
  useEffect(() => {
    const channel = supabase
      .channel('stage-instances-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances'
        },
        () => {
          fetchStageInstances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStageInstances]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshJobs();
      await fetchStageInstances();
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [refreshJobs, fetchStageInstances]);

  const handleJobClick = useCallback((job: AccessibleJob) => {
    setSelectedJob(job);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedJob(null);
  }, []);

  // Fixed action handlers with correct signatures
  const handleStartJob = useCallback(async (jobId: string, stageId: string): Promise<boolean> => {
    return await startJob(jobId, stageId);
  }, [startJob]);

  const handleCompleteJob = useCallback(async (jobId: string, stageId: string): Promise<boolean> => {
    return await completeJob(jobId, stageId);
  }, [completeJob]);

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
          onStart={handleStartJob}
          onComplete={handleCompleteJob}
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
                    onStart={handleStartJob}
                    onComplete={handleCompleteJob}
                    onJobClick={handleJobClick}
                    onRefresh={handleRefresh}
                    getStageInstanceForJob={getStageInstanceForJob}
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
          onStart={handleStartJob}
          onComplete={handleCompleteJob}
        />
      )}
    </div>
  );
};
