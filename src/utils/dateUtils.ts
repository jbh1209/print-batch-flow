
import { format, formatDistance, formatRelative, isValid } from 'date-fns';

/**
 * Format a date string to a readable format
 * @param dateString The date string to format
 * @param formatStrOrOptions Optional format string or Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(dateString: string, formatStrOrOptions?: string | Intl.DateTimeFormatOptions): string {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) {
      return 'Invalid date';
    }
    
    if (typeof formatStrOrOptions === 'undefined') {
      // Default format
      return format(date, 'MMM dd, yyyy');
    } else if (typeof formatStrOrOptions === 'string') {
      return format(date, formatStrOrOptions);
    } else {
      return new Intl.DateTimeFormat('en-US', formatStrOrOptions).format(date);
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Error';
  }
}

/**
 * Format a date string as a relative time (e.g., "2 days ago", "in 3 days")
 * @param dateString The date string to format
 * @returns Relative time string
 */
export const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) {
      return 'Invalid date';
    }
    
    const now = new Date();
    
    // Check if the date is in the past
    const isPast = date < now;
    
    // Get the relative time
    const relativeTime = formatDistance(date, now, { addSuffix: true });
    
    return relativeTime;
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Error';
  }
};

/**
 * Calculate days remaining until a given date
 * @param dateString The target date string
 * @returns Number of days remaining (negative if in the past)
 */
export const getDaysRemaining = (dateString: string): number => {
  try {
    const targetDate = new Date(dateString);
    if (!isValid(targetDate)) {
      return 0;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day
    
    const timeDiff = targetDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return daysDiff;
  } catch (error) {
    console.error('Error calculating days remaining:', error);
    return 0;
  }
};

/**
 * Check if a date is overdue (in the past)
 * @param dateString The date string to check
 * @returns True if the date is in the past, false otherwise
 */
export const isOverdue = (dateString: string): boolean => {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) {
      return false;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day
    
    return date < today;
  } catch (error) {
    console.error('Error checking if date is overdue:', error);
    return false;
  }
};
