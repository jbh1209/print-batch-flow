import type { ScheduledStageData } from "@/hooks/useScheduleReader";
import type { GroupPreview } from "./groupingUtils";
import { extractLaminationSpec } from "./groupingUtils";

// Apply custom group ordering to stages
export const applyCustomGroupOrder = (
  stages: ScheduledStageData[],
  groupPreviews: GroupPreview[],
  customOrder: string[],
  groupingType: 'paper' | 'lamination',
  jobSpecs?: Map<string, any>
): ScheduledStageData[] => {
  // Create a map of group name to stages
  const groupStagesMap = new Map<string, ScheduledStageData[]>();
  
  if (groupingType === 'paper') {
    stages.forEach(stage => {
      const paperSpec = stage.paper_display || 'Unknown Paper';
      if (!groupStagesMap.has(paperSpec)) {
        groupStagesMap.set(paperSpec, []);
      }
      groupStagesMap.get(paperSpec)!.push(stage);
    });
  } else if (groupingType === 'lamination' && jobSpecs) {
    stages.forEach(stage => {
      const jobFinishingSpecs = jobSpecs.get(stage.job_id);
      const laminationSpec = extractLaminationSpec(jobFinishingSpecs);
      if (!groupStagesMap.has(laminationSpec)) {
        groupStagesMap.set(laminationSpec, []);
      }
      groupStagesMap.get(laminationSpec)!.push(stage);
    });
  }

  // Build reordered stages array based on custom order
  const reorderedStages: ScheduledStageData[] = [];
  
  customOrder.forEach(groupName => {
    const groupStages = groupStagesMap.get(groupName);
    if (groupStages) {
      // Sort stages within group by WO number
      groupStages.sort((a, b) => a.job_wo_no.localeCompare(b.job_wo_no));
      reorderedStages.push(...groupStages);
    }
  });

  return reorderedStages;
};