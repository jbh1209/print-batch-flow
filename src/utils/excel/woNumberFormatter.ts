
import type { ExcelImportDebugger } from './debugger';

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
