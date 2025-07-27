/**
 * Utility functions for calculating realistic working days and schedules
 */

export interface WorkingDayCapacity {
  dailyCapacityHours: number;
  shiftHoursPerDay: number;
  efficiencyFactor: number;
  workingDaysPerWeek: number;
}

export interface WorkingDayBreakdown {
  totalMinutes: number;
  totalHours: number;
  workingDays: number;
  workingHours: number;
  displayText: string;
  tooltipText: string;
}

// Default capacity profile if stage-specific data isn't available
const DEFAULT_CAPACITY: WorkingDayCapacity = {
  dailyCapacityHours: 8,
  shiftHoursPerDay: 8,
  efficiencyFactor: 0.85,
  workingDaysPerWeek: 5
};

/**
 * Calculate working days based on raw minutes and capacity profile
 */
export function calculateWorkingDays(
  totalMinutes: number,
  capacity: WorkingDayCapacity = DEFAULT_CAPACITY
): WorkingDayBreakdown {
  if (totalMinutes <= 0) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      workingDays: 0,
      workingHours: 0,
      displayText: "0m",
      tooltipText: "No time required"
    };
  }

  const totalHours = totalMinutes / 60;
  const effectiveHoursPerDay = capacity.shiftHoursPerDay * capacity.efficiencyFactor;
  const workingDays = Math.ceil(totalHours / effectiveHoursPerDay);
  const workingHours = totalHours;

  // Format display text based on magnitude
  let displayText: string;
  let tooltipText: string;

  if (workingDays <= 1) {
    // Less than or equal to 1 working day - show in hours/minutes
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (hours === 0) {
      displayText = `${mins}m`;
    } else if (mins === 0) {
      displayText = `${hours}h`;
    } else {
      displayText = `${hours}h ${mins}m`;
    }
    
    tooltipText = `${totalHours.toFixed(1)} hours of work (within 1 working day)`;
  } else {
    // More than 1 working day - show in working days with hours in parentheses
    const hours = Math.floor(totalMinutes / 60);
    displayText = `${workingDays} working day${workingDays > 1 ? 's' : ''} (${hours}h)`;
    
    tooltipText = `${hours} hours of work spread across ${workingDays} working days (${effectiveHoursPerDay.toFixed(1)}h effective/day at ${Math.round(capacity.efficiencyFactor * 100)}% efficiency)`;
  }

  return {
    totalMinutes,
    totalHours,
    workingDays,
    workingHours,
    displayText,
    tooltipText
  };
}

/**
 * Enhanced time display that shows working days for longer durations
 */
export function formatWorkingTimeDisplay(
  minutes: number,
  capacity?: WorkingDayCapacity
): WorkingDayBreakdown {
  return calculateWorkingDays(minutes, capacity);
}

/**
 * Calculate total working time for multiple items
 */
export function calculateTotalWorkingTime(
  items: any[],
  capacity?: WorkingDayCapacity
): WorkingDayBreakdown {
  const totalMinutes = items.reduce((total, item) => {
    const duration = item?.estimated_duration_minutes || 0;
    return total + duration;
  }, 0);

  return formatWorkingTimeDisplay(totalMinutes, capacity);
}

/**
 * Get estimated working schedule for a job or stage
 */
export function getWorkingSchedule(
  item: any,
  capacity?: WorkingDayCapacity
): WorkingDayBreakdown {
  const minutes = item?.estimated_duration_minutes || 0;
  return formatWorkingTimeDisplay(minutes, capacity);
}

/**
 * Add working days to a date (excluding weekends and holidays)
 */
export function addWorkingDays(startDate: Date, workingDaysToAdd: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < workingDaysToAdd) {
    result.setDate(result.getDate() + 1);
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      daysAdded++;
    }
  }
  
  return result;
}