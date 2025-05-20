
import { addBusinessDays, differenceInBusinessDays, isWeekend, isPast } from "date-fns";
import { ProductConfig } from "@/config/productTypes";

// Urgency levels for job batching
export type UrgencyLevel = "critical" | "high" | "medium" | "low";

// Calculate if a date is a working day (not a weekend)
export const isWorkingDay = (date: Date): boolean => {
  return !isWeekend(date);
};

// Calculate the target date when a job should be batched based on SLA
export const getTargetBatchDate = (dueDate: string | Date, slaTargetDays: number): Date => {
  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return addBusinessDays(dueDateObj, -slaTargetDays);
};

// Calculate the urgency level based on due date and SLA
export const calculateJobUrgency = (dueDate: string, config: ProductConfig | undefined): UrgencyLevel => {
  const today = new Date();
  const dueDateObj = new Date(dueDate);
  
  // First check if the due date is in the past
  if (isPast(dueDateObj) && dueDateObj.getDate() !== today.getDate()) {
    // If the due date is already past (and not just today), this is critical urgency
    return "critical";
  }
  
  // Default to a standard SLA of 3 days if config is undefined or slaTargetDays is not set
  const slaTargetDays = config?.slaTargetDays || 3;
  
  const targetBatchDate = getTargetBatchDate(dueDateObj, slaTargetDays);
  
  // Calculate business days until target batch date
  const daysUntilTarget = differenceInBusinessDays(targetBatchDate, today);
  
  if (daysUntilTarget < 0) {
    // Past the target date - critical urgency
    return "critical";
  } else if (daysUntilTarget === 0) {
    // Today is the target date - high urgency
    return "high";
  } else if (daysUntilTarget <= 1) {
    // Within 1 business day of target - medium urgency
    return "medium";
  } else {
    // More than 1 business day until target - low urgency
    return "low";
  }
};

// Get background color class based on urgency level
export const getUrgencyBackgroundClass = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case "critical":
      return "bg-red-50 border-l-4 border-red-500";
    case "high":
      return "bg-amber-50 border-l-4 border-amber-500";
    case "medium":
      return "bg-yellow-50 border-l-4 border-yellow-300";
    case "low":
      return "bg-emerald-50 border-l-4 border-emerald-500";
    default:
      return "";
  }
};

// Get text to display for urgency level
export const getUrgencyText = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case "critical":
      return "Overdue - Batch Immediately";
    case "high":
      return "Urgent - Batch Today";
    case "medium":
      return "Important - Batch Soon";
    case "low":
      return "On Track";
    default:
      return "";
  }
};

// Calculate batch urgency based on most urgent job's due date
export const calculateBatchUrgency = (dueDates: string[], config: ProductConfig): UrgencyLevel => {
  if (!dueDates.length) {
    return "low";
  }
  
  // Calculate urgency for each due date
  const urgencies = dueDates.map(date => calculateJobUrgency(date, config));
  
  // Return the highest urgency level
  if (urgencies.includes("critical")) return "critical";
  if (urgencies.includes("high")) return "high";
  if (urgencies.includes("medium")) return "medium";
  return "low";
};

// Get color for the batch urgency indicator
export const getBatchUrgencyColor = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case "critical":
      return "text-red-500";
    case "high":
      return "text-amber-500";
    case "medium":
      return "text-yellow-500";
    case "low":
      return "text-emerald-500";
    default:
      return "text-gray-500";
  }
};

// Get icon for the batch urgency indicator
export const getBatchUrgencyIcon = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case "critical":
      return "circle-x";
    case "high":
      return "circle-alert";
    case "medium":
      return "circle-alert";
    case "low":
      return "circle-check";
    default:
      return "circle";
  }
};
