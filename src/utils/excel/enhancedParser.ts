import * as XLSX from "xlsx";
import type { ParsedJob, ImportStats, ParsedData } from './types';
import type { ExcelImportDebugger } from './debugger';
import { formatExcelDate } from './dateFormatter';
import { formatWONumber } from './woNumberFormatter';
import { createColumnMap } from './columnMapper';
import type { ExcelPreviewData, ColumnMapping } from '@/components/tracker/ColumnMappingDialog';

export const parseExcelFileForPreview = async (file: File): Promise<ExcelPreviewData> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  
  if (jsonData.length < 2) {
    throw new Error("Excel file appears to be empty or has no data rows");
  }

  const headers = jsonData[0] as string[];
  const sampleRows = jsonData.slice(1, 6) as any[][]; // Get first 5 data rows for preview
  const totalRows = jsonData.length - 1; // Exclude header row

  return {
    headers,
    sampleRows,
    totalRows
  };
};

export const getAutoDetectedMapping = (headers: string[], logger: ExcelImportDebugger): ColumnMapping => {
  return createColumnMap(headers, logger);
};

const safeGetCellValue = (row: any[], index: number): any => {
  if (index === -1 || !row || index >= row.length) return '';
  const value = row[index];
  return value === null || value === undefined ? '' : value;
};

// Function to normalize status values - filter out unwanted statuses from MIS system
const normalizeStatus = (statusValue: any, logger: ExcelImportDebugger): string => {
  const rawStatus = String(statusValue || "").trim();
  
  // Filter out "Production" status as it's just a MIS marker with no value
  if (rawStatus.toLowerCase() === 'production') {
    logger.addDebugInfo(`Filtering out "Production" status - using default "Pre-Press"`);
    return "Pre-Press";
  }
  
  // Return the status as-is if it's not the filtered value
  return rawStatus || "Pre-Press";
};

