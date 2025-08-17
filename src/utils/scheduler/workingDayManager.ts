/**
 * Working day management for production scheduling
 */

import { supabase } from "@/integrations/supabase/client";
import { WorkingDayContainer } from './types';
import { DEFAULT_CAPACITY, calculateDayTimeSlots, formatDate } from './timeCalculator';

/**
 * Check if a date is a working day (weekday and not a public holiday)
 */
export async function isWorkingDay(date: Date): Promise<boolean> {
  const dayOfWeek = date.getDay();
  
  // Weekend check (0 = Sunday, 6 = Saturday)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Check for public holidays
  const { data: holiday } = await supabase
    .from('public_holidays')
    .select('id')
    .eq('date', formatDate(date))
    .eq('is_active', true)
    .maybeSingle();
  
  return !holiday;
}

/**
 * Get the next working day starting from a given date
 */
export async function getNextWorkingDay(startDate: Date): Promise<Date> {
  let currentDate = new Date(startDate);
  
  while (true) {
    if (await isWorkingDay(currentDate)) {
      return currentDate;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

/**
 * Generate working day containers for scheduling
 */
export async function generateWorkingDays(
  startDate: Date,
  daysToGenerate: number = 30
): Promise<WorkingDayContainer[]> {
  const workingDays: WorkingDayContainer[] = [];
  let currentDate = await getNextWorkingDay(startDate);
  
  for (let i = 0; i < daysToGenerate; i++) {
    const timeSlots = calculateDayTimeSlots(currentDate, DEFAULT_CAPACITY);
    const totalCapacity = timeSlots.reduce((sum, slot) => sum + slot.duration_minutes, 0);
    
    workingDays.push({
      date: formatDate(currentDate),
      day_name: currentDate.toLocaleDateString('en-GB', { weekday: 'long' }),
      total_capacity_minutes: totalCapacity,
      used_minutes: 0,
      remaining_minutes: totalCapacity,
      scheduled_stages: []
    });
    
    // Move to next working day
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate = await getNextWorkingDay(currentDate);
  }
  
  return workingDays;
}

/**
 * Get day name from date string
 */
export function getDayName(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { weekday: 'long' });
}