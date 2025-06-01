
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
  
  // If it already has D prefix, normalize it and ensure proper padding
  if (cleaned.toUpperCase().startsWith('D')) {
    const numberPart = cleaned.substring(1);
    if (/^\d+$/.test(numberPart)) {
      // Pad to 6 digits if less than 6
      const paddedNumber = numberPart.length < 6 ? numberPart.padStart(6, '0') : numberPart;
      const formatted = `D${paddedNumber}`;
      logger.addDebugInfo(`WO Number with D prefix: ${cleaned} -> ${formatted}`);
      return formatted;
    } else {
      const normalized = cleaned.toUpperCase();
      logger.addDebugInfo(`WO Number already has D prefix: ${cleaned} -> ${normalized}`);
      return normalized;
    }
  }
  
  // Extract only numbers and format with D prefix
  const numbersOnly = cleaned.replace(/[^0-9]/g, '');
  
  if (numbersOnly && numbersOnly.length > 0) {
    // Pad to 6 digits if less than 6
    const paddedNumber = numbersOnly.length < 6 ? numbersOnly.padStart(6, '0') : numbersOnly;
    const formatted = `D${paddedNumber}`;
    logger.addDebugInfo(`WO Number "${cleaned}" -> numbers: "${numbersOnly}" -> padded: "${paddedNumber}" -> final: "${formatted}"`);
    return formatted;
  }
  
  logger.addDebugInfo(`Could not extract valid WO Number from: "${cleaned}"`);
  return "";
};
