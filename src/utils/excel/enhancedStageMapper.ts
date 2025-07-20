import type { ParsedJob } from './types';
import type { ExcelImportDebugger } from './debugger';

/**
 * Enhances the parsed job data with additional logic for stage mapping,
 * especially handling cover/text differentiation for printing stages.
 */
export const enhanceStageMappings = (
  job: ParsedJob,
  logger: ExcelImportDebugger
): any[] => {
  logger.addDebugInfo(`Starting stage mapping enhancement for job ${job.wo_no}`);

  const {
    paper_specifications: paperSpecs,
    printing_specifications: printingSpecs,
    operation_quantities: operationQuantities
  } = job;

  // Create row mappings for printing stages, handling cover/text logic
  const printingRowMappings = createPrintingRowMappingsWithPaper(printingSpecs, paperSpecs, operationQuantities, logger);

  // Create row mappings for other stages (non-printing)
  const otherRowMappings = createGenericRowMappings(
    job,
    paperSpecs,
    printingSpecs,
    logger
  );

  // Combine all row mappings
  const allRowMappings = [...printingRowMappings, ...otherRowMappings];

  logger.addDebugInfo(`Generated ${allRowMappings.length} row mappings for job ${job.wo_no}`);
  return allRowMappings;
};

const createGenericRowMappings = (
  job: ParsedJob,
  paperSpecs: any,
  printingSpecs: any,
  logger: ExcelImportDebugger
): any[] => {
  const rowMappings: any[] = [];

  // Process paper specifications
  if (paperSpecs && Object.keys(paperSpecs).length > 0) {
    Object.entries(paperSpecs).forEach(([key, spec]: [string, any]) => {
      const rowMapping = {
        mappedStageName: spec.description || key,
        mappedStageId: null, // Will be set by stage matching
        qty: spec.qty,
        wo_qty: spec.wo_qty,
        paperSpecification: spec.description || key
      };
      rowMappings.push(rowMapping);
      logger.addDebugInfo(`Created paper row mapping: ${rowMapping.mappedStageName} (qty: ${rowMapping.qty})`);
    });
  }

  // Process other specifications (excluding printing)
  const otherSpecs = {
    ...job.delivery_specifications,
    ...job.finishing_specifications,
    ...job.prepress_specifications,
    ...job.packaging_specifications
  };

  if (otherSpecs && Object.keys(otherSpecs).length > 0) {
    Object.entries(otherSpecs).forEach(([key, spec]: [string, any]) => {
      const rowMapping = {
        mappedStageName: spec.description || key,
        mappedStageId: null, // Will be set by stage matching
        qty: spec.qty,
        wo_qty: spec.wo_qty,
        paperSpecification: null
      };
      rowMappings.push(rowMapping);
      logger.addDebugInfo(`Created generic row mapping: ${rowMapping.mappedStageName} (qty: ${rowMapping.qty})`);
    });
  }

  return rowMappings;
};

