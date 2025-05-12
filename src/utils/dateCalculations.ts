
import { isAfter, addDays, differenceInDays } from "date-fns";
import { ProductConfig } from "@/config/productTypes";

// Define UrgencyLevel type to be used across the application
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Calculate job urgency based on due date and SLA
 */
export const calculateJobUrgency = (dueDate: string, config?: ProductConfig): UrgencyLevel => {
  const today = new Date();
  const dueDateObj = new Date(dueDate);
  
  // Get target SLA days from config or default to 3
  const slaTargetDays = config?.slaTargetDays || 3;
  
  // Critical: Due today or past due
  if (isAfter(today, dueDateObj) || isSameDay(today, dueDateObj)) {
    return 'critical';
  }
  
  // High urgency (previously "urgent"): Due within SLA period
  if (isAfter(dueDateObj, today) && isAfter(addDays(today, slaTargetDays), dueDateObj)) {
    return 'high';
  }

  // Medium urgency: Due within 2x the SLA period
  if (isAfter(dueDateObj, today) && isAfter(addDays(today, slaTargetDays * 2), dueDateObj)) {
    return 'medium';
  }
  
  // Low urgency (previously "normal"): Due beyond 2x SLA period
  return 'low';
};

/**
 * Get CSS class for row background based on urgency
 */
export const getUrgencyBackgroundClass = (urgency: string): string => {
  switch (urgency) {
    case 'critical':
      return 'bg-red-50';
    case 'high':
      return 'bg-amber-50';
    case 'medium':
      return 'bg-yellow-50';
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
    case 'high':
      return 'text-amber-600';
    case 'medium':
      return 'text-yellow-600';
    default:
      return 'text-gray-600';
  }
};

/**
 * Get color class for batch urgency indicators
 */
export const getBatchUrgencyColor = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-amber-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-green-500';
  }
};

/**
 * Get icon type for batch urgency indicators
 */
export const getBatchUrgencyIcon = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case 'critical':
      return 'circle-x';
    case 'high':
      return 'circle-alert';
    case 'medium':
      return 'circle-alert';
    case 'low':
      return 'circle-check';
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
