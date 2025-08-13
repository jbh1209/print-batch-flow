
import { addBusinessDays, differenceInBusinessDays, isWeekend } from "date-fns";
import { isPast } from "@/utils/date-polyfills";
import { ProductConfig } from "@/config/productTypes";
import { supabase } from "@/integrations/supabase/client";

// Urgency levels for job batching
export type UrgencyLevel = "critical" | "high" | "medium" | "low";

// Cache for public holidays to avoid repeated database calls
let holidayCache: Set<string> | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Check if a date is a public holiday
export const isPublicHoliday = async (date: Date): Promise<boolean> => {
  const dateString = date.toISOString().split('T')[0];
  
  // Check cache first
  const now = Date.now();
  if (holidayCache && now < cacheExpiry) {
    return holidayCache.has(dateString);
  }

  // Refresh cache
  try {
    const { data } = await supabase
      .from('public_holidays')
      .select('date')
      .eq('is_active', true);

    holidayCache = new Set(data?.map(h => h.date) || []);
    cacheExpiry = now + CACHE_DURATION;
    
    return holidayCache.has(dateString);
  } catch (error) {
    console.error('Error checking public holiday:', error);
    return false;
  }
};

// Calculate if a date is a working day (not a weekend or public holiday)
export const isWorkingDay = async (date: Date): Promise<boolean> => {
  if (isWeekend(date)) return false;
  return !(await isPublicHoliday(date));
};

// Add working days (excluding weekends and public holidays)
export const addWorkingDays = async (startDate: Date, daysToAdd: number): Promise<Date> => {
  let currentDate = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (await isWorkingDay(currentDate)) {
      daysAdded++;
    }
  }

  return currentDate;
};

// Calculate working days between two dates
export const getWorkingDaysBetween = async (startDate: Date, endDate: Date): Promise<number> => {
  let count = 0;
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (await isWorkingDay(currentDate)) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return count;
};

// Calculate the target date when a job should be batched based on SLA
export const getTargetBatchDate = async (dueDate: string | Date, slaTargetDays: number): Promise<Date> => {
  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  
  // Calculate backwards from due date
  let targetDate = new Date(dueDateObj);
  let daysSubtracted = 0;
  
  while (daysSubtracted < slaTargetDays) {
    targetDate.setDate(targetDate.getDate() - 1);
    if (await isWorkingDay(targetDate)) {
      daysSubtracted++;
    }
  }
  
  return targetDate;
};

// Calculate the urgency level based on due date and SLA (now async)
export const calculateJobUrgency = async (dueDate: string, config: ProductConfig | undefined): Promise<UrgencyLevel> => {
  const today = new Date();
  const dueDateObj = new Date(dueDate);
  
  // First check if the due date is in the past
  if (isPast(dueDateObj) && dueDateObj.getDate() !== today.getDate()) {
    return "critical";
  }
  
  // Default to a standard SLA of 3 days if config is undefined or slaTargetDays is not set
  const slaTargetDays = config?.slaTargetDays || 3;
  
  const targetBatchDate = await getTargetBatchDate(dueDateObj, slaTargetDays);
  
  // Calculate working days until target batch date
  const daysUntilTarget = await getWorkingDaysBetween(today, targetBatchDate);
  
  if (daysUntilTarget < 0) {
    return "critical";
  } else if (daysUntilTarget === 0) {
    return "high";
  } else if (daysUntilTarget <= 1) {
    return "medium";
  } else {
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

// Calculate batch urgency based on most urgent job's due date (now async)
export const calculateBatchUrgency = async (dueDates: string[], config: ProductConfig): Promise<UrgencyLevel> => {
  if (!dueDates.length) {
    return "low";
  }
  
  // Calculate urgency for each due date
  const urgencies = await Promise.all(
    dueDates.map(date => calculateJobUrgency(date, config))
  );
  
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
