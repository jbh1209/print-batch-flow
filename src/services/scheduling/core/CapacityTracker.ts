import { supabase } from "@/integrations/supabase/client";
import { workingHoursManager } from "./WorkingHoursManager";

export interface StageCapacity {
  stageId: string;
  stageName: string;
  date: string;
  queueEndsAt: Date;
  committedHours: number;
  availableHours: number;
  queueLengthHours: number;
  pendingJobsCount: number;
  activeJobsCount: number;
}

export class CapacityTracker {
  /**
   * Get current queue end time for a stage on a specific date
   */
  async getStageQueueEndTime(stageId: string, date: Date): Promise<Date> {
    const dateStr = date.toISOString().split('T')[0];
    
    const { data: tracking } = await supabase
      .from('stage_workload_tracking')
      .select('queue_ends_at')
      .eq('production_stage_id', stageId)
      .eq('date', dateStr)
      .maybeSingle();

    if (tracking?.queue_ends_at) {
      return new Date(tracking.queue_ends_at);
    }

    // No existing queue - start at beginning of working day
    return await workingHoursManager.getWorkingDayStart(date);
  }

  /**
   * PHASE 4: Resource-specific queue management with multi-day split support
   */
  async updateStageQueueEndTime(
    stageId: string, 
    newEndTime: Date,
    durationMinutes: number,
    splitMetadata?: any
  ): Promise<void> {
    const dateStr = newEndTime.toISOString().split('T')[0];
    const config = await workingHoursManager.getWorkingHoursConfig();
    const durationHours = durationMinutes / 60;

    // PHASE 4: Handle multi-day jobs with split metadata
    if (splitMetadata && splitMetadata.totalSplits > 1) {
      // Update capacity for each day the job spans
      for (const split of splitMetadata.splits) {
        const splitDate = new Date(split.startTime).toISOString().split('T')[0];
        const splitHours = split.durationMinutes / 60;
        
        await this.updateSingleDayCapacity(stageId, splitDate, splitHours);
      }
    } else {
      // Single day job - update normally
      await this.updateSingleDayCapacity(stageId, dateStr, durationHours);
    }
  }

  /**
   * Helper method to update capacity for a single day
   */
  private async updateSingleDayCapacity(
    stageId: string,
    dateStr: string, 
    durationHours: number
  ): Promise<void> {
    const config = await workingHoursManager.getWorkingHoursConfig();
    
    // Get or create capacity record
    const { data: existing } = await supabase
      .from('stage_workload_tracking')
      .select('*')
      .eq('production_stage_id', stageId)
      .eq('date', dateStr)
      .maybeSingle();

    if (existing) {
      // Update existing record
      await supabase
        .from('stage_workload_tracking')
        .update({
          committed_hours: (existing.committed_hours || 0) + durationHours,
          queue_length_hours: (existing.queue_length_hours || 0) + durationHours,
          pending_jobs_count: (existing.pending_jobs_count || 0) + 1,
          calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('production_stage_id', stageId)
        .eq('date', dateStr);
    } else {
      // Create new record
      await supabase
        .from('stage_workload_tracking')
        .insert({
          production_stage_id: stageId,
          date: dateStr,
          committed_hours: durationHours,
          available_hours: config.dailyWorkingMinutes / 60,
          queue_length_hours: durationHours,
          pending_jobs_count: 1,
          active_jobs_count: 0,
          calculated_at: new Date().toISOString()
        });
    }
  }

  /**
   * Calculate next available start time for a stage considering current queue
   */
  async calculateNextStartTime(stageId: string, estimatedDurationMinutes: number): Promise<Date> {
    let currentDate = new Date();
    
    // Ensure we start from a working day
    if (!(await workingHoursManager.isWorkingDay(currentDate))) {
      currentDate = await workingHoursManager.getNextWorkingDay(currentDate);
    }

    while (true) {
      const queueEndTime = await this.getStageQueueEndTime(stageId, currentDate);
      
      // Check if this job fits in the current day after queue
      const fitsInDay = await workingHoursManager.fitsInWorkingDay(queueEndTime, estimatedDurationMinutes);
      
      if (fitsInDay) {
        return queueEndTime;
      }

      // Move to next working day
      currentDate = await workingHoursManager.getNextWorkingDay(currentDate);
    }
  }

  /**
   * Schedule a stage and update capacity tracking
   */
  async scheduleStage(
    stageInstanceId: string,
    stageId: string,
    estimatedDurationMinutes: number,
    dependencyCompletionTime?: Date
  ): Promise<{ startTime: Date; endTime: Date }> {
    // Calculate when this stage can start based on queue and dependencies
    const queueStartTime = await this.calculateNextStartTime(stageId, estimatedDurationMinutes);
    
    const actualStartTime = dependencyCompletionTime && dependencyCompletionTime > queueStartTime
      ? dependencyCompletionTime
      : queueStartTime;

    // Calculate end time
    const endTime = new Date(actualStartTime);
    endTime.setMinutes(endTime.getMinutes() + estimatedDurationMinutes);

    // Update stage instance with schedule
    await supabase
      .from('job_stage_instances')
      .update({
        scheduled_start_at: actualStartTime.toISOString(),
        scheduled_end_at: endTime.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', stageInstanceId);

    // Update capacity tracking
    await this.updateStageQueueEndTime(stageId, endTime, estimatedDurationMinutes);

    return { startTime: actualStartTime, endTime };
  }

  /**
   * Get capacity overview for a stage
   */
  async getStageCapacity(stageId: string, date: Date): Promise<StageCapacity | null> {
    const dateStr = date.toISOString().split('T')[0];
    
    const { data: tracking } = await supabase
      .from('stage_workload_tracking')
      .select(`
        *,
        production_stages(name)
      `)
      .eq('production_stage_id', stageId)
      .eq('date', dateStr)
      .maybeSingle();

    if (!tracking) return null;

    return {
      stageId,
      stageName: (tracking.production_stages as any)?.name || 'Unknown Stage',
      date: dateStr,
      queueEndsAt: new Date(tracking.queue_ends_at),
      committedHours: tracking.committed_hours || 0,
      availableHours: tracking.available_hours || 8,
      queueLengthHours: tracking.queue_length_hours || 0,
      pendingJobsCount: tracking.pending_jobs_count || 0,
      activeJobsCount: tracking.active_jobs_count || 0
    };
  }

  /**
   * Reset capacity tracking for testing/debugging
   */
  async resetCapacityTracking(): Promise<void> {
    await supabase.from('stage_workload_tracking').delete().gte('id', 0);
    await supabase.from('daily_stage_capacity').delete().gte('id', 0);
  }
}

export const capacityTracker = new CapacityTracker();