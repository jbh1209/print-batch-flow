import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addDays, startOfDay } from 'date-fns';
import { createSASTDate, formatSAST, toSAST, fromSAST } from './timezone';

const SAST_TIMEZONE = 'Africa/Johannesburg';

/**
 * Get working hours for a specific date in SAST timezone
 * Returns start and end times for that day
 */
export function getSASTWorkingHours(date: Date, startHour: number = 8, endHour: number = 17): {
  start: Date;
  end: Date;
  isWorkingDay: boolean;
} {
  const dateStr = formatSAST(date, 'yyyy-MM-dd');
  const dayOfWeek = toZonedTime(date, SAST_TIMEZONE).getDay();
  
  // Check if it's a working day (Monday-Friday, 1-5)
  const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  const start = createSASTDate(dateStr, `${startHour.toString().padStart(2, '0')}:00:00`);
  const end = createSASTDate(dateStr, `${endHour.toString().padStart(2, '0')}:30:00`); // 17:30 end
  
  return {
    start,
    end,
    isWorkingDay
  };
}

/**
 * Check if a SAST date/time falls within working hours
 */
export function isDateInSASTWorkingHours(sastDateTime: Date, startHour: number = 8, endHour: number = 17): boolean {
  const workingHours = getSASTWorkingHours(sastDateTime, startHour, endHour);
  
  if (!workingHours.isWorkingDay) {
    return false;
  }
  
  return sastDateTime >= workingHours.start && sastDateTime <= workingHours.end;
}

/**
 * Get the next working day start time in SAST
 */
export function getNextSASTWorkingDayStart(fromDate: Date, startHour: number = 8): Date {
  let nextDate = addDays(startOfDay(toZonedTime(fromDate, SAST_TIMEZONE)), 1);
  
  // Skip weekends
  while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
    nextDate = addDays(nextDate, 1);
  }
  
  const dateStr = formatInTimeZone(nextDate, SAST_TIMEZONE, 'yyyy-MM-dd');
  return createSASTDate(dateStr, `${startHour.toString().padStart(2, '0')}:00:00`);
}

/**
 * Ensure a proposed time falls within SAST working hours
 * If not, move it to the start of the next working day
 */
export function ensureSASTWorkingHours(proposedTime: Date, startHour: number = 8): Date {
  if (isDateInSASTWorkingHours(proposedTime, startHour)) {
    return proposedTime;
  }
  
  // If outside working hours, move to next working day
  return getNextSASTWorkingDayStart(proposedTime, startHour);
}