export const parseExcelFileWithMapping = async (
  file: File, 
  mapping: ColumnMapping, 
  logger: ExcelImportDebugger
): Promise<ParsedData> => {
  logger.addDebugInfo(`Starting to process file: ${file.name} with custom mapping`);
  
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Get the range to understand the data structure
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  logger.addDebugInfo(`Sheet range: ${range.s.r} to ${range.e.r} rows, ${range.s.c} to ${range.e.c} columns`);
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  logger.addDebugInfo(`Raw data rows: ${jsonData.length}`);
  
  if (jsonData.length < 2) {
    throw new Error("Excel file appears to be empty or has no data rows");
  }

  // Get headers from first row
  const headers = jsonData[0] as string[];
  logger.addDebugInfo(`Headers found: ${JSON.stringify(headers)}`);
  logger.addDebugInfo(`Using custom mapping: ${JSON.stringify(mapping)}`);

  // Process data rows
  let dataRows = jsonData.slice(1) as any[][];
  
  const stats: ImportStats = {
    totalRows: dataRows.length,
    processedRows: 0,
    skippedRows: 0,
    invalidWONumbers: 0,
    invalidDates: 0,
    invalidTimingData: 0,
    invalidSpecifications: 0
  };

  const mapped: ParsedJob[] = [];

  dataRows.forEach((row, index) => {
    logger.addDebugInfo(`Processing row ${index + 2}: ${JSON.stringify(row.slice(0, 12))}`);
    
    const woNo = formatWONumber(safeGetCellValue(row, mapping.woNo), logger);
    
    // Only skip if WO number is completely missing - allow other fields to be blank
    if (!woNo) {
      logger.addDebugInfo(`Skipping row ${index + 2}: Missing WO Number`);
      stats.skippedRows++;
      stats.invalidWONumbers++;
      return;
    }

    // Process dates with validation - allow empty dates
    const dateValue = safeGetCellValue(row, mapping.date);
    const dueDateValue = safeGetCellValue(row, mapping.dueDate);
    
    const formattedDate = formatExcelDate(dateValue, logger);
    const formattedDueDate = formatExcelDate(dueDateValue, logger);
    
    // Only log as error if there was a value but it couldn't be parsed
    if (!formattedDate && dateValue && String(dateValue).trim() !== '') {
      logger.addDebugInfo(`Warning: Invalid date in row ${index + 2}: "${dateValue}"`);
      stats.invalidDates++;
    }
    if (!formattedDueDate && dueDateValue && String(dueDateValue).trim() !== '') {
      logger.addDebugInfo(`Warning: Invalid due date in row ${index + 2}: "${dueDateValue}"`);
      stats.invalidDates++;
    }

    // Safely extract other fields with fallbacks using custom mapping
    const statusValue = safeGetCellValue(row, mapping.status);
    const repValue = safeGetCellValue(row, mapping.rep);
    const categoryValue = safeGetCellValue(row, mapping.category);
    const customerValue = safeGetCellValue(row, mapping.customer);
    const referenceValue = safeGetCellValue(row, mapping.reference);
    const qtyValue = safeGetCellValue(row, mapping.qty);
    const locationValue = safeGetCellValue(row, mapping.location);
    
    // Extract timing and specification fields
    const estimatedHoursValue = safeGetCellValue(row, mapping.estimatedHours);
    const setupTimeValue = safeGetCellValue(row, mapping.setupTime);
    const runningSpeedValue = safeGetCellValue(row, mapping.runningSpeed);
    const speedUnitValue = safeGetCellValue(row, mapping.speedUnit);
    const specificationsValue = safeGetCellValue(row, mapping.specifications);
    const paperWeightValue = safeGetCellValue(row, mapping.paperWeight);
    const paperTypeValue = safeGetCellValue(row, mapping.paperType);
    const laminationValue = safeGetCellValue(row, mapping.lamination);

    // Parse timing values with validation
    let estimatedHours: number | null = null;
    let setupTimeMinutes: number | null = null;
    let runningSpeed: number | null = null;
    
    if (estimatedHoursValue && String(estimatedHoursValue).trim() !== '') {
      const parsed = parseFloat(String(estimatedHoursValue));
      if (!isNaN(parsed)) {
        estimatedHours = parsed;
      } else {
        logger.addDebugInfo(`Warning: Invalid estimated hours in row ${index + 2}: "${estimatedHoursValue}"`);
        stats.invalidTimingData++;
      }
    }
    
    if (setupTimeValue && String(setupTimeValue).trim() !== '') {
      const parsed = parseInt(String(setupTimeValue).replace(/[^0-9]/g, ''));
      if (!isNaN(parsed)) {
        setupTimeMinutes = parsed;
      } else {
        logger.addDebugInfo(`Warning: Invalid setup time in row ${index + 2}: "${setupTimeValue}"`);
        stats.invalidTimingData++;
      }
    }
    
    if (runningSpeedValue && String(runningSpeedValue).trim() !== '') {
      const parsed = parseFloat(String(runningSpeedValue).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) {
        runningSpeed = parsed;
      } else {
        logger.addDebugInfo(`Warning: Invalid running speed in row ${index + 2}: "${runningSpeedValue}"`);
        stats.invalidTimingData++;
      }
    }

    // Use the new status normalization function
    const normalizedStatus = normalizeStatus(statusValue, logger);

    const job: ParsedJob = {
      wo_no: woNo,
      status: normalizedStatus,
      date: formattedDate,
      rep: String(repValue || "").trim(),
      category: String(categoryValue || "").trim(),
      customer: String(customerValue || "").trim(),
      reference: String(referenceValue || "").trim(),
      qty: parseInt(String(qtyValue || "0").replace(/[^0-9]/g, '')) || 0,
      due_date: formattedDueDate,
      location: String(locationValue || "").trim(),
      // New timing and specification fields
      estimated_hours: estimatedHours,
      setup_time_minutes: setupTimeMinutes,
      running_speed: runningSpeed,
      speed_unit: String(speedUnitValue || "").trim() || null,
      specifications: String(specificationsValue || "").trim() || null,
      paper_weight: String(paperWeightValue || "").trim() || null,
      paper_type: String(paperTypeValue || "").trim() || null,
      lamination: String(laminationValue || "").trim() || null
    };

    logger.addDebugInfo(`Mapped job: ${JSON.stringify(job)}`);
    mapped.push(job);
    stats.processedRows++;
  });

  logger.addDebugInfo(`Import completed: ${stats.processedRows} processed, ${stats.skippedRows} skipped, ${stats.invalidDates} invalid dates, ${stats.invalidTimingData} invalid timing data`);

  return { jobs: mapped, stats };
};