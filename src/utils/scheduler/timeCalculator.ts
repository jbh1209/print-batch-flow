/**
 * Time calculation utilities for production scheduling
 */

import { WorkingDayCapacity, TimeSlot } from './types';

export const DEFAULT_CAPACITY: WorkingDayCapacity = {
  daily_capacity_minutes: 450, // 8:00-16:30 minus 30min lunch = 450 minutes
  shift_start_hour: 8,
  shift_end_hour: 16.5, // 16:30
  lunch_break_start_hour: 13,
  lunch_break_duration_minutes: 30
};

/**
 * Calculate available time slots for a working day, accounting for lunch break
 */
export function calculateDayTimeSlots(date: Date, capacity: WorkingDayCapacity = DEFAULT_CAPACITY): TimeSlot[] {
  const morningStart = new Date(date);
  morningStart.setHours(capacity.shift_start_hour, 0, 0, 0);
  
  const lunchStart = new Date(date);
  lunchStart.setHours(capacity.lunch_break_start_hour, 0, 0, 0);
  
  const lunchEnd = new Date(lunchStart);
  lunchEnd.setMinutes(lunchEnd.getMinutes() + capacity.lunch_break_duration_minutes);
  
  const dayEnd = new Date(date);
  const endHour = Math.floor(capacity.shift_end_hour);
  const endMinutes = (capacity.shift_end_hour - endHour) * 60;
  dayEnd.setHours(endHour, endMinutes, 0, 0);
  
  return [
    // Morning slot: 8:00 - 13:00
    {
      start: morningStart,
      end: lunchStart,
      duration_minutes: (lunchStart.getTime() - morningStart.getTime()) / 60000
    },
    // Afternoon slot: 13:30 - 16:30
    {
      start: lunchEnd,
      end: dayEnd,
      duration_minutes: (dayEnd.getTime() - lunchEnd.getTime()) / 60000
    }
  ];
}

/**
 * Calculate exact start and end times for a stage, given available time slots
 */
export function calculateStageTimeSlot(
  timeSlots: TimeSlot[],
  usedMinutes: number,
  stageDurationMinutes: number
): { start: Date; end: Date } | null {
  let remainingDuration = stageDurationMinutes;
  let currentUsed = usedMinutes;
  let stageStart: Date | null = null;
  let stageEnd: Date | null = null;
  
  for (const slot of timeSlots) {
    const slotUsed = Math.min(currentUsed, slot.duration_minutes);
    const slotAvailable = slot.duration_minutes - slotUsed;
    
    if (slotAvailable > 0 && remainingDuration > 0) {
      // Calculate start time within this slot
      const slotStartTime = new Date(slot.start);
      slotStartTime.setMinutes(slotStartTime.getMinutes() + slotUsed);
      
      if (!stageStart) {
        stageStart = slotStartTime;
      }
      
      // Calculate how much of this stage fits in this slot
      const timeInThisSlot = Math.min(remainingDuration, slotAvailable);
      
      // Calculate end time for this portion
      const slotEndTime = new Date(slotStartTime);
      slotEndTime.setMinutes(slotEndTime.getMinutes() + timeInThisSlot);
      
      stageEnd = slotEndTime;
      remainingDuration -= timeInThisSlot;
      
      if (remainingDuration <= 0) {
        break;
      }
    }
    
    // Update currentUsed for next slot
    currentUsed = Math.max(0, currentUsed - slot.duration_minutes);
  }
  
  if (stageStart && stageEnd && remainingDuration <= 0) {
    return { start: stageStart, end: stageEnd };
  }
  
  return null;
}

/**
 * Format time as HH:MM string
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Format date as YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}