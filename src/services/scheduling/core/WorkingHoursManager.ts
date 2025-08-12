import { supabase } from "@/integrations/supabase/client";

export interface WorkingHoursConfig {
  workStartHour: number;
  workEndHour: number;
  workEndMinute: number;
  dailyWorkingMinutes: number;
}

export interface TimeSlot {
  date: string; // YYYY-MM-DD format
  startTime: Date;
  endTime: Date;
  availableMinutes: number;
}

export class WorkingHoursManager {
  private config: WorkingHoursConfig | null = null;

  /**
   * Get working hours configuration from app_settings
   */
  async getWorkingHoursConfig(): Promise<WorkingHoursConfig> {
    if (this.config) return this.config;

    const { data: settings } = await supabase
      .from('app_settings')
      .select('setting_type, sla_target_days')
      .in('setting_type', ['working_hours', 'working_hours_end', 'working_hours_end_minute']);

    const workStartHour = settings?.find(s => s.setting_type === 'working_hours')?.sla_target_days || 8;
    const workEndHour = settings?.find(s => s.setting_type === 'working_hours_end')?.sla_target_days || 16;
    const workEndMinute = settings?.find(s => s.setting_type === 'working_hours_end_minute')?.sla_target_days || 30;

    const dailyWorkingMinutes = (workEndHour - workStartHour) * 60 + workEndMinute;

    this.config = {
      workStartHour,
      workEndHour,
      workEndMinute,
      dailyWorkingMinutes
    };

    return this.config;
  }

  /**
   * Check if a date is a working day (not weekend or holiday)
   */
  async isWorkingDay(date: Date): Promise<boolean> {
    // Check if weekend
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    // Check if holiday
    const dateStr = date.toISOString().split('T')[0];
    const { data: holiday } = await supabase
      .from('public_holidays')
      .select('id')
      .eq('date', dateStr)
      .eq('is_active', true)
      .maybeSingle();

    return !holiday;
  }

  /**
   * Get next working day from given date
   */
  async getNextWorkingDay(fromDate: Date): Promise<Date> {
    let checkDate = new Date(fromDate);
    checkDate.setDate(checkDate.getDate() + 1);

    while (!(await this.isWorkingDay(checkDate))) {
      checkDate.setDate(checkDate.getDate() + 1);
    }

    return checkDate;
  }

  /**
   * Get working time slot for a specific date
   */
  async getWorkingTimeSlot(date: Date): Promise<TimeSlot | null> {
    if (!(await this.isWorkingDay(date))) return null;

    const config = await this.getWorkingHoursConfig();
    const dateStr = date.toISOString().split('T')[0];

    const startTime = new Date(date);
    startTime.setHours(config.workStartHour, 0, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(config.workEndHour, config.workEndMinute, 0, 0);

    return {
      date: dateStr,
      startTime,
      endTime,
      availableMinutes: config.dailyWorkingMinutes
    };
  }

  /**
   * Calculate remaining working minutes from current time on given date
   */
  async getRemainingWorkingMinutes(fromTime: Date): Promise<number> {
    const config = await this.getWorkingHoursConfig();
    const timeSlot = await this.getWorkingTimeSlot(fromTime);
    
    if (!timeSlot) return 0;

    const now = new Date(fromTime);
    const workEndTime = timeSlot.endTime;

    if (now >= workEndTime) return 0;
    if (now < timeSlot.startTime) return config.dailyWorkingMinutes;

    return Math.floor((workEndTime.getTime() - now.getTime()) / (1000 * 60));
  }

  /**
   * Check if a duration fits within remaining working hours
   */
  async fitsInWorkingDay(startTime: Date, durationMinutes: number): Promise<boolean> {
    const remainingMinutes = await this.getRemainingWorkingMinutes(startTime);
    return durationMinutes <= remainingMinutes;
  }

  /**
   * Get the start of working day for a date
   */
  async getWorkingDayStart(date: Date): Promise<Date> {
    const config = await this.getWorkingHoursConfig();
    const workStart = new Date(date);
    workStart.setHours(config.workStartHour, 0, 0, 0);
    return workStart;
  }

  /**
   * Get the end of working day for a date  
   */
  async getWorkingDayEnd(date: Date): Promise<Date> {
    const config = await this.getWorkingHoursConfig();
    const workEnd = new Date(date);
    workEnd.setHours(config.workEndHour, config.workEndMinute, 0, 0);
    return workEnd;
  }
}

export const workingHoursManager = new WorkingHoursManager();