import type { ScheduledStageData } from "@/hooks/useScheduleReader";
import type { GroupPreview } from "./groupingUtils";
import { extractLaminationSpec } from "./groupingUtils";

// Apply custom group ordering to stages
export const applyCustomGroupOrder = (
  stages: ScheduledStageData[],
  groupPreviews: GroupPreview[],
  customOrder: string[],
  groupingType: 'paper' | 'lamination' | 'paper_and_size',
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
  } else if (groupingType === 'paper_and_size') {
    stages.forEach(stage => {
      const paperSpec = stage.paper_display || 'Unknown Paper';
      const paperSize = stage.hp12000_paper_size || 'Unknown Size';
      const combinedSpec = `${paperSpec} - ${paperSize}`;
      if (!groupStagesMap.has(combinedSpec)) {
        groupStagesMap.set(combinedSpec, []);
      }
      groupStagesMap.get(combinedSpec)!.push(stage);
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