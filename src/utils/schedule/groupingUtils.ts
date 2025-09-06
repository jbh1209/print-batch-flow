import type { ScheduledStageData } from "@/hooks/useScheduleReader";

export interface GroupPreview {
  id: string;
  groupName: string;
  count: number;
  jobs: string[]; // job wo_no array
  originalIndex: number;
}

// Extract lamination specification from finishing_specifications JSONB
export const extractLaminationSpec = (finishingSpecs: any): string => {
  if (!finishingSpecs || typeof finishingSpecs !== 'object') {
    return 'None';
  }
  
  // Look for keys containing "lamination" (case insensitive)
  for (const [key, value] of Object.entries(finishingSpecs)) {
    if (key.toLowerCase().includes('lamination')) {
      // Return the description from the value object if it exists, otherwise the key
      if (typeof value === 'object' && value && (value as any).description) {
        return (value as any).description;
      }
      return key;
    }
  }
  
  return 'None';
};

// Group stages by paper specifications
export const groupStagesByPaper = (stages: ScheduledStageData[]): { grouped: ScheduledStageData[]; previews: GroupPreview[] } => {
  const groups = new Map<string, ScheduledStageData[]>();
  
  // Group stages by paper_display
  stages.forEach(stage => {
    const paperSpec = stage.paper_display || 'Unknown Paper';
    if (!groups.has(paperSpec)) {
      groups.set(paperSpec, []);
    }
    groups.get(paperSpec)!.push(stage);
  });
  
  // Sort groups by paper specification name
  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  
  // Create grouped stages array and previews
  const grouped: ScheduledStageData[] = [];
  const previews: GroupPreview[] = [];
  
  sortedGroups.forEach(([paperSpec, groupStages], index) => {
    // Sort stages within group by WO number
    groupStages.sort((a, b) => a.job_wo_no.localeCompare(b.job_wo_no));
    grouped.push(...groupStages);
    
    previews.push({
      id: `paper-${index}`,
      groupName: paperSpec,
      count: groupStages.length,
      jobs: groupStages.map(s => s.job_wo_no),
      originalIndex: index
    });
  });
  
  return { grouped, previews };
};

// Group stages by lamination specifications (requires finishing_specifications to be added to ScheduledStageData)
export const groupStagesByLamination = (stages: ScheduledStageData[], jobSpecs: Map<string, any>): { grouped: ScheduledStageData[]; previews: GroupPreview[] } => {
  const groups = new Map<string, ScheduledStageData[]>();
  
  // Group stages by lamination specification
  stages.forEach(stage => {
    const jobFinishingSpecs = jobSpecs.get(stage.job_id);
    const laminationSpec = extractLaminationSpec(jobFinishingSpecs);
    
    if (!groups.has(laminationSpec)) {
      groups.set(laminationSpec, []);
    }
    groups.get(laminationSpec)!.push(stage);
  });
  
  // Sort groups by lamination specification name
  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  
  // Create grouped stages array and previews
  const grouped: ScheduledStageData[] = [];
  const previews: GroupPreview[] = [];
  
  sortedGroups.forEach(([laminationSpec, groupStages], index) => {
    // Sort stages within group by WO number
    groupStages.sort((a, b) => a.job_wo_no.localeCompare(b.job_wo_no));
    grouped.push(...groupStages);
    
    previews.push({
      id: `lamination-${index}`,
      groupName: laminationSpec,
      count: groupStages.length,
      jobs: groupStages.map(s => s.job_wo_no),
      originalIndex: index
    });
  });
  
  return { grouped, previews };
};

// Determine if a stage is a printing stage
export const isPrintingStage = (stageName: string): boolean => {
  const name = stageName.toLowerCase();
  return name.includes('printing') || name.includes('print') || name.includes('hp') || 
         name.includes('xerox') || name.includes('t250') || name.includes('7900') || 
         name.includes('12000') || name.includes('envelope printing') || 
         name.includes('large format');
};

// Determine if a stage is a laminating stage
export const isLaminatingStage = (stageName: string): boolean => {
  const name = stageName.toLowerCase();
  return name.includes('lamination') || name.includes('laminating') || name.includes('laminate');
};