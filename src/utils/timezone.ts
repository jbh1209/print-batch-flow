import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addDays, isAfter, isWeekend } from 'date-fns';

// Helper functions for missing date-fns functionality
const isBefore = (date: Date, dateToCompare: Date): boolean => {
  return date.getTime() < dateToCompare.getTime();
};

const setHours = (date: Date, hours: number): Date => {
  const newDate = new Date(date);
  newDate.setHours(hours);
  return newDate;
};

const setMinutes = (date: Date, minutes: number): Date => {
  const newDate = new Date(date);
  newDate.setMinutes(minutes);
  return newDate;
};

const SAST_TIMEZONE = 'Africa/Johannesburg';

/**
 * **PHASE 1: PRODUCTION SCHEDULER - TIME ZONE FOUNDATION**
 * Centralized timezone utilities for SAST (South African Standard Time)
 * CRITICAL: All scheduling and display logic MUST use these functions
 * 
 * VALIDATION RULES:
 * 1. NO scheduling in the past (current SAST time validation)
 * 2. ONLY business hours: 8 AM - 5:30 PM SAST
 * 3. ONLY working days (Monday-Friday, no weekends/holidays)
 * 4. ALL times stored in UTC, displayed in SAST
 */

/**
 * Convert UTC date to SAST timezone
 * CRITICAL: This is the ONLY way to convert UTC to display time
 */
export function toSAST(utcDate: Date): Date {
  if (!utcDate || isNaN(utcDate.getTime())) {
    throw new Error('Invalid UTC date provided to toSAST');
  }
  return toZonedTime(utcDate, SAST_TIMEZONE);
}

/**
 * Convert SAST date to UTC for database storage
 * CRITICAL: This is the ONLY way to convert SAST to storage time
 */
export function fromSAST(sastDate: Date): Date {
  if (!sastDate || isNaN(sastDate.getTime())) {
    throw new Error('Invalid SAST date provided to fromSAST');
  }
  return fromZonedTime(sastDate, SAST_TIMEZONE);
}

/**
 * Get current time in SAST timezone
 * CRITICAL: This is the authoritative "now" for all scheduling decisions
 */
export function getCurrentSAST(): Date {
  return toZonedTime(new Date(), SAST_TIMEZONE);
}

/**
 * Format date in SAST timezone
 * CRITICAL: All UI display MUST use this function
 */
export function formatSAST(date: Date, format: string = 'yyyy-MM-dd HH:mm:ss'): string {
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  return formatInTimeZone(date, SAST_TIMEZONE, format);
}

/**
 * **BUSINESS LOGIC VALIDATION: Create SAST date with business rules**
 * CRITICAL: This function enforces business hour constraints
 */
export function createSASTDate(dateStr: string, timeStr: string): Date {
  if (!dateStr || !timeStr) {
    throw new Error('Date string and time string are required');
  }
  
  // Parse the date and time string in SAST timezone
  const sastDateTimeStr = `${dateStr}T${timeStr}`;
  const sastDate = toZonedTime(new Date(sastDateTimeStr), SAST_TIMEZONE);
  
  // VALIDATION: Check if time is within business hours
  const hours = sastDate.getHours();
  const minutes = sastDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  
  // Business hours: 8:00 AM (480 min) to 5:30 PM (1050 min) SAST
  const startMinutes = 8 * 60; // 8:00 AM = 480 minutes
  const endMinutes = 17 * 60 + 30; // 5:30 PM = 1050 minutes
  
  if (totalMinutes < startMinutes || totalMinutes > endMinutes) {
    throw new Error(`Time ${timeStr} is outside business hours (8:00 AM - 5:30 PM SAST)`);
  }
  
  // VALIDATION: Check if it's a working day (Monday-Friday)
  if (isWeekend(sastDate)) {
    throw new Error(`Date ${dateStr} falls on a weekend. Only working days (Monday-Friday) are allowed.`);
  }
  
  return sastDate;
}

/**
 * **CRITICAL VALIDATION: Check if time is in the past**
 */
export function isInPast(sastTime: Date): boolean {
  const nowSAST = getCurrentSAST();
  return isBefore(sastTime, nowSAST);
}

/**
 * **CRITICAL VALIDATION: Check if time is within business hours**
 * Business hours: 8:00 AM - 5:30 PM SAST
 */
export function isWithinBusinessHours(sastTime: Date): boolean {
  if (!sastTime || isNaN(sastTime.getTime())) {
    return false;
  }
  
  const hours = sastTime.getHours();
  const minutes = sastTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  
  // Business hours: 8:00 AM (480 min) to 5:30 PM (1050 min) SAST
  const startMinutes = 8 * 60; // 8:00 AM
  const endMinutes = 17 * 60 + 30; // 5:30 PM
  
  return totalMinutes >= startMinutes && totalMinutes <= endMinutes;
}

