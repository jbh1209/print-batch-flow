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
   * Create job stage instance entries for multi-day splits
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

    // Update original instance with first split info
    const firstSplit = splits[0];
    await supabase
      .from('job_stage_instances')
      .update({
        scheduled_start_at: firstSplit.startTime.toISOString(),
        scheduled_end_at: firstSplit.endTime.toISOString(),
        estimated_duration_minutes: firstSplit.durationMinutes,
        split_sequence: firstSplit.sequence,
        total_splits: firstSplit.totalSplits,
        is_split: splits.length > 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', originalStageInstanceId);

    const createdInstanceIds = [originalStageInstanceId];

    // Create continuation instances for remaining splits
    for (let i = 1; i < splits.length; i++) {
      const split = splits[i];
      
      const { data: newInstance, error: insertError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: originalInstance.job_id,
          job_table_name: originalInstance.job_table_name,
          category_id: originalInstance.category_id,
          production_stage_id: originalInstance.production_stage_id,
          stage_order: originalInstance.stage_order,
          part_assignment: originalInstance.part_assignment,
          dependency_group: originalInstance.dependency_group,
          job_order_in_stage: originalInstance.job_order_in_stage || 1,
          estimated_duration_minutes: split.durationMinutes,
          scheduled_start_at: split.startTime.toISOString(),
          scheduled_end_at: split.endTime.toISOString(),
          status: 'pending',
          split_sequence: split.sequence,
          total_splits: split.totalSplits,
          is_split: true,
          parent_split_id: originalStageInstanceId,
          unique_stage_key: `${originalInstance.job_id}-${originalInstance.production_stage_id}-${split.sequence}`
        })
        .select('id')
        .single();

      if (insertError || !newInstance) {
        throw new Error(`Failed to create split instance: ${insertError?.message}`);
      }

      createdInstanceIds.push(newInstance.id);
    }

    return createdInstanceIds;
  }

  /**
   * Check if a job needs to be split based on remaining working hours
   */
  async needsSplitting(startTime: Date, durationMinutes: number): Promise<boolean> {
    return !(await workingHoursManager.fitsInWorkingDay(startTime, durationMinutes));
  }
}

export const multiDayJobSplitter = new MultiDayJobSplitter();