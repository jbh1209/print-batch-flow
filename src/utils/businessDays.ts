import { addDays, format, isWeekend } from 'date-fns';

export const isBusinessDay = (date: Date): boolean => {
  return !isWeekend(date);
};

export const getNextBusinessDay = (date: Date = new Date()): Date => {
  let nextDay = addDays(date, 1);
  while (!isBusinessDay(nextDay)) {
    nextDay = addDays(nextDay, 1);
  }
  return nextDay;
};

export const getBusinessWeekDates = (referenceDate: Date): Date[] => {
  const dates: Date[] = [];
  const monday = getWeekStartMonday(referenceDate);
  
  // Get Monday through Friday
  for (let i = 0; i < 5; i++) {
    dates.push(addDays(monday, i));
  }
  
  return dates;
};

export const getWeekStartMonday = (date: Date): Date => {
  const dayOfWeek = date.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday as well
  return addDays(date, daysToMonday);
};

export const formatDateKey = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const getCurrentDate = (): string => {
  return format(new Date(), 'yyyy-MM-dd');
};