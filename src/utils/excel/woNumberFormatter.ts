
import type { ExcelImportDebugger } from './debugger';

// Enhanced WO number formatter with consistent D prefix enforcement
const enforceWOPrefix = (woNo: string): string => {
  if (!woNo) return '';
  // Check if it already has a "D" prefix
  if (woNo.toUpperCase().startsWith('D')) return woNo.toUpperCase();
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
  
  // If it already has D prefix, normalize it
  if (cleaned.toUpperCase().startsWith('D')) {
    const normalized = cleaned.toUpperCase();
    logger.addDebugInfo(`WO Number already has D prefix: ${cleaned} -> ${normalized}`);
    return normalized;
  }
  
  // If it looks like a 6+ digit number, add D prefix
  if (/^\d{6,}$/.test(cleaned)) {
    const formatted = enforceWOPrefix(cleaned);
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
    
    const formatted = enforceWOPrefix(processedNumber);
    logger.addDebugInfo(`Final WO Number: ${processedNumber} -> ${formatted}`);
    return formatted;
  }
  
  logger.addDebugInfo(`Could not extract valid WO Number from: "${cleaned}"`);
  return "";
};
