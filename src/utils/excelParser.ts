
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
}

export interface ImportStats {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  invalidWONumbers: number;
  invalidDates: number;
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
  
  try {
    let dateObj: Date | null = null;
    
    // If it's already a string
    if (typeof excelDate === 'string') {
      const cleaned = excelDate.trim();
      
      // Handle YYYY/MM/DD format
      if (cleaned.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
        const [year, month, day] = cleaned.split('/');
        dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        // Try to parse as regular date string
        dateObj = new Date(cleaned);
      }
    }
    // If it's an Excel serial number
    else if (typeof excelDate === 'number') {
      // Excel dates are days since 1900-01-01 (with leap year bug correction)
      const excelEpoch = new Date(1900, 0, 1);
      dateObj = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
    }
    // If it's already a Date object
    else if (excelDate instanceof Date) {
      dateObj = excelDate;
    }
    
    // Validate the date and format as YYYY-MM-DD
    if (dateObj && !isNaN(dateObj.getTime())) {
      const formatted = dateObj.toISOString().split('T')[0];
      logger.addDebugInfo(`Successfully formatted date to: ${formatted}`);
      return formatted;
    } else {
      logger.addDebugInfo(`Invalid date, could not parse: ${JSON.stringify(excelDate)}`);
      return "";
    }
  } catch (error) {
    logger.addDebugInfo(`Error processing date ${JSON.stringify(excelDate)}: ${error}`);
    return "";
  }
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

  // Find column indices - removed 'note' field as it's not in database
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
    location: findColumnIndex(headers, ['location', 'dept', 'department'], logger)
  };

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
