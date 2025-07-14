import * as XLSX from 'xlsx';
import type { ColumnMapping } from '@/components/tracker/ColumnMappingDialog';
import type { ExcelImportDebugger } from './debugger';
import { parseExcelFileWithMapping } from './enhancedParser';
import { DirectJobCreator, type DirectJobResult } from '@/services/DirectJobCreator';
import { EnhancedJobCreator } from './enhancedJobCreator';

/**
 * Simplified direct job creation that preserves all the working cover/text and paper logic
 * but removes the complex layered approach
 */
export const parseAndCreateJobsDirectly = async (
  file: File,
  mapping: ColumnMapping,
  logger: ExcelImportDebugger,
  userId: string,
  generateQRCodes: boolean = true
): Promise<DirectJobResult> => {
  logger.addDebugInfo(`Starting direct job creation for file: ${file.name}`);
  
  // Step 1: Use existing parsing logic (this works perfectly!)
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  
  const headers = jsonData[0] as string[];
  const dataRows = jsonData.slice(1) as any[][];
  
  // Parse Excel with existing logic but DEBUG what we actually get
  const { jobs } = await parseExcelFileWithMapping(file, mapping, logger, []);
  
  logger.addDebugInfo(`DEBUGGING: Raw jobs from parseExcelFileWithMapping: ${jobs.length}`);
  jobs.forEach((job, index) => {
    logger.addDebugInfo(`Job ${index}: ${job.wo_no}`);
    logger.addDebugInfo(`- printing_specifications: ${JSON.stringify(Object.keys(job.printing_specifications || {}))}`);
    logger.addDebugInfo(`- finishing_specifications: ${JSON.stringify(Object.keys(job.finishing_specifications || {}))}`);
    logger.addDebugInfo(`- prepress_specifications: ${JSON.stringify(Object.keys(job.prepress_specifications || {}))}`);
    logger.addDebugInfo(`- delivery_specifications: ${JSON.stringify(Object.keys(job.delivery_specifications || {}))}`);
  });
  
  // Step 2: Create rowMappings directly from the job specifications (preserves user-approved mappings)
  const enhancedJobAssignments = jobs.map(job => {
    const rowMappings: any[] = [];
    
    // Extract mappings from job specifications - these should contain the user's mappedStageId values
    if (job.printing_specifications) {
      Object.entries(job.printing_specifications).forEach(([key, spec]: [string, any]) => {
        logger.addDebugInfo(`Checking printing spec ${key}: mappedStageId=${spec.mappedStageId}`);
        if (spec.mappedStageId) {
          rowMappings.push({
            excelRowIndex: job._originalRowIndex || 0,
            excelData: job._originalExcelRow || [],
            groupName: key,
            description: spec.description || '',
            qty: spec.qty || job.qty,
            woQty: spec.wo_qty || job.qty,
            mappedStageId: spec.mappedStageId,
            mappedStageName: spec.mappedStageName || '',
            mappedStageSpecId: spec.mappedStageSpecId || null,
            mappedStageSpecName: spec.mappedStageSpecName || null,
            confidence: 100,
            category: 'printing' as const,
            isUnmapped: false
          });
        }
      });
    }
    
    // Add other specification types
    ['finishing_specifications', 'prepress_specifications', 'delivery_specifications'].forEach(specType => {
      const specs = (job as any)[specType];
      if (specs) {
        Object.entries(specs).forEach(([key, spec]: [string, any]) => {
          logger.addDebugInfo(`Checking ${specType} spec ${key}: mappedStageId=${spec.mappedStageId}`);
          if (spec.mappedStageId) {
            rowMappings.push({
              excelRowIndex: job._originalRowIndex || 0,
              excelData: job._originalExcelRow || [],
              groupName: key,
              description: spec.description || '',
              qty: spec.qty || job.qty,
              woQty: spec.wo_qty || job.qty,
              mappedStageId: spec.mappedStageId,
              mappedStageName: spec.mappedStageName || '',
              mappedStageSpecId: spec.mappedStageSpecId || null,
              mappedStageSpecName: spec.mappedStageSpecName || null,
              confidence: 100,
              category: specType.replace('_specifications', '') as any,
              isUnmapped: false
            });
          }
        });
      }
    });
    
    logger.addDebugInfo(`DEBUGGING: Created ${rowMappings.length} mappings from job ${job.wo_no} specifications`);
    
    return {
      originalJob: job,
      rowMappings
    };
  });
  
  const preparedResult = {
    enhancedJobAssignments,
    generateQRCodes,
    stats: {
      total: jobs.length,
      successful: 0,
      failed: 0
    }
  };
  
  // Step 3: Use our simplified creator to directly save jobs
  const directCreator = new DirectJobCreator(logger, userId, generateQRCodes);
  const finalResult = await directCreator.createJobsFromMappings(preparedResult);
  
  logger.addDebugInfo(`Direct job creation completed: ${finalResult.stats.successful}/${finalResult.stats.total} jobs created`);
  
  return finalResult;
};

/**
 * Helper function to maintain compatibility with existing UI
 */
export const finalizeJobsDirectly = async (
  preparedResult: any,
  logger: ExcelImportDebugger,
  userId: string
): Promise<DirectJobResult> => {
  logger.addDebugInfo('Finalizing jobs using direct approach');
  logger.addDebugInfo(`FINALIZATION: Preserving user-approved stage mappings: ${JSON.stringify(preparedResult.userApprovedStageMappings || {})}`);
  
  // CRITICAL: Pass user-approved stage mappings to DirectJobCreator
  const directCreator = new DirectJobCreator(logger, userId, preparedResult.generateQRCodes || true);
  
  // Ensure user mappings are preserved in the prepared result
  preparedResult.preservedUserMappings = preparedResult.userApprovedStageMappings || {};
  
  return await directCreator.createJobsFromMappings(preparedResult);
};