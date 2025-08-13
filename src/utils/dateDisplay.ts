import { formatSAST, dbTimeToSAST } from './timezone';

/**
 * Display utilities for consistent date/time formatting throughout the app
 * All dates should be displayed in SAST timezone
 */

/**
 * Format database timestamp for display in SAST
 */
export function formatDbTime(dbTimestamp: string | null, format: string = 'MMM dd, yyyy HH:mm'): string {
  if (!dbTimestamp) return '';
  
  const sastDate = dbTimeToSAST(dbTimestamp);
  return formatSAST(sastDate, format);
}

/**
 * Format scheduled times for job displays
 */
export function formatScheduledTime(dbTimestamp: string | null): string {
  if (!dbTimestamp) return 'Not scheduled';
  
  return formatDbTime(dbTimestamp, 'MMM dd HH:mm');
}

/**
 * Format time only (no date) for working hours display
 */
export function formatTimeOnly(dbTimestamp: string | null): string {
  if (!dbTimestamp) return '';
  
  return formatDbTime(dbTimestamp, 'HH:mm');
}

/**
 * Format full date and time for detailed views
 */
export function formatFullDateTime(dbTimestamp: string | null): string {
  if (!dbTimestamp) return '';
  
  return formatDbTime(dbTimestamp, 'EEEE, MMMM dd, yyyy HH:mm:ss');
}

/**
 * Format relative time (e.g., "in 2 hours", "3 days ago")
 * Note: This would typically use date-fns formatDistance, but keeping simple for now
 */
export function formatRelativeTime(dbTimestamp: string | null): string {
  if (!dbTimestamp) return '';
  
  const sastDate = dbTimeToSAST(dbTimestamp);
  const now = new Date();
  const diffHours = Math.round((sastDate.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  if (diffHours < 0) {
    return `${Math.abs(diffHours)} hours ago`;
  } else if (diffHours < 24) {
    return `in ${diffHours} hours`;
  } else {
    const diffDays = Math.round(diffHours / 24);
    return diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;
  }
}