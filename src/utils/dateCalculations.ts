
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
export const calculateJobUrgency = (dueDate: string, config: ProductConfig): UrgencyLevel => {
  const today = new Date();
  const dueDateObj = new Date(dueDate);
  
  // First check if the due date is in the past
  if (isPast(dueDateObj)) {
    // If the due date is already past, this is critical urgency
    return "critical";
  }
  
  const targetBatchDate = getTargetBatchDate(dueDateObj, config.slaTargetDays);
  
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
