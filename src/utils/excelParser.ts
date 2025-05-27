
import * as XLSX from "xlsx";

export interface ParsedJob {
  wo_no: string;
  status: string;
  date: string;
  rep: string;
  category: string;
  customer: string;
  reference: string;
  qty: number;
  due_date: string;
  location: string;
  note: string;
}

export interface ImportStats {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  invalidWONumbers: number;
}

export class ExcelImportDebugger {
  private debugInfo: string[] = [];

  addDebugInfo(message: string) {
    this.debugInfo.push(message);
    console.log("[Excel Import]", message);
  }

  getDebugInfo(): string[] {
    return [...this.debugInfo];
  }

  clear() {
    this.debugInfo = [];
  }
}

export const formatExcelDate = (excelDate: any, logger: ExcelImportDebugger): string => {
  if (!excelDate) return "";
  
  logger.addDebugInfo(`Processing date: ${JSON.stringify(excelDate)} (type: ${typeof excelDate})`);
  
  // If it's already a string
  if (typeof excelDate === 'string') {
    const cleaned = excelDate.trim();
    
    // Handle YYYY/MM/DD format
    if (cleaned.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
      const [year, month, day] = cleaned.split('/');
      const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      logger.addDebugInfo(`Formatted date string ${cleaned} to ${formatted}`);
      return formatted;
    }
    
    // Handle other date formats
    const dateAttempt = new Date(cleaned);
    if (!isNaN(dateAttempt.getTime())) {
      const formatted = dateAttempt.toISOString().split('T')[0];
      logger.addDebugInfo(`Parsed date string ${cleaned} to ${formatted}`);
      return formatted;
    }
    
    logger.addDebugInfo(`Could not parse date string: ${cleaned}`);
    return "";
  }
  
  // If it's an Excel serial number
  if (typeof excelDate === 'number') {
    try {
      // Excel dates are days since 1900-01-01 (with leap year bug correction)
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
      const formatted = date.toISOString().split('T')[0];
      logger.addDebugInfo(`Converted Excel serial ${excelDate} to ${formatted}`);
      return formatted;
    } catch (error) {
      logger.addDebugInfo(`Error converting Excel serial ${excelDate}: ${error}`);
      return "";
    }
  }
  
  // If it's already a Date object
  if (excelDate instanceof Date) {
    const formatted = excelDate.toISOString().split('T')[0];
    logger.addDebugInfo(`Converted Date object to ${formatted}`);
    return formatted;
  }
  
  logger.addDebugInfo(`Unknown date format: ${JSON.stringify(excelDate)}`);
  return "";
};

export const formatWONumber = (woNo: any, logger: ExcelImportDebugger): string => {
  if (!woNo && woNo !== 0) return "";
  
  // Convert to string and clean
  const cleaned = String(woNo).trim();
  logger.addDebugInfo(`Processing WO Number: "${woNo}" -> "${cleaned}"`);
  
  // If it looks like a 6-digit number, return as-is
  if (/^\d{6}$/.test(cleaned)) {
    logger.addDebugInfo(`WO Number already 6 digits: ${cleaned}`);
    return cleaned;
  }
  
  // If it's a longer number, don't pad it - return as-is
  if (/^\d+$/.test(cleaned) && cleaned.length >= 6) {
    logger.addDebugInfo(`WO Number is ${cleaned.length} digits, keeping as-is: ${cleaned}`);
    return cleaned;
  }
  
  // Extract only numbers and pad if needed
  const numbersOnly = cleaned.replace(/[^0-9]/g, '');
  
  if (numbersOnly && numbersOnly.length > 0) {
    // Only pad if it's less than 6 digits
    if (numbersOnly.length < 6) {
      const padded = numbersOnly.padStart(6, '0');
      logger.addDebugInfo(`WO Number "${cleaned}" -> "${numbersOnly}" -> "${padded}"`);
      return padded;
    } else {
      logger.addDebugInfo(`WO Number "${cleaned}" -> "${numbersOnly}" (no padding needed)`);
      return numbersOnly;
    }
  }
  
  logger.addDebugInfo(`Could not extract valid WO Number from: "${cleaned}"`);
  return "";
};

export const findColumnIndex = (headers: string[], possibleNames: string[], logger: ExcelImportDebugger): number => {
  const headerLower = headers.map(h => String(h || '').toLowerCase().trim());
  
  for (const name of possibleNames) {
    const index = headerLower.findIndex(h => h.includes(name.toLowerCase()));
    if (index !== -1) {
      logger.addDebugInfo(`Found column "${name}" at index ${index} (header: "${headers[index]}")`);
      return index;
    }
  }
  
  logger.addDebugInfo(`Column not found for: ${possibleNames.join(', ')}`);
  return -1;
};

export const parseExcelFile = async (file: File, logger: ExcelImportDebugger): Promise<{ jobs: ParsedJob[], stats: ImportStats }> => {
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
  const columnMap = {
    woNo: findColumnIndex(headers, ['wo no', 'work order', 'wo number'], logger),
    status: findColumnIndex(headers, ['status'], logger),
    date: findColumnIndex(headers, ['date', 'creation date', 'created'], logger),
    rep: findColumnIndex(headers, ['rep', 'representative'], logger),
    category: findColumnIndex(headers, ['category', 'type'], logger),
    customer: findColumnIndex(headers, ['customer', 'client'], logger),
    reference: findColumnIndex(headers, ['reference', 'ref'], logger),
    qty: findColumnIndex(headers, ['qty', 'quantity'], logger),
    dueDate: findColumnIndex(headers, ['due date', 'due'], logger),
    location: findColumnIndex(headers, ['location', 'dept', 'department'], logger),
    note: findColumnIndex(headers, ['note', 'notes', 'comment', 'comments'], logger)
  };

  logger.addDebugInfo(`Column mapping: ${JSON.stringify(columnMap)}`);

  // Process data rows, excluding the last row if it's just a number (total count)
  let dataRows = jsonData.slice(1) as any[][];
  
  // Check if last row is just a total count (single number)
  const lastRow = dataRows[dataRows.length - 1];
  if (lastRow && lastRow.length === 1 && !isNaN(Number(lastRow[0]))) {
    logger.addDebugInfo(`Removing total count row: ${lastRow[0]}`);
    dataRows = dataRows.slice(0, -1);
  }
  
  const stats: ImportStats = {
    totalRows: dataRows.length,
    processedRows: 0,
    skippedRows: 0,
    invalidWONumbers: 0
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

    const job: ParsedJob = {
      wo_no: woNo,
      status: String(row[columnMap.status] || "").trim() || "Production",
      date: formatExcelDate(row[columnMap.date], logger),
      rep: String(row[columnMap.rep] || "").trim(),
      category: String(row[columnMap.category] || "").trim(),
      customer: String(row[columnMap.customer] || "").trim(),
      reference: String(row[columnMap.reference] || "").trim(),
      qty: parseInt(String(row[columnMap.qty] || "0").replace(/[^0-9]/g, '')) || 0,
      due_date: formatExcelDate(row[columnMap.dueDate], logger),
      location: String(row[columnMap.location] || "").trim(),
      note: String(row[columnMap.note] || "").trim()
    };

    logger.addDebugInfo(`Mapped job: ${JSON.stringify(job)}`);
    mapped.push(job);
    stats.processedRows++;
  });

  logger.addDebugInfo(`Import completed: ${stats.processedRows} processed, ${stats.skippedRows} skipped`);

  return { jobs: mapped, stats };
};