/**
 * **CRITICAL VALIDATION: Check if date is a working day**
 */
export function isWorkingDay(sastDate: Date): boolean {
  if (!sastDate || isNaN(sastDate.getTime())) {
    return false;
  }
  
  // Check for weekend
  if (isWeekend(sastDate)) {
    return false;
  }
  
  // TODO: Add public holiday check when implemented
  
  return true;
}

/**
 * **BUSINESS LOGIC: Get next valid business time**
 * If proposed time is invalid, move to next valid business time
 */
export function getNextValidBusinessTime(proposedSastTime: Date): Date {
  let adjustedTime = new Date(proposedSastTime);
  
  // If in the past, move to current time
  const nowSAST = getCurrentSAST();
  if (isBefore(adjustedTime, nowSAST)) {
    adjustedTime = new Date(nowSAST);
  }
  
  // If outside business hours, move to next business day 8 AM
  if (!isWithinBusinessHours(adjustedTime) || !isWorkingDay(adjustedTime)) {
    // Move to next working day at 8:00 AM
    adjustedTime = getNextWorkingDayStart(adjustedTime);
  }
  
  return adjustedTime;
}

/**
 * **BUSINESS LOGIC: Get next working day start time (8:00 AM)**
 */
export function getNextWorkingDayStart(fromSastDate: Date): Date {
  let nextDate = new Date(fromSastDate);
  
  // Move to next day
  nextDate = addDays(nextDate, 1);
  
  // Skip weekends
  while (isWeekend(nextDate)) {
    nextDate = addDays(nextDate, 1);
  }
  
  // Set to 8:00 AM SAST
  const dateStr = formatSAST(nextDate, 'yyyy-MM-dd');
  return createSASTDate(dateStr, '08:00:00');
}

/**
 * **LEGACY SUPPORT: Get today at specified hour (with validation)**
 */
export function getTodayAtHour(hour: number, minute: number = 0): Date {
  const nowSAST = getCurrentSAST();
  const dateStr = formatSAST(nowSAST, 'yyyy-MM-dd');
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
  
  try {
    const proposedTime = createSASTDate(dateStr, timeStr);
    return getNextValidBusinessTime(proposedTime);
  } catch {
    // If today at specified hour is invalid, get next valid business time
    return getNextWorkingDayStart(nowSAST);
  }
}

/**
 * **LEGACY SUPPORT: Get tomorrow at 8:00 AM**
 */
export function getTomorrowAt8AM(): Date {
  const nowSAST = getCurrentSAST();
  return getNextWorkingDayStart(nowSAST);
}

/**
 * **STORAGE LAYER: Convert database UTC timestamp to SAST for display**
 * CRITICAL: This is the ONLY way to convert stored UTC to display SAST
 */
export function dbTimeToSAST(dbTimestamp: string): Date {
  if (!dbTimestamp) {
    throw new Error('Database timestamp is required');
  }
  
  const utcDate = new Date(dbTimestamp);
  if (isNaN(utcDate.getTime())) {
    throw new Error(`Invalid database timestamp: ${dbTimestamp}`);
  }
  
  return toSAST(utcDate);
}

/**
 * **STORAGE LAYER: Convert SAST time to UTC ISO string for database storage**
 * CRITICAL: This is the ONLY way to convert SAST to storage UTC
 */
export function sastToDbTime(sastDate: Date): string {
  if (!sastDate || isNaN(sastDate.getTime())) {
    throw new Error('Valid SAST date is required');
  }
  
  return fromSAST(sastDate).toISOString();
}

/**
 * **VALIDATION LAYER: Validate and normalize scheduling time**
 * CRITICAL: All scheduling operations MUST use this function
 */
export function validateAndNormalizeSchedulingTime(inputTime: Date | string): Date {
  let sastTime: Date;
  
  // Convert input to SAST Date
  if (typeof inputTime === 'string') {
    sastTime = dbTimeToSAST(inputTime);
  } else {
    sastTime = new Date(inputTime);
  }
  
  // Validate the time
  if (isInPast(sastTime)) {
    throw new Error(`Cannot schedule in the past. Time: ${formatSAST(sastTime)} is before current SAST time: ${formatSAST(getCurrentSAST())}`);
  }
  
  if (!isWithinBusinessHours(sastTime)) {
    throw new Error(`Time ${formatSAST(sastTime, 'HH:mm')} is outside business hours (8:00 AM - 5:30 PM SAST)`);
  }
  
  if (!isWorkingDay(sastTime)) {
    throw new Error(`Date ${formatSAST(sastTime, 'yyyy-MM-dd')} is not a working day`);
  }
  
  return sastTime;
}