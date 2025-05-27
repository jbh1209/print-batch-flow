
import * as XLSX from "xlsx";
import type { ParsedJob, ImportStats, ParsedData } from './types';
import type { ExcelImportDebugger } from './debugger';
import { formatExcelDate } from './dateFormatter';
import { formatWONumber } from './woNumberFormatter';
import { createColumnMap } from './columnMapper';

const safeGetCellValue = (row: any[], index: number): any => {
  if (index === -1 || !row || index >= row.length) return '';
  const value = row[index];
  return value === null || value === undefined ? '' : value;
};

export const parseExcelFile = async (file: File, logger: ExcelImportDebugger): Promise<ParsedData> => {
  logger.addDebugInfo(`Starting to process file: ${file.name}`);
  
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

  // Find column indices
  const columnMap = createColumnMap(headers, logger);
  logger.addDebugInfo(`Column mapping: ${JSON.stringify(columnMap)}`);

  // Process data rows
  let dataRows = jsonData.slice(1) as any[][];
  
  const stats: ImportStats = {
    totalRows: dataRows.length,
    processedRows: 0,
    skippedRows: 0,
    invalidWONumbers: 0,
    invalidDates: 0
  };

  const mapped: ParsedJob[] = [];

  dataRows.forEach((row, index) => {
    logger.addDebugInfo(`Processing row ${index + 2}: ${JSON.stringify(row.slice(0, 12))}`);
    
    const woNo = formatWONumber(safeGetCellValue(row, columnMap.woNo), logger);
    
    // Only skip if WO number is completely missing - allow other fields to be blank
    if (!woNo) {
      logger.addDebugInfo(`Skipping row ${index + 2}: Missing WO Number`);
      stats.skippedRows++;
      stats.invalidWONumbers++;
      return;
    }

    // Process dates with validation - allow empty dates
    const dateValue = safeGetCellValue(row, columnMap.date);
    const dueDateValue = safeGetCellValue(row, columnMap.dueDate);
    
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

    // Safely extract other fields with fallbacks
    const statusValue = safeGetCellValue(row, columnMap.status);
    const repValue = safeGetCellValue(row, columnMap.rep);
    const categoryValue = safeGetCellValue(row, columnMap.category);
    const customerValue = safeGetCellValue(row, columnMap.customer);
    const referenceValue = safeGetCellValue(row, columnMap.reference);
    const qtyValue = safeGetCellValue(row, columnMap.qty);
    const locationValue = safeGetCellValue(row, columnMap.location);

    const job: ParsedJob = {
      wo_no: woNo,
      status: String(statusValue || "").trim() || "Pre-Press",
      date: formattedDate,
      rep: String(repValue || "").trim(),
      category: String(categoryValue || "").trim(),
      customer: String(customerValue || "").trim(),
      reference: String(referenceValue || "").trim(),
      qty: parseInt(String(qtyValue || "0").replace(/[^0-9]/g, '')) || 0,
      due_date: formattedDueDate,
      location: String(locationValue || "").trim()
    };

    logger.addDebugInfo(`Mapped job: ${JSON.stringify(job)}`);
    mapped.push(job);
    stats.processedRows++;
  });

  logger.addDebugInfo(`Import completed: ${stats.processedRows} processed, ${stats.skippedRows} skipped, ${stats.invalidDates} invalid dates`);

  return { jobs: mapped, stats };
};
