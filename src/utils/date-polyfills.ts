/**
 * Date polyfills for missing date-fns functions
 * Provides compatibility layer for date operations
 */

// Missing functions that need to be implemented
export const isPast = (date: Date): boolean => {
  return date.getTime() < new Date().getTime();
};

export const isBefore = (date: Date, dateToCompare: Date): boolean => {
  return date.getTime() < dateToCompare.getTime();
};

export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export const endOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

export const endOfWeek = (date: Date): Date => {
  const newDate = new Date(date);
  const diff = 6 - newDate.getDay(); // Saturday
  newDate.setDate(newDate.getDate() + diff);
  return endOfDay(newDate);
};

export const formatDistanceToNow = (date: Date, options?: { addSuffix?: boolean }): string => {
  const now = new Date();
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  let result = '';
  const isInFuture = date.getTime() > now.getTime();

  if (diffDays > 0) {
    result = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    result = `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else if (diffMinutes > 0) {
    result = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  } else {
    result = 'less than a minute';
  }

  if (options?.addSuffix) {
    return isInFuture ? `in ${result}` : `${result} ago`;
  }
  
  return result;
};