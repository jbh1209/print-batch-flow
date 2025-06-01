
// Enhanced WO number formatter with consistent D prefix enforcement
export const formatWONumber = (woNo: any): string => {
  // Handle completely empty/null/undefined values
  if (woNo === null || woNo === undefined || woNo === '') {
    return "";
  }
  
  // Convert to string and clean
  const cleaned = String(woNo).trim();
  
  // Handle empty string after trimming
  if (cleaned === '') {
    return "";
  }
  
  // If it already has a "D" prefix, return as-is
  if (cleaned.toUpperCase().startsWith('D')) {
    return cleaned.toUpperCase();
  }
  
  // Extract only numbers
  const numbersOnly = cleaned.replace(/[^0-9]/g, '');
  
  if (numbersOnly && numbersOnly.length > 0) {
    // Pad to 6 digits if less than 6
    const paddedNumber = numbersOnly.length < 6 ? numbersOnly.padStart(6, '0') : numbersOnly;
    return `D${paddedNumber}`;
  }
  
  // If no numbers found, return empty
  return "";
};

// Validation function to check if WO number is valid
export const isValidWONumber = (woNo: string): boolean => {
  if (!woNo) return false;
  const formatted = formatWONumber(woNo);
  return formatted.length >= 7 && formatted.startsWith('D'); // D + at least 6 digits
};

// Function to enforce D prefix on existing WO numbers
export const enforceWOPrefix = (woNo: string): string => {
  return formatWONumber(woNo);
};
