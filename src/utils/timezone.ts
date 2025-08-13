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
 * Get tomorrow at 8:00 AM SAST
 */
export function getTomorrowAt8AM(): Date {
  const nowSAST = getCurrentSAST();
  const tomorrow = addDays(nowSAST, 1);
  const tomorrowAt8AM = setMilliseconds(
    setSeconds(
      setMinutes(
        setHours(tomorrow, 8), 
        0
      ), 
      0
    ), 
    0
  );
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
 * Check if a SAST time is within working hours
 */
export function isWithinWorkingHours(sastTime: Date, startHour: number = 8, endHour: number = 17): boolean {
  const hours = sastTime.getHours();
  const minutes = sastTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  
  return totalMinutes >= startHour * 60 && totalMinutes < endHour * 60;
}

/**
 * Create a SAST date from date string and time components
 */
export function createSASTDate(dateStr: string, timeStr: string): Date {
  // Create date in SAST timezone
  const sastDateStr = `${dateStr}T${timeStr}`;
  const date = new Date(sastDateStr);
  
  // Ensure it's treated as SAST
  return toZonedTime(date, SAST_TIMEZONE);
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