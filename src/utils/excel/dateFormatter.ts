
import type { ExcelImportDebugger } from './debugger';

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
