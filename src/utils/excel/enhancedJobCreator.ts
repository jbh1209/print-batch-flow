import type { ParsedJob, RowMappingResult } from './types';
import type { ExcelImportDebugger } from './debugger';

export const mapRowToStage = (
  job: ParsedJob,
  row: any[],
  rowIndex: number,
  groupName: string,
  description: string,
  stageMappings: any[],
  logger: ExcelImportDebugger
): RowMappingResult => {
  logger.addDebugInfo(`Attempting to map row ${rowIndex} - Group: ${groupName}, Description: ${description}`);
  
  let mappedStageId: string | null = null;
  let mappedStageName: string | null = null;
  let mappedStageSpecId: string | null = null;
  let mappedStageSpecName: string | null = null;
  let confidence = 0;
  let category: RowMappingResult['category'] = 'unknown';
  let isUnmapped = false;
  let instanceId: string | undefined = undefined;
  let paperSpecification: string | undefined = undefined;
  let partType: string | undefined = undefined;
  
  // Try to find a matching stage mapping
  const matchingStage = findMatchingStage(description, groupName, stageMappings, logger);
  
  if (matchingStage) {
    mappedStageId = matchingStage.stageId;
    mappedStageName = matchingStage.stageName;
    mappedStageSpecId = matchingStage.stageSpecId || null;
    mappedStageSpecName = matchingStage.stageSpecName || null;
    confidence = matchingStage.confidence;
    category = matchingStage.category;
    instanceId = matchingStage.instanceId;
    paperSpecification = matchingStage.paperSpecification;
    partType = matchingStage.specifications[0];
    
    logger.addDebugInfo(`Matched stage: ${mappedStageName} (ID: ${mappedStageId}, Confidence: ${confidence})`);
  } else {
    isUnmapped = true;
    logger.addDebugInfo(`No matching stage found - marking as unmapped`);
  }
  
  const qty = extractQuantityFromJobSpecs(job, groupName, logger);
  const woQty = job.qty;
  
  return {
    excelRowIndex: rowIndex,
    excelData: row,
    groupName,
    description,
    qty,
    woQty,
    mappedStageId,
    mappedStageName,
    mappedStageSpecId,
    mappedStageSpecName,
    confidence,
    category,
    isUnmapped,
    instanceId,
    paperSpecification,
    partType
  };
};

const findMatchingStage = (
  description: string,
  groupName: string,
  stageMappings: any[],
  logger: ExcelImportDebugger
): any | null => {
  
  // Try to find a mapping based on description first
  let matchingStage = stageMappings.find(mapping => {
    const descriptionMatch = description && mapping.specifications.some((spec: string) =>
      spec && description.toLowerCase().includes(spec.toLowerCase())
    );
    return descriptionMatch;
  });
  
  if (matchingStage) {
    logger.addDebugInfo(`Matched stage by description: ${matchingStage.stageName}`);
    return matchingStage;
  }
  
  // If no match on description, try to find a mapping based on group name
  matchingStage = stageMappings.find(mapping => {
    const groupMatch = groupName && mapping.specifications.some((spec: string) =>
      spec && groupName.toLowerCase().includes(spec.toLowerCase())
    );
    return groupMatch;
  });
  
  if (matchingStage) {
    logger.addDebugInfo(`Matched stage by group name: ${matchingStage.stageName}`);
    return matchingStage;
  }
  
  return null;
};

const extractQuantityFromJobSpecs = (
  job: ParsedJob, 
  groupName: string, 
  logger: ExcelImportDebugger
): number => {
  logger.addDebugInfo(`Extracting quantity for group: ${groupName}`);
  
  // Priority 1: Use cover_text_detection data for book jobs
  if (job.cover_text_detection?.isBookJob && job.cover_text_detection.components) {
    logger.addDebugInfo(`Book job detected - checking cover/text components`);
    
    // Check if this is a cover printing stage
    if (groupName.toLowerCase().includes('cover') || 
        groupName.toLowerCase().includes('hp 12000') ||
        groupName.toLowerCase().includes('b2 4 process')) {
      
      const coverComponent = job.cover_text_detection.components.find(c => c.type === 'cover');
      if (coverComponent?.printing) {
        logger.addDebugInfo(`Using cover printing quantity: ${coverComponent.printing.qty}`);
        return coverComponent.printing.qty;
      }
    }
    
    // Check if this is a text printing stage
    if (groupName.toLowerCase().includes('text') || 
        groupName.toLowerCase().includes('inkjet') ||
        groupName.toLowerCase().includes('b1 4 process')) {
      
      const textComponent = job.cover_text_detection.components.find(c => c.type === 'text');
      if (textComponent?.printing) {
        logger.addDebugInfo(`Using text printing quantity: ${textComponent.printing.qty}`);
        return textComponent.printing.qty;
      }
    }
  }
  
  // Priority 2: Search in printing specifications (existing logic)
  if (job.printing_specifications) {
    // Try exact match first
    if (job.printing_specifications[groupName]) {
      const qty = job.printing_specifications[groupName].qty || 0;
      logger.addDebugInfo(`Found exact match in printing specs: ${qty}`);
      return qty;
    }
    
    // Try partial match for similar names
    for (const [key, spec] of Object.entries(job.printing_specifications)) {
      if (key.toLowerCase().includes(groupName.toLowerCase()) || 
          groupName.toLowerCase().includes(key.toLowerCase())) {
        const qty = spec.qty || 0;
        logger.addDebugInfo(`Found partial match "${key}" in printing specs: ${qty}`);
        return qty;
      }
    }
  }
  
  // Priority 3: Search in other specification types
  const specTypes = [
    'finishing_specifications',
    'prepress_specifications', 
    'delivery_specifications',
    'packaging_specifications'
  ] as const;
  
  for (const specType of specTypes) {
    if (job[specType]) {
      if (job[specType]![groupName]) {
        const qty = job[specType]![groupName].qty || 0;
        logger.addDebugInfo(`Found in ${specType}: ${qty}`);
        return qty;
      }
    }
  }
  
  // Priority 4: Use operation quantities
  if (job.operation_quantities?.[groupName]) {
    const qty = job.operation_quantities[groupName].operation_qty;
    logger.addDebugInfo(`Found in operation quantities: ${qty}`);
    return qty;
  }
  
  // Final fallback: use job quantity
  logger.addDebugInfo(`Using job quantity fallback: ${job.qty}`);
  return job.qty;
};
