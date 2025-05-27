
import * as XLSX from "xlsx";
import type { ParsedJob, ImportStats, ParsedData } from './types';
import type { ExcelImportDebugger } from './debugger';
import { formatExcelDate } from './dateFormatter';
import { formatWONumber } from './woNumberFormatter';
import { createColumnMap } from './columnMapper';

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
    
    const woNo = formatWONumber(row[columnMap.woNo], logger);
    
    if (!woNo) {
      logger.addDebugInfo(`Skipping row ${index + 2}: Invalid WO Number`);
      stats.skippedRows++;
      stats.invalidWONumbers++;
      return;
    }

    // Process dates with validation
    const formattedDate = formatExcelDate(row[columnMap.date], logger);
    const formattedDueDate = formatExcelDate(row[columnMap.dueDate], logger);
    
    // Check for invalid dates
    if (!formattedDate && row[columnMap.date]) {
      logger.addDebugInfo(`Warning: Invalid date in row ${index + 2}`);
      stats.invalidDates++;
    }
    if (!formattedDueDate && row[columnMap.dueDate]) {
      logger.addDebugInfo(`Warning: Invalid due date in row ${index + 2}`);
      stats.invalidDates++;
    }

    const job: ParsedJob = {
      wo_no: woNo,
      status: String(row[columnMap.status] || "").trim() || "Pre-Press",
      date: formattedDate,
      rep: String(row[columnMap.rep] || "").trim(),
      category: String(row[columnMap.category] || "").trim(),
      customer: String(row[columnMap.customer] || "").trim(),
      reference: String(row[columnMap.reference] || "").trim(),
      qty: parseInt(String(row[columnMap.qty] || "0").replace(/[^0-9]/g, '')) || 0,
      due_date: formattedDueDate,
      location: String(row[columnMap.location] || "").trim()
    };

    logger.addDebugInfo(`Mapped job: ${JSON.stringify(job)}`);
    mapped.push(job);
    stats.processedRows++;
  });

  logger.addDebugInfo(`Import completed: ${stats.processedRows} processed, ${stats.skippedRows} skipped, ${stats.invalidDates} invalid dates`);

  return { jobs: mapped, stats };
};
