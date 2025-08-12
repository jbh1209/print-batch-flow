import { supabase } from "@/integrations/supabase/client";
import { workingHoursManager } from "./WorkingHoursManager";

export interface JobSplit {
  sequence: number;
  totalSplits: number;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  remainingMinutes: number;
  isPartial: boolean;
}

export interface SplitJobResult {
  splits: JobSplit[];
  totalDuration: number;
  finalCompletionDate: Date;
}

export class MultiDayJobSplitter {
  /**
   * Split a job across multiple working days if it doesn't fit in remaining working hours
   * CORE LOGIC: If job can't finish by 16:30, split it. Continue next working day at 08:00.
   */
  async splitJobAcrossDays(
    startTime: Date,
    totalDurationMinutes: number
  ): Promise<SplitJobResult> {
    const splits: JobSplit[] = [];
    let remainingMinutes = totalDurationMinutes;
    let currentDate = new Date(startTime);
    let sequence = 1;

    while (remainingMinutes > 0) {
      // Ensure we're on a working day
      if (!(await workingHoursManager.isWorkingDay(currentDate))) {
        currentDate = await workingHoursManager.getNextWorkingDay(currentDate);
      }

      const availableMinutes = await workingHoursManager.getRemainingWorkingMinutes(currentDate);
      
      if (availableMinutes === 0) {
        // Move to next working day
        currentDate = await workingHoursManager.getNextWorkingDay(currentDate);
        continue;
      }

      const workingMinutesToday = Math.min(remainingMinutes, availableMinutes);
      const isPartial = workingMinutesToday < remainingMinutes;

      const splitStartTime = sequence === 1 ? 
        new Date(startTime) : 
        await workingHoursManager.getWorkingDayStart(currentDate);

      const splitEndTime = new Date(splitStartTime);
      splitEndTime.setMinutes(splitStartTime.getMinutes() + workingMinutesToday);

      splits.push({
        sequence,
        totalSplits: 0, // Will be updated after all splits calculated
        startTime: splitStartTime,
        endTime: splitEndTime,
        durationMinutes: workingMinutesToday,
        remainingMinutes: remainingMinutes - workingMinutesToday,
        isPartial
      });

      remainingMinutes -= workingMinutesToday;
      sequence++;

      if (remainingMinutes > 0) {
        currentDate = await workingHoursManager.getNextWorkingDay(currentDate);
      }
    }

    // Update totalSplits for all splits
    splits.forEach(split => {
      split.totalSplits = splits.length;
    });

    const finalCompletionDate = splits[splits.length - 1].endTime;

    return {
      splits,
      totalDuration: totalDurationMinutes,
      finalCompletionDate
    };
  }

  /**
   * PHASE 2: Store split information as JSON metadata on master instance
   * NO MORE CONTINUATION INSTANCES - single master instance with split metadata
   */
  async createSplitStageInstances(
    originalStageInstanceId: string,
    splits: JobSplit[]
  ): Promise<string[]> {
    if (splits.length <= 1) return [originalStageInstanceId];

    const { data: originalInstance, error } = await supabase
      .from('job_stage_instances')
      .select('*')
      .eq('id', originalStageInstanceId)
      .single();

    if (error || !originalInstance) {
      throw new Error(`Failed to fetch original stage instance: ${error?.message}`);
    }

    // CRITICAL NEW APPROACH: Store ALL split information as JSON metadata
    // Update master instance to span entire multi-day duration
    const firstSplit = splits[0];
    const lastSplit = splits[splits.length - 1];
    
    await supabase
      .from('job_stage_instances')
      .update({
        scheduled_start_at: firstSplit.startTime.toISOString(),
        scheduled_end_at: lastSplit.endTime.toISOString(),
        estimated_duration_minutes: splits.reduce((total, split) => total + split.durationMinutes, 0),
        split_metadata: {
          totalSplits: splits.length,
          splits: splits.map(split => ({
            sequence: split.sequence,
            startTime: split.startTime.toISOString(),
            endTime: split.endTime.toISOString(),
            durationMinutes: split.durationMinutes,
            remainingMinutes: split.remainingMinutes,
            isPartial: split.isPartial
          })),
          createdAt: new Date().toISOString(),
          spansDays: splits.length
        },
        is_split: splits.length > 1,
        split_status: splits.length > 1 ? 'master_with_splits' : 'complete',
        job_order_in_stage: originalInstance.job_order_in_stage || 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', originalStageInstanceId);

    // CRITICAL: Return only the master instance ID - no continuation instances created
    return [originalStageInstanceId];
  }

  /**
   * Check if a job needs to be split based on remaining working hours
   */
  async needsSplitting(startTime: Date, durationMinutes: number): Promise<boolean> {
    return !(await workingHoursManager.fitsInWorkingDay(startTime, durationMinutes));
  }
}

export const multiDayJobSplitter = new MultiDayJobSplitter();