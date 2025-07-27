/**
 * Utility functions for calculating and formatting stage timing information
 */

export interface JobStageWithTiming {
  estimated_duration_minutes?: number | null;
  actual_duration_minutes?: number | null;
}

export interface AccessibleJobWithTiming {
  estimated_duration_minutes?: number | null;
  actual_duration_minutes?: number | null;
}

/**
 * Calculate total estimated time for a collection of job stages or jobs
 * Handles any object that might have timing information
 */
export function calculateTotalStageTime(
  items: any[]
): number {
  return items.reduce((total, item) => {
    const duration = item?.estimated_duration_minutes || 0;
    return total + duration;
  }, 0);
}

/**
 * Format minutes into human-readable time string
 * @param minutes - Total minutes
 * @returns Formatted string like "26h 12m" or "45m"
 */
export function formatTimeDisplay(minutes: number): string {
  if (minutes <= 0) return "0m";
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  }
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}m`;
}

/**
 * Calculate and format total time for a stage
 * @param items - Array of jobs or job stages with timing information
 * @returns Formatted time string
 */
export function calculateAndFormatStageTime(
  items: any[]
): string {
  const totalMinutes = calculateTotalStageTime(items);
  return formatTimeDisplay(totalMinutes);
}

/**
 * Get estimated duration from a job stage instance or accessible job
 */
export function getEstimatedDuration(
  item: any
): number {
  return item?.estimated_duration_minutes || 0;
}