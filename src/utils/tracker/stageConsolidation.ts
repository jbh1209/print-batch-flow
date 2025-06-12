
import { UserStagePermission } from "@/hooks/tracker/useUserStagePermissions";

export interface ConsolidatedStage {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  can_view: boolean;
  can_edit: boolean;
  can_work: boolean;
  can_manage: boolean;
  is_master_queue: boolean;
  subsidiary_stages: UserStagePermission[];
  master_queue_id?: string;
  master_queue_name?: string;
}

/**
 * Central function to consolidate stages by master queue.
 * This is the single source of truth for stage grouping across the entire application.
 */
export const consolidateStagesByMasterQueue = (stages: UserStagePermission[]): ConsolidatedStage[] => {
  const stageMap = new Map<string, ConsolidatedStage>();
  
  // First pass: Create entries for master queues and standalone stages
  stages.forEach(stage => {
    const isSubsidiaryStage = !!stage.master_queue_id;
    
    if (isSubsidiaryStage) {
      // This stage belongs to a master queue
      const masterKey = stage.master_queue_id!;
      
      if (!stageMap.has(masterKey)) {
        // Create master queue entry
        stageMap.set(masterKey, {
          stage_id: masterKey,
          stage_name: stage.master_queue_name || 'Unknown Master Queue',
          stage_color: stage.stage_color,
          can_view: stage.can_view,
          can_edit: stage.can_edit,
          can_work: stage.can_work,
          can_manage: stage.can_manage,
          is_master_queue: true,
          subsidiary_stages: [],
          master_queue_id: stage.master_queue_id,
          master_queue_name: stage.master_queue_name
        });
      }
      
      // Add subsidiary stage to master queue
      const masterStage = stageMap.get(masterKey)!;
      masterStage.subsidiary_stages.push(stage);
      
      // Aggregate permissions (OR operation for maximum access)
      masterStage.can_view = masterStage.can_view || stage.can_view;
      masterStage.can_edit = masterStage.can_edit || stage.can_edit;
      masterStage.can_work = masterStage.can_work || stage.can_work;
      masterStage.can_manage = masterStage.can_manage || stage.can_manage;
    } else {
      // Standalone stage
      const stageKey = stage.stage_id;
      
      stageMap.set(stageKey, {
        stage_id: stage.stage_id,
        stage_name: stage.stage_name,
        stage_color: stage.stage_color,
        can_view: stage.can_view,
        can_edit: stage.can_edit,
        can_work: stage.can_work,
        can_manage: stage.can_manage,
        is_master_queue: false,
        subsidiary_stages: [],
        master_queue_id: undefined,
        master_queue_name: undefined
      });
    }
  });
  
  return Array.from(stageMap.values()).sort((a, b) => {
    // Sort by name for consistent ordering
    return a.stage_name.localeCompare(b.stage_name);
  });
};

/**
 * Get all individual stages (both master queues and subsidiaries) for admin purposes
 */
export const getAllIndividualStages = (stages: UserStagePermission[]): UserStagePermission[] => {
  return stages;
};

/**
 * Find the display name for a stage, considering master queue relationships
 */
export const getStageDisplayName = (
  stageId: string, 
  consolidatedStages: ConsolidatedStage[]
): string => {
  // Check if this stage ID is a master queue
  const masterQueue = consolidatedStages.find(cs => cs.stage_id === stageId && cs.is_master_queue);
  if (masterQueue) {
    return masterQueue.stage_name;
  }
  
  // Check if this stage is a subsidiary of a master queue
  const parentMaster = consolidatedStages.find(cs => 
    cs.subsidiary_stages.some(sub => sub.stage_id === stageId)
  );
  
  if (parentMaster) {
    return parentMaster.stage_name;
  }
  
  // Fallback to finding the stage in the original data
  const allStages = consolidatedStages.flatMap(cs => [
    { stage_id: cs.stage_id, stage_name: cs.stage_name },
    ...cs.subsidiary_stages.map(sub => ({ stage_id: sub.stage_id, stage_name: sub.stage_name }))
  ]);
  
  const stage = allStages.find(s => s.stage_id === stageId);
  return stage?.stage_name || 'Unknown Stage';
};

/**
 * Check if a stage ID represents a master queue or belongs to one
 */
export const isStageAccessible = (
  stageId: string,
  consolidatedStages: ConsolidatedStage[],
  permissionType: 'view' | 'edit' | 'work' | 'manage'
): boolean => {
  // Check direct match (master queue or standalone)
  const directMatch = consolidatedStages.find(cs => cs.stage_id === stageId);
  if (directMatch) {
    return directMatch[`can_${permissionType}`];
  }
  
  // Check if stage is a subsidiary of a master queue
  const parentMaster = consolidatedStages.find(cs => 
    cs.subsidiary_stages.some(sub => sub.stage_id === stageId)
  );
  
  if (parentMaster) {
    return parentMaster[`can_${permissionType}`];
  }
  
  return false;
};
