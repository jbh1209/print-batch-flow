import { formatSAST, isWorkingDay, isWithinBusinessHours, getCurrentSAST, getNextWorkingDayStart, createSASTDate } from './timezone';

/**
 * **PHASE 1: PRODUCTION SCHEDULER - WORKING HOURS FOUNDATION**
 * Working hours utilities built on the validated timezone foundation
 * CRITICAL: All working hour logic MUST use the timezone foundation functions
 */

/**
 * Get working hours for a specific date in SAST timezone
 * CRITICAL: Uses the validated timezone foundation
 */
export function getSASTWorkingHours(date: Date, startHour: number = 8, endHour: number = 17): {
  start: Date;
  end: Date;
  isWorkingDay: boolean;
} {
  if (!date || isNaN(date.getTime())) {
    throw new Error('Valid date is required for getSASTWorkingHours');
  }

  const dateStr = formatSAST(date, 'yyyy-MM-dd');
  const isValidWorkingDay = isWorkingDay(date);
  
  // Create working hours using validated functions
  // Note: We don't validate during creation here since this is for getting hours, not scheduling
  let start: Date;
  let end: Date;
  
  try {
    // For non-working days, still create the times but mark as non-working
    start = new Date(`${dateStr}T${startHour.toString().padStart(2, '0')}:00:00+02:00`);
    end = new Date(`${dateStr}T${endHour.toString().padStart(2, '0')}:30:00+02:00`); // 17:30 end
  } catch {
    // Fallback for invalid dates
    const nowSAST = getCurrentSAST();
    start = getNextWorkingDayStart(nowSAST);
    end = new Date(start.getTime() + (9.5 * 60 * 60 * 1000)); // 9.5 hour day
  }
  
  return {
    start,
    end,
    isWorkingDay: isValidWorkingDay
  };
}

/**
 * **BUSINESS LOGIC: Check if a SAST date/time falls within working hours**
 * CRITICAL: Uses the validated timezone foundation functions
 */
export function isDateInSASTWorkingHours(sastDateTime: Date, startHour: number = 8, endHour: number = 17): boolean {
  if (!sastDateTime || isNaN(sastDateTime.getTime())) {
    return false;
  }
  
  // Use the foundation functions for validation
  if (!isWorkingDay(sastDateTime)) {
    return false;
  }
  
  if (!isWithinBusinessHours(sastDateTime)) {
    return false;
  }
  
  return true;
}

/**
 * **BUSINESS LOGIC: Get the next working day start time in SAST**
 * CRITICAL: Uses the validated timezone foundation
 */
export function getNextSASTWorkingDayStart(fromDate: Date, startHour: number = 8): Date {
  if (!fromDate || isNaN(fromDate.getTime())) {
    throw new Error('Valid from date is required');
  }
  
  // Use the foundation function
  return getNextWorkingDayStart(fromDate);
}

/**
 * **BUSINESS LOGIC: Ensure a proposed time falls within SAST working hours**
 * CRITICAL: Uses the validated timezone foundation
 */
export function ensureSASTWorkingHours(proposedTime: Date, startHour: number = 8): Date {
  if (!proposedTime || isNaN(proposedTime.getTime())) {
    throw new Error('Valid proposed time is required');
  }
  
  // Use foundation function for validation and adjustment
  if (isDateInSASTWorkingHours(proposedTime, startHour)) {
    return proposedTime;
  }
  
  // Use foundation function to get next valid time
  return getNextWorkingDayStart(proposedTime);
}