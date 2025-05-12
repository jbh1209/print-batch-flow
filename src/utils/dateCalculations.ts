
import { isAfter, addDays, differenceInDays } from "date-fns";
import { ProductConfig } from "@/config/productTypes";

/**
 * Calculate job urgency based on due date and SLA
 */
export const calculateJobUrgency = (dueDate: string, config?: ProductConfig): 'critical' | 'urgent' | 'normal' => {
  const today = new Date();
  const dueDateObj = new Date(dueDate);
  
  // Get target SLA days from config or default to 3
  const slaTargetDays = config?.slaTargetDays || 3;
  
  // Critical: Due today or past due
  if (isAfter(today, dueDateObj) || isSameDay(today, dueDateObj)) {
    return 'critical';
  }
  
  // Urgent: Due within SLA period
  if (isAfter(dueDateObj, today) && isAfter(addDays(today, slaTargetDays), dueDateObj)) {
    return 'urgent';
  }
  
  // Normal: Due beyond SLA period
  return 'normal';
};

/**
 * Get CSS class for row background based on urgency
 */
export const getUrgencyBackgroundClass = (urgency: string): string => {
  switch (urgency) {
    case 'critical':
      return 'bg-red-50';
    case 'urgent':
      return 'bg-amber-50';
    default:
      return '';
  }
};

/**
 * Get CSS class for text color based on urgency
 */
export const getUrgencyTextClass = (urgency: string): string => {
  switch (urgency) {
    case 'critical':
      return 'text-red-600';
    case 'urgent':
      return 'text-amber-600';
    default:
      return 'text-gray-600';
  }
};

/**
 * Check if two dates are the same day
 */
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};
