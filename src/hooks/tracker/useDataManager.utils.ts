
/**
 * Utility functions for useDataManager.
 */

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function isCacheValid(cache: { timestamp: number } | null): boolean {
  if (!cache) return false;
  const now = Date.now();
  return (now - cache.timestamp) < CACHE_TTL;
}

export function groupStagesByMasterQueue(stages: any[]) {
  const masterQueues = new Map();
  const independentStages = [];

  stages.forEach(stage => {
    if (stage.master_queue_id) {
      const masterStage = stages.find(s => s.id === stage.master_queue_id);
      if (masterStage) {
        if (!masterQueues.has(stage.master_queue_id)) {
          masterQueues.set(stage.master_queue_id, {
            ...masterStage,
            subsidiaryStages: []
          });
        }
        masterQueues.get(stage.master_queue_id).subsidiaryStages.push(stage);
      }
    } else {
      const hasSubordinates = stages.some(s => s.master_queue_id === stage.id);
      if (hasSubordinates) {
        if (!masterQueues.has(stage.id)) {
          masterQueues.set(stage.id, {
            ...stage,
            subsidiaryStages: stages.filter(s => s.master_queue_id === stage.id)
          });
        }
      } else {
        independentStages.push(stage);
      }
    }
  });

  return {
    masterQueues: Array.from(masterQueues.values()),
    independentStages,
    allStagesFlattened: stages,
    consolidatedStages: [
      ...Array.from(masterQueues.values()),
      ...independentStages
    ]
  };
}
