
import type { ExcelImportDebugger } from './debugger';

// Helper function to add "D" prefix to work order numbers consistently
const formatWorkOrderNumber = (woNo: string): string => {
  if (!woNo) return '';
  // Check if it already has a "D" prefix
  if (woNo.startsWith('D')) return woNo;
  // Add "D" prefix
  return `D${woNo}`;
};

export const formatWONumber = (woNo: any, logger: ExcelImportDebugger): string => {
  // Handle completely empty/null/undefined values
  if (woNo === null || woNo === undefined || woNo === '') {
    logger.addDebugInfo(`Empty WO Number field`);
    return "";
  }
  
  // Convert to string and clean
  const cleaned = String(woNo).trim();
  logger.addDebugInfo(`Processing WO Number: "${woNo}" -> "${cleaned}"`);
  
  // Handle empty string after trimming
  if (cleaned === '') {
    logger.addDebugInfo(`Empty WO Number after trimming`);
    return "";
  }
  
  // If it looks like a 6-digit number, pad if needed and add D prefix
  if (/^\d{6}$/.test(cleaned)) {
    const formatted = formatWorkOrderNumber(cleaned);
    logger.addDebugInfo(`WO Number 6 digits: ${cleaned} -> ${formatted}`);
    return formatted;
  }
  
  // If it's a longer number, don't pad it but add D prefix
  if (/^\d+$/.test(cleaned) && cleaned.length >= 6) {
    const formatted = formatWorkOrderNumber(cleaned);
    logger.addDebugInfo(`WO Number ${cleaned.length} digits: ${cleaned} -> ${formatted}`);
    return formatted;
  }
  
  // Extract only numbers and pad if needed, then add D prefix
  const numbersOnly = cleaned.replace(/[^0-9]/g, '');
  
  if (numbersOnly && numbersOnly.length > 0) {
    let processedNumber;
    // Only pad if it's less than 6 digits
    if (numbersOnly.length < 6) {
      processedNumber = numbersOnly.padStart(6, '0');
      logger.addDebugInfo(`WO Number "${cleaned}" -> "${numbersOnly}" -> "${processedNumber}" (padded)`);
    } else {
      processedNumber = numbersOnly;
      logger.addDebugInfo(`WO Number "${cleaned}" -> "${numbersOnly}" (no padding needed)`);
    }
    
    const formatted = formatWorkOrderNumber(processedNumber);
    logger.addDebugInfo(`Final WO Number: ${processedNumber} -> ${formatted}`);
    return formatted;
  }
  
  logger.addDebugInfo(`Could not extract valid WO Number from: "${cleaned}"`);
  return "";
};
