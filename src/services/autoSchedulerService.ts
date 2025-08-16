import { supabase } from "@/integrations/supabase/client";

export interface SchedulingResult {
  success: boolean;
  message: string;
  scheduled_slots?: number;
}

export class AutoSchedulerService {
  /**
   * **UNIFIED SCHEDULER: Production-ready scheduling service**
   * Uses new unified scheduler edge function with SAST-correct, capacity-aware logic
   */
  static async scheduleJob(jobId: string, jobTableName: string = 'production_jobs'): Promise<SchedulingResult> {
    try {
      console.log(`🚀 Triggering UNIFIED scheduler for job ${jobId}`)
      
      const { data, error } = await supabase.functions.invoke('scheduler', {
        body: {
          job_id: jobId,
          job_table_name: jobTableName,
          trigger_reason: 'unified_capacity_scheduling'
        }
      });

      if (error) {
        console.error('Unified scheduler error:', error)
        throw error;
      }

      console.log(`✅ Unified scheduler result:`, data)
      return data as SchedulingResult;
    } catch (error) {
      console.error('Unified scheduler error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unified scheduling failed'
      };
    }
  }

  /**
   * Get schedule overview for calendar display
   */
  static async getScheduleOverview(startDate: string, endDate: string) {
    try {
      const { data, error } = await supabase
        .from('stage_time_slots')
        .select(`
          *,
          production_stages(name, color),
          job_stage_instances(
            job_id,
            job_table_name
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('slot_start_time');

      if (error) {
        console.error('Error fetching schedule overview:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getScheduleOverview:', error);
      return [];
    }
  }

  /**
   * Get shift schedules (working hours)
   */
  static async getShiftSchedules() {
    try {
      const { data, error } = await supabase
        .from('shift_schedules')
        .select('*')
        .eq('is_active', true)
        .order('day_of_week');

      if (error) {
        console.error('Error fetching shift schedules:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getShiftSchedules:', error);
      return [];
    }
  }

  /**
   * Trigger nightly reconciliation manually
   */
  static async triggerNightlyReconciliation(): Promise<SchedulingResult> {
    try {
      const { data, error } = await supabase.functions.invoke('nightly-reconciliation', {
        body: {}
      });

      if (error) {
        throw error;
      }

      return data as SchedulingResult;
    } catch (error) {
      console.error('Nightly reconciliation error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const autoSchedulerService = AutoSchedulerService;