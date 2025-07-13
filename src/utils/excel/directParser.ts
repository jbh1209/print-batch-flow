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
  
  // Parse Excel with existing logic that handles cover/text and paper mapping
  const { jobs } = await parseExcelFileWithMapping(file, mapping, logger, []);
  
  // Step 2: Use existing enhanced mapper to prepare the data (preserves all working logic)
  const jobCreator = new EnhancedJobCreator(logger, userId, generateQRCodes);
  await jobCreator.initialize();
  
  // Prepare jobs with mappings but don't save to database yet
  const preparedResult = await jobCreator.prepareEnhancedJobsWithExcelData(jobs, headers, dataRows);
  
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
  
  const directCreator = new DirectJobCreator(logger, userId, preparedResult.generateQRCodes || true);
  return await directCreator.createJobsFromMappings(preparedResult);
};