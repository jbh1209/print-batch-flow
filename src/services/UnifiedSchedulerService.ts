import { supabase } from "@/integrations/supabase/client";
import { BusinessLogicEngine } from "@/utils/scheduling/businessLogicEngine";

export interface SchedulingResult {
  success: boolean;
  message: string;
  scheduled?: number;
}

/**
 * UNIFIED SCHEDULER SERVICE - Production Ready
 * Replaces: AutoSchedulerService, manual-reschedule-stage, parallel-auto-scheduler
 * Single API for all scheduling operations
 */
export class UnifiedSchedulerService {
  /**
   * Schedule a job using unified scheduler
   */
  static async scheduleJob(jobId: string, jobTableName: string = 'production_jobs'): Promise<SchedulingResult> {
    try {
      return await BusinessLogicEngine.scheduleJob({
        jobId,
        jobTableName,
        userId: undefined
      });
    } catch (error) {
      console.error('UnifiedSchedulerService.scheduleJob error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Scheduling failed',
        scheduled: 0
      };
    }
  }

  /**
   * Schedule a job at specific time (manual override)
   */
  static async scheduleJobAtTime(
    jobId: string, 
    stageId: string, 
    targetDateTime: string,
    userId?: string,
    jobTableName: string = 'production_jobs'
  ): Promise<SchedulingResult> {
    try {
      return await BusinessLogicEngine.scheduleJob({
        jobId,
        jobTableName,
        targetDateTime,
        stageId,
        userId
      });
    } catch (error) {
      console.error('UnifiedSchedulerService.scheduleJobAtTime error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Manual scheduling failed',
        scheduled: 0
      };
    }
  }
}

// Backward compatibility alias
export const autoSchedulerService = UnifiedSchedulerService;