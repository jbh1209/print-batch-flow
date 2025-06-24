
import { useMemo } from "react";

interface ProductionSidebarDataProps {
  jobStages: any[];
  enrichedJobs: any[];
}

export const useProductionSidebarData = ({ jobStages, enrichedJobs }: ProductionSidebarDataProps) => {
  
  // Get consolidated stages with job counts based on ACTIVE stages
  const consolidatedStages = useMemo(() => {
    const stageMap = new Map();
    
    // Build unique stages from jobStages
    jobStages.forEach(stage => {
      if (stage.production_stage && !stageMap.has(stage.production_stage_id)) {
        stageMap.set(stage.production_stage_id, {
          stage_id: stage.production_stage_id,
          stage_name: stage.production_stage.name,
          stage_color: stage.production_stage.color,
          is_master_queue: false,
          subsidiary_stages: [],
        });
      }
    });
    
    return Array.from(stageMap.values()).sort((a, b) => a.stage_name.localeCompare(b.stage_name));
  }, [jobStages]);

  // Count jobs that have ACTIVE stages for each production stage
  const getJobCountForStage = (stageName: string) => {
    return enrichedJobs.filter(job => {
      // Count jobs that have an ACTIVE stage instance for this production stage
      return job.stages.some(stage => 
        stage.stage_name === stageName && stage.status === 'active'
      );
    }).length;
  };

  // Count jobs by status
  const getJobCountByStatus = (status: string) => {
    return enrichedJobs.filter(job => {
      switch (status) {
        case 'completed':
          return job.stage_status === 'completed';
        case 'in-progress':
          return job.stage_status === 'active';
        case 'pending':
          return job.stage_status === 'pending';
        case 'overdue':
          if (!job.due_date) return false;
          const dueDate = new Date(job.due_date);
          const today = new Date();
          return dueDate < today && job.stage_status !== 'completed';
        default:
          return false;
      }
    }).length;
  };

  return {
    consolidatedStages,
    activeJobs: enrichedJobs,
    getJobCountForStage,
    getJobCountByStatus
  };
};