const createPrintingRowMappingsWithPaper = (
  printingSpecs: any,
  paperSpecs: any,
  operationQuantities: any,
  logger: ExcelImportDebugger
): any[] => {
  logger.addDebugInfo("=== DEBUGGING createPrintingRowMappingsWithPaper ===");
  
  // DEBUG: Log the exact structure of printingSpecs
  logger.addDebugInfo(`printingSpecs structure: ${JSON.stringify(printingSpecs, null, 2)}`);
  
  if (!printingSpecs || Object.keys(printingSpecs).length === 0) {
    logger.addDebugInfo("No printing specifications found");
    return [];
  }

  // Extract printing operations from specifications
  const printingOps = Object.entries(printingSpecs).map(([key, spec]: [string, any]) => {
    // DEBUG: Log each spec structure
    logger.addDebugInfo(`Processing printing spec key: "${key}"`);
    logger.addDebugInfo(`Spec structure: ${JSON.stringify(spec, null, 2)}`);
    logger.addDebugInfo(`spec.qty value: ${spec.qty} (type: ${typeof spec.qty})`);
    logger.addDebugInfo(`spec.wo_qty value: ${spec.wo_qty} (type: ${typeof spec.wo_qty})`);
    
    return {
      key,
      spec,
      description: spec.description || key,
      qty: spec.qty, // CRITICAL: This should be 53 or 583
      wo_qty: spec.wo_qty || 0
    };
  });

  // DEBUG: Log the printingOps array before sorting
  logger.addDebugInfo(`printingOps before sorting: ${JSON.stringify(printingOps.map(op => ({
    key: op.key,
    qty: op.qty,
    wo_qty: op.wo_qty
  })), null, 2)}`);

  if (printingOps.length < 2) {
    logger.addDebugInfo(`Only ${printingOps.length} printing operation(s) found - not enough for cover/text detection`);
    return printingOps.map(op => createSingleRowMapping(op, logger));
  }

  // Sort by quantity - cover should have lower quantity
  const sortedOps = printingOps.sort((a, b) => (a.qty || 0) - (b.qty || 0));
  
  // DEBUG: Log after sorting
  logger.addDebugInfo(`printingOps after sorting: ${JSON.stringify(sortedOps.map(op => ({
    key: op.key,
    qty: op.qty,
    wo_qty: op.wo_qty
  })), null, 2)}`);

  const coverPrintingOp = sortedOps[0];
  const textPrintingOp = sortedOps[sortedOps.length - 1];

  // DEBUG: Log the selected cover and text operations
  logger.addDebugInfo(`COVER operation selected: key="${coverPrintingOp.key}", qty=${coverPrintingOp.qty}`);
  logger.addDebugInfo(`TEXT operation selected: key="${textPrintingOp.key}", qty=${textPrintingOp.qty}`);

  // Create mappings with cover/text labeling
  const coverMapping = createCoverTextRowMapping(coverPrintingOp, 'Cover', paperSpecs, logger);
  const textMapping = createCoverTextRowMapping(textPrintingOp, 'Text', paperSpecs, logger);

  // DEBUG: Log the final mappings
  logger.addDebugInfo(`FINAL COVER mapping: ${JSON.stringify({
    mappedStageName: coverMapping.mappedStageName,
    qty: coverMapping.qty,
    partType: coverMapping.partType
  })}`);
  
  logger.addDebugInfo(`FINAL TEXT mapping: ${JSON.stringify({
    mappedStageName: textMapping.mappedStageName,
    qty: textMapping.qty,
    partType: textMapping.partType
  })}`);

  return [coverMapping, textMapping];
};

const createCoverTextRowMapping = (
  printingOp: any,
  partType: 'Cover' | 'Text',
  paperSpecs: any,
  logger: ExcelImportDebugger
): any => {
  logger.addDebugInfo(`=== Creating ${partType} mapping ===`);
  logger.addDebugInfo(`Input printingOp: ${JSON.stringify({
    key: printingOp.key,
    qty: printingOp.qty,
    wo_qty: printingOp.wo_qty
  })}`);

  const baseMapping = createSingleRowMapping(printingOp, logger);
  
  // DEBUG: Log base mapping
  logger.addDebugInfo(`Base mapping created: ${JSON.stringify({
    mappedStageName: baseMapping.mappedStageName,
    qty: baseMapping.qty,
    partType: baseMapping.partType
  })}`);

  const result = {
    ...baseMapping,
    mappedStageName: `${baseMapping.mappedStageName} (${partType})`,
    partType: partType,
    qty: printingOp.qty // CRITICAL: Ensure this is the individual quantity
  };

  // DEBUG: Log final result
  logger.addDebugInfo(`Final ${partType} mapping: ${JSON.stringify({
    mappedStageName: result.mappedStageName,
    qty: result.qty,
    partType: result.partType
  })}`);

  return result;
};

const createSingleRowMapping = (printingOp: any, logger: ExcelImportDebugger): any => {
  logger.addDebugInfo(`=== Creating single row mapping ===`);
  logger.addDebugInfo(`Input: ${JSON.stringify({
    key: printingOp.key,
    qty: printingOp.qty,
    wo_qty: printingOp.wo_qty
  })}`);

  const result = {
    mappedStageName: printingOp.description || printingOp.key,
    mappedStageId: null, // Will be set by stage matching
    qty: printingOp.qty, // CRITICAL: This should preserve individual quantities
    wo_qty: printingOp.wo_qty,
    paperSpecification: null // Will be enhanced later
  };

  logger.addDebugInfo(`Single mapping result: ${JSON.stringify({
    mappedStageName: result.mappedStageName,
    qty: result.qty,
    wo_qty: result.wo_qty
  })}`);

  return result;
};
