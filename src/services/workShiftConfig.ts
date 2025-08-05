import { supabase } from "@/integrations/supabase/client";

export interface WorkShiftConfig {
  workingDaysPerWeek: number;
  shiftStartHour: number; // 24-hour format (e.g., 8 for 8:00 AM)
  shiftEndHour: number; // 24-hour format (e.g., 16.5 for 4:30 PM)
  shiftHoursPerDay: number;
  lunchBreakMinutes: number;
  efficiencyFactor: number; // 0.0 to 1.0, typically 0.85
}

export const DEFAULT_SHIFT_CONFIG: WorkShiftConfig = {
  workingDaysPerWeek: 5, // Monday to Friday
  shiftStartHour: 8, // 8:00 AM
  shiftEndHour: 16.5, // 4:30 PM
  shiftHoursPerDay: 8.5, // 8.5 hours total
  lunchBreakMinutes: 30,
  efficiencyFactor: 0.85 // 85% efficiency
};

export class WorkShiftConfigService {
  private static cachedConfig: WorkShiftConfig | null = null;

  /**
   * Get current work shift configuration
   */
  static async getShiftConfig(): Promise<WorkShiftConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    try {
      // Try to get from database - extend app_settings table in the future
      // For now, return default configuration
      this.cachedConfig = DEFAULT_SHIFT_CONFIG;
      return this.cachedConfig;
    } catch (error) {
      console.error('Error loading shift config, using defaults:', error);
      return DEFAULT_SHIFT_CONFIG;
    }
  }

  /**
   * Update work shift configuration (admin only)
   */
  static async updateShiftConfig(config: Partial<WorkShiftConfig>): Promise<void> {
    try {
      // Update the cached config
      this.cachedConfig = {
        ...DEFAULT_SHIFT_CONFIG,
        ...config
      };

      // TODO: Persist to database when app_settings table is extended
      console.log('Shift config updated:', this.cachedConfig);
    } catch (error) {
      console.error('Error updating shift config:', error);
      throw error;
    }
  }

  /**
   * Calculate effective daily capacity hours
   */
  static async getEffectiveDailyCapacity(): Promise<number> {
    const config = await this.getShiftConfig();
    const grossHours = config.shiftHoursPerDay;
    const lunchHours = config.lunchBreakMinutes / 60;
    const netHours = grossHours - lunchHours;
    return netHours * config.efficiencyFactor;
  }

  /**
   * Check if a given date/time falls within working hours
   */
  static async isWorkingTime(date: Date): Promise<boolean> {
    const config = await this.getShiftConfig();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Check if it's a working day (Monday = 1, Friday = 5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false; // Weekend
    }

    const hours = date.getHours() + (date.getMinutes() / 60);
    return hours >= config.shiftStartHour && hours <= config.shiftEndHour;
  }

  /**
   * Get next working time slot
   */
  static async getNextWorkingSlot(fromDate: Date): Promise<Date> {
    const config = await this.getShiftConfig();
    const nextSlot = new Date(fromDate);
    
    // Move to next working day if needed
    while (nextSlot.getDay() === 0 || nextSlot.getDay() === 6) {
      nextSlot.setDate(nextSlot.getDate() + 1);
    }
    
    // Set to start of shift
    nextSlot.setHours(config.shiftStartHour, 0, 0, 0);
    
    return nextSlot;
  }

  /**
   * Calculate working minutes between two dates
   */
  static async calculateWorkingMinutes(startDate: Date, endDate: Date): Promise<number> {
    const config = await this.getShiftConfig();
    let totalMinutes = 0;
    const current = new Date(startDate);
    
    while (current < endDate) {
      if (await this.isWorkingTime(current)) {
        totalMinutes += 1;
      }
      current.setMinutes(current.getMinutes() + 1);
    }
    
    return totalMinutes;
  }

  /**
   * Clear cached configuration (for testing or admin updates)
   */
  static clearCache(): void {
    this.cachedConfig = null;
  }
}