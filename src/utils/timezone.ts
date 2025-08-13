import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

const SAST_TIMEZONE = 'Africa/Johannesburg';

/**
 * Centralized timezone utilities for SAST (South African Standard Time)
 * All scheduling and display logic should use these functions
 */

/**
 * Convert UTC date to SAST timezone
 */
export function toSAST(utcDate: Date): Date {
  return toZonedTime(utcDate, SAST_TIMEZONE);
}

/**
 * Convert SAST date to UTC for database storage
 */
export function fromSAST(sastDate: Date): Date {
  return fromZonedTime(sastDate, SAST_TIMEZONE);
}

/**
 * Get current time in SAST timezone
 */
export function getCurrentSAST(): Date {
  return toZonedTime(new Date(), SAST_TIMEZONE);
}

/**
 * Format date in SAST timezone
 */
export function formatSAST(date: Date, format: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return formatInTimeZone(date, SAST_TIMEZONE, format);
}

/**
 * Get tomorrow at 8:00 AM SAST (properly calculated in SAST timezone)
 */
export function getTomorrowAt8AM(): Date {
  const nowSAST = getCurrentSAST();
  const tomorrow = addDays(nowSAST, 1);
  
  // Create a proper SAST date for tomorrow at 8:00 AM
  const tomorrowDateStr = tomorrow.toISOString().split('T')[0];
  const tomorrowAt8AM = createSASTDate(tomorrowDateStr, '08:00:00');
  
  return tomorrowAt8AM;
}

/**
 * Get today at specified hour in SAST
 */
export function getTodayAtHour(hour: number, minute: number = 0): Date {
  const nowSAST = getCurrentSAST();
  return setMilliseconds(
    setSeconds(
      setMinutes(
        setHours(nowSAST, hour), 
        minute
      ), 
      0
    ), 
    0
  );
}

/**
 * Check if a SAST time is within working hours (properly using SAST timezone)
 */
export function isWithinWorkingHours(sastTime: Date, startHour: number = 8, endHour: number = 17): boolean {
  // Format the SAST time to get proper SAST hour/minute values
  const sastTimeStr = formatSAST(sastTime, 'HH:mm');
  const [hours, minutes] = sastTimeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  return totalMinutes >= startHour * 60 && totalMinutes < endHour * 60;
}

/**
 * Create a SAST date from date string and time components (properly in SAST timezone)
 */
export function createSASTDate(dateStr: string, timeStr: string): Date {
  // Parse the date and time string, treating it as SAST timezone
  const sastDateTimeStr = `${dateStr}T${timeStr}`;
  
  // Create a temporary UTC date, then interpret it as SAST
  const tempDate = new Date(sastDateTimeStr);
  
  // Convert to proper SAST timezone
  return toZonedTime(tempDate, SAST_TIMEZONE);
}

/**
 * Convert database UTC timestamp to SAST for display
 */
export function dbTimeToSAST(dbTimestamp: string): Date {
  const utcDate = new Date(dbTimestamp);
  return toSAST(utcDate);
}

/**
 * Convert SAST time to UTC ISO string for database storage
 */
export function sastToDbTime(sastDate: Date): string {
  return fromSAST(sastDate).toISOString();
}