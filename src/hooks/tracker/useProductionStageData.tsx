
import { useMemo } from "react";

interface ProductionStageDataProps {
  jobs: any[];
  jobStages: any[];
}

export const useProductionStageData = ({ jobs, jobStages }: ProductionStageDataProps) => {
  
  // Transform jobs with production-specific logic
  const enrichedJobs = useMemo(() => {
    return jobs
      .filter(job => job.status !== 'Completed') // Hide completed jobs for production
      .map(job => {
        const stages = jobStages.filter(stage => stage.job_id === job.id);
        
        // Get ACTIVE stage (what production is currently working on)
        const activeStage = stages.find(stage => stage.status === 'active');
        const currentStageName = activeStage?.production_stage?.name || 'No Active Stage';
        
        // Calculate stage status based on active work
        const hasActiveStage = stages.some(stage => stage.status === 'active');
        const hasPendingStages = stages.some(stage => stage.status === 'pending');
        const allCompleted = stages.length > 0 && stages.every(stage => stage.status === 'completed');
        
        let stageStatus = 'unknown';
        if (hasActiveStage) stageStatus = 'active';
        else if (hasPendingStages) stageStatus = 'pending';
        else if (allCompleted) stageStatus = 'completed';

        // Calculate workflow progress
        const totalStages = stages.length;
        const completedStages = stages.filter(stage => stage.status === 'completed').length;
        const workflowProgress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

        return {
          ...job,
          stages: stages.map(stage => ({
            ...stage,
            stage_name: stage.production_stage?.name || 'Unknown Stage',
            stage_color: stage.production_stage?.color || '#6B7280',
          })),
          current_stage_name: currentStageName,
          active_stage_id: activeStage?.production_stage_id || null,
          stage_status: stageStatus,
          workflow_progress: workflowProgress,
          total_stages: totalStages,
          completed_stages: completedStages
        };
      });
  }, [jobs, jobStages]);

  return { enrichedJobs };
};